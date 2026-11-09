import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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

  /**
   * Cambio de contraseña y limpieza del flag mustChangePassword en Firestore
   */
  const changePassword = useCallback(
    async (newPassword) => {
      if (!user || !auth.currentUser) {
        throw new Error('No hay una sesión activa para cambiar la contraseña.');
      }
      if (!newPassword || String(newPassword).trim().length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
      }

      const idToken = await auth.currentUser.getIdToken(true);

      if (user.role === 'Estudiante') {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/cf_changeStudentPassword`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            studentId: user.uid,
            newPassword,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al actualizar la contraseña del estudiante.');
        }
      } else {
        await updatePassword(auth.currentUser, newPassword);

        const response = await fetch(`${FUNCTIONS_BASE_URL}/cf_completePasswordChange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al confirmar el cambio de contraseña en el servidor.');
        }
      }

      const updatedUser = { ...user, mustChangePassword: false };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
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
      resetPasswordByEmail,
    }),
    [user, loading, login, logout, changePassword, resetPasswordByEmail]
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
