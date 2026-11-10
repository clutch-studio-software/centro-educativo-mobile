import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, FUNCTIONS_BASE_URL } from '../services/firebase';

const STORAGE_USER_KEY = '@educar_transformar_mobile_user';
const GENERIC_AUTH_ERROR_MSG =
  'Usuario o contraseña incorrectos. Por favor revise sus credenciales.';
const AuthContext = createContext(null);

/**
 * Valida si el rol institucional está habilitado para acceder a la aplicación móvil.
 * Exclusivamente padres/tutores y estudiantes tienen permitido el acceso móvil.
 */
export const isAllowedMobileRole = (role) => {
  if (!role) return false;
  const normalized = String(role).trim().toLowerCase();

  // Bloqueo explícito de roles administrativos y docentes
  if (
    normalized.includes('docente') ||
    normalized.includes('profesor') ||
    normalized.includes('staff') ||
    normalized.includes('admin') ||
    normalized.includes('directiv') ||
    normalized.includes('preceptor') ||
    normalized.includes('enferm')
  ) {
    return false;
  }

  return (
    normalized.includes('padre') ||
    normalized.includes('tutor') ||
    normalized.includes('madre') ||
    normalized.includes('estudiante') ||
    normalized.includes('alumno')
  );
};

/**
 * Genera formato alternativo de contraseña si el input corresponde a un DNI
 * (agrega puntos si tiene 7-9 dígitos continuos, o quita puntos si los tiene).
 */
const buildAlternateDniPassword = (rawPwd) => {
  const isDigitsOnly = /^\d{7,9}$/.test(rawPwd);
  const isDniWithDots = /^\d{1,2}\.\d{3}\.\d{3}$/.test(rawPwd);

  if (isDigitsOnly) {
    const len = rawPwd.length;
    return `${rawPwd.slice(0, len - 6)}.${rawPwd.slice(len - 6, len - 3)}.${rawPwd.slice(len - 3)}`;
  }
  if (isDniWithDots) {
    return rawPwd.replace(/\./g, '');
  }
  return null;
};

/**
 * Consulta el perfil institucional correspondiente en Firestore según rol y uid.
 */
const fetchUserProfile = async (firebaseUser, claimsRole) => {
  if (claimsRole === 'Estudiante') {
    const stSnap = await getDoc(doc(db, 'students', firebaseUser.uid));
    return {
      role: 'Estudiante',
      profileData: stSnap.exists() ? stSnap.data() : {},
    };
  }

  const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      role: data.role || claimsRole || null,
      profileData: data,
    };
  }

  // Si no está en users, intentar leer de students como contingencia
  const fallbackSnap = await getDoc(doc(db, 'students', firebaseUser.uid));
  if (fallbackSnap.exists()) {
    return {
      role: 'Estudiante',
      profileData: fallbackSnap.data(),
    };
  }

  return {
    role: claimsRole || null,
    profileData: {},
  };
};

/**
 * Login de alumno mediante Cloud Function cf_loginStudent (devuelve customToken).
 */
const loginStudentViaCloudFunction = async (cleanId, rawPwd) => {
  const normalizedLegajo = cleanId.startsWith('#') ? cleanId.slice(1) : cleanId;
  let response = await fetch(`${FUNCTIONS_BASE_URL}/cf_loginStudent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentID_login: normalizedLegajo, password: rawPwd }),
  });

  // Reintento con prefijo '#' si el backend lo almacenó de forma estricta
  if (!response.ok && !cleanId.startsWith('#')) {
    response = await fetch(`${FUNCTIONS_BASE_URL}/cf_loginStudent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentID_login: `#${normalizedLegajo}`, password: rawPwd }),
    });
  }

  if (!response.ok) {
    let errorMessage = GENERIC_AUTH_ERROR_MSG;
    try {
      const errData = await response.json();
      if (errData?.error) errorMessage = errData.error;
    } catch (_err) {
      // Usar mensaje genérico
    }
    throw new Error(errorMessage);
  }

  const { customToken } = await response.json();
  return signInWithCustomToken(auth, customToken);
};

/**
 * Login de correo y contraseña con tolerancia de formato DNI (puntos <-> sin puntos).
 */
const loginWithEmailAndDniFallback = async (cleanId, rawPwd) => {
  try {
    return await signInWithEmailAndPassword(auth, cleanId, rawPwd);
  } catch (authError) {
    const isCredentialError =
      authError?.code === 'auth/invalid-credential' ||
      authError?.code === 'auth/wrong-password' ||
      authError?.message?.includes('INVALID_LOGIN_CREDENTIALS');

    if (!isCredentialError) {
      throw new Error(authError?.message || 'Error al iniciar sesión en Firebase Auth.');
    }

    const alternatePassword = buildAlternateDniPassword(rawPwd);
    if (alternatePassword && alternatePassword !== rawPwd) {
      try {
        return await signInWithEmailAndPassword(auth, cleanId, alternatePassword);
      } catch (_retryErr) {
        // Continuar con el error genérico si falla el formato alternativo
      }
    }

    throw new Error(GENERIC_AUTH_ERROR_MSG);
  }
};

/**
 * Verifica que la contraseña actual del estudiante sea correcta contra cf_loginStudent.
 */
const verifyStudentCurrentPassword = async (userProfile, currentPassword) => {
  const rawLegajo = String(
    userProfile?.studentID_login || userProfile?.legajo || userProfile?.dni || ''
  ).trim();
  if (!rawLegajo) {
    throw new Error('No se pudo identificar el legajo del estudiante para validar su clave.');
  }

  const normalizedLegajo = rawLegajo.startsWith('#') ? rawLegajo.slice(1) : rawLegajo;
  const candidateLegajos = Array.from(new Set([normalizedLegajo, `#${normalizedLegajo}`]));
  const alternatePwd = buildAlternateDniPassword(currentPassword);
  const candidatePasswords = alternatePwd
    ? [currentPassword, alternatePwd]
    : [currentPassword];

  for (const leg of candidateLegajos) {
    for (const pwd of candidatePasswords) {
      const res = await fetch(`${FUNCTIONS_BASE_URL}/cf_loginStudent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentID_login: leg, password: pwd }),
      });
      if (res.ok) {
        return true;
      }
    }
  }

  throw new Error('La contraseña actual ingresada es incorrecta.');
};

/**
 * Re-autentica al tutor en Firebase Auth validando su contraseña actual (con tolerancia de formato DNI).
 */
const reauthenticateTutorWithFallback = async (firebaseUser, userProfile, currentPassword) => {
  const email = String(firebaseUser?.email || userProfile?.email || '').trim();
  if (!email) {
    throw new Error('No se encontró el correo electrónico de la sesión actual.');
  }

  try {
    const cred = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(firebaseUser, cred);
    return true;
  } catch (_err) {
    const alternatePwd = buildAlternateDniPassword(currentPassword);
    if (alternatePwd && alternatePwd !== currentPassword) {
      try {
        const altCred = EmailAuthProvider.credential(email, alternatePwd);
        await reauthenticateWithCredential(firebaseUser, altCred);
        return true;
      } catch (_retryErr) {
        // Continuar para arrojar mensaje claro
      }
    }
    throw new Error('La contraseña actual ingresada es incorrecta.');
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCachedSession = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_USER_KEY);
        if (cached && mounted && !auth.currentUser) {
          const parsed = JSON.parse(cached);
          if (isAllowedMobileRole(parsed?.role)) {
            setUser(parsed);
          } else {
            await AsyncStorage.removeItem(STORAGE_USER_KEY);
          }
        }
      } catch (_err) {
        // Ignorar error de lectura de caché local
      }
    };
    void loadCachedSession();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (!firebaseUser) {
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_USER_KEY);
        setLoading(false);
        return;
      }

      try {
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        const claimsRole = idTokenResult.claims.role || null;
        const studentId = idTokenResult.claims.studentId || null;

        const { role, profileData } = await fetchUserProfile(firebaseUser, claimsRole);

        if (!isAllowedMobileRole(role)) {
          await signOut(auth);
          setUser(null);
          await AsyncStorage.removeItem(STORAGE_USER_KEY);
          return;
        }

        const loggedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || profileData.email || '',
          role,
          studentId,
          ...profileData,
        };

        setUser(loggedUser);
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(loggedUser));
      } catch (err) {
        console.warn('Error obteniendo claims/perfil de Firebase:', err?.message);
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_USER_KEY);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /**
   * Login unificado integrado con Firebase (idéntico al flujo de la Plataforma Web)
   */
  const login = useCallback(async (identifier, password, role = 'Estudiante/Tutor') => {
    const cleanId = String(identifier || '').trim();
    const rawPwd = String(password || '').trim();

    if (!cleanId || !rawPwd) {
      throw new Error('Por favor ingrese su usuario (ID o correo) y contraseña.');
    }

    const isStudentOrTutor =
      !role || role === 'Estudiante' || role === 'Estudiante/Tutor' || role === 'Padre';
    const isStudentLegajo = isStudentOrTutor && !cleanId.includes('@');

    let userCredential;
    if (isStudentLegajo) {
      userCredential = await loginStudentViaCloudFunction(cleanId, rawPwd);
    } else {
      userCredential = await loginWithEmailAndDniFallback(cleanId, rawPwd);
    }

    const firebaseUser = userCredential?.user || auth.currentUser;
    if (firebaseUser) {
      const idTokenResult = await firebaseUser.getIdTokenResult(true);
      const claimsRole = idTokenResult.claims?.role || null;
      const { role: resolvedRole } = await fetchUserProfile(firebaseUser, claimsRole);

      if (!isAllowedMobileRole(resolvedRole)) {
        await signOut(auth);
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_USER_KEY);
        throw new Error(GENERIC_AUTH_ERROR_MSG);
      }
    }

    return userCredential;
  }, []);

  /**
   * Recuperación de contraseña por correo electrónico (Firebase Auth)
   */
  const resetPasswordByEmail = useCallback(async (email) => {
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingrese un correo electrónico válido para enviar el enlace de recuperación.');
    }
    await sendPasswordResetEmail(auth, cleanEmail);
  }, []);

const extractPasswordChangeArgs = (currentPasswordOrObj, maybeNewPassword) => {
  const isObj = typeof currentPasswordOrObj === 'object' && currentPasswordOrObj !== null;
  const rawCurrent = isObj
    ? currentPasswordOrObj.currentPassword
    : maybeNewPassword !== undefined
      ? currentPasswordOrObj
      : '';
  const rawNew = isObj
    ? currentPasswordOrObj.newPassword
    : maybeNewPassword !== undefined
      ? maybeNewPassword
      : currentPasswordOrObj;
  return {
    cleanCurrent: String(rawCurrent || '').trim(),
    cleanNew: String(rawNew || '').trim(),
  };
};

const executeStudentPasswordChange = async (user, cleanCurrent, cleanNew) => {
  await verifyStudentCurrentPassword(user, cleanCurrent);
  const idToken = await auth.currentUser.getIdToken(true);
  const response = await fetch(`${FUNCTIONS_BASE_URL}/cf_changeStudentPassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      studentId: user.uid,
      newPassword: cleanNew,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al actualizar la contraseña del estudiante.');
  }
};

const executeTutorPasswordChange = async (user, cleanCurrent, cleanNew) => {
  await reauthenticateTutorWithFallback(auth.currentUser, user, cleanCurrent);
  await updatePassword(auth.currentUser, cleanNew);

  const idToken = await auth.currentUser.getIdToken(true);
  const response = await fetch(`${FUNCTIONS_BASE_URL}/cf_completePasswordChange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData.error || 'Error al confirmar el cambio de contraseña en el servidor.'
    );
  }
};
  const changePassword = useCallback(
    async (currentPasswordOrObj, maybeNewPassword) => {
      if (!user || !auth.currentUser) {
        throw new Error('No hay una sesión activa para cambiar la contraseña.');
      }

      const { cleanCurrent, cleanNew } = extractPasswordChangeArgs(
        currentPasswordOrObj,
        maybeNewPassword
      );

      if (!cleanCurrent) {
        throw new Error('Por favor ingrese su contraseña actual para verificar su identidad.');
      }
      if (!cleanNew || cleanNew.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
      }
      if (cleanCurrent === cleanNew) {
        throw new Error('La nueva contraseña debe ser diferente de la contraseña actual.');
      }

      if (user.role === 'Estudiante') {
        await executeStudentPasswordChange(user, cleanCurrent, cleanNew);
      } else {
        await executeTutorPasswordChange(user, cleanCurrent, cleanNew);
      }

      const updatedUser = { ...user, mustChangePassword: false };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
    },
    [user]
  );

  /**
   * Actualización de datos de contacto permitidos para el Tutor ("Mi Perfil"):
   * Solo correo electrónico, teléfono y domicilio. El alumno no puede modificar ningún dato.
   */
  const updateTutorProfile = useCallback(
    async ({ email, telefono, domicilio }) => {
      if (!user || !auth.currentUser) {
        throw new Error('No hay una sesión activa para actualizar el perfil.');
      }

      const roleLower = String(user.role || '').toLowerCase();
      if (roleLower.includes('estudiante') || roleLower.includes('alumno')) {
        throw new Error(
          'Los estudiantes no tienen permisos para modificar datos de su perfil institucional.'
        );
      }

      const cleanEmail = String(email || '').trim();
      const cleanTelefono = String(telefono || '').trim();
      const cleanDomicilio = String(domicilio || '').trim();

      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        throw new Error('Ingrese un correo electrónico válido.');
      }
      if (!cleanTelefono || cleanTelefono.length < 6) {
        throw new Error('Ingrese un número de teléfono de contacto válido.');
      }
      if (!cleanDomicilio || cleanDomicilio.length < 4) {
        throw new Error('Ingrese un domicilio válido.');
      }

      const uid = auth.currentUser.uid || user.uid;
      await updateDoc(doc(db, 'users', uid), {
        email: cleanEmail,
        telefono: cleanTelefono,
        domicilio: cleanDomicilio,
        updatedAt: serverTimestamp(),
      });

      if (
        auth.currentUser.email &&
        cleanEmail.toLowerCase() !== auth.currentUser.email.toLowerCase()
      ) {
        try {
          await updateEmail(auth.currentUser, cleanEmail);
        } catch (_err) {
          // Si Firebase Auth requiere verificación por link o reautenticación reciente,
          // el perfil institucional en users/{uid} ya quedó actualizado.
        }
      }

      const updatedUser = {
        ...user,
        email: cleanEmail,
        telefono: cleanTelefono,
        domicilio: cleanDomicilio,
      };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    },
    [user]
  );

  /**
   * Cerrar sesión
   */
  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    try {
      await signOut(auth);
    } catch (_err) {
      // Continuar con éxito local si falla la red al cerrar sesión
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isLoggedIn: Boolean(user),
      login,
      logout,
      changePassword,
      updateTutorProfile,
      resetPasswordByEmail,
    }),
    [user, loading, login, logout, changePassword, updateTutorProfile, resetPasswordByEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider.');
  }
  return ctx;
};
