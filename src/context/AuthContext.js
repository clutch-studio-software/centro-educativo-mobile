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
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCachedSession = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_USER_KEY);
        if (cached && mounted && !auth.currentUser) {
          setUser(JSON.parse(cached));
        }
      } catch {
        // Ignorar error de lectura local
      }
    };
    void loadCachedSession();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (firebaseUser) {
        try {
          // Obligatorio: forceRefresh = true para obtener Custom Claims actualizados (role, studentId)
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          let role = idTokenResult.claims.role || null;
          const studentId = idTokenResult.claims.studentId || null;

          let profileData = {};
          if (role === 'Estudiante') {
            const stSnap = await getDoc(doc(db, 'students', firebaseUser.uid));
            if (stSnap.exists()) {
              profileData = stSnap.data();
            }
          } else {
            const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userSnap.exists()) {
              profileData = userSnap.data();
              if (!role && profileData.role) {
                role = profileData.role;
              }
            } else {
              const stSnap = await getDoc(doc(db, 'students', firebaseUser.uid));
              if (stSnap.exists()) {
                profileData = stSnap.data();
                role = 'Estudiante';
              }
            }
          }

          const loggedUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || profileData.email || '',
            role: role || profileData.role || 'Padre',
            studentId,
            ...profileData,
          };

          setUser(loggedUser);
          await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(loggedUser));
        } catch (err) {
          console.warn('Error obteniendo claims/perfil de Firebase:', err?.message);
          setUser(null);
          await AsyncStorage.removeItem(STORAGE_USER_KEY);
        }
      } else {
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_USER_KEY);
      }

      if (mounted) {
        setLoading(false);
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

    if (isStudentLegajo) {
      // Login de Estudiante mediante Cloud Function cf_loginStudent
      const normalizedLegajo = cleanId.startsWith('#') ? cleanId.slice(1) : cleanId;
      let response = await fetch(`${FUNCTIONS_BASE_URL}/cf_loginStudent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentID_login: normalizedLegajo, password: rawPwd }),
      });

      // Si el legajo está guardado con '#' en Firestore, reintentar con '#'
      if (!response.ok && !cleanId.startsWith('#')) {
        response = await fetch(`${FUNCTIONS_BASE_URL}/cf_loginStudent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentID_login: `#${normalizedLegajo}`, password: rawPwd }),
        });
      }

      if (!response.ok) {
        let errorMessage = 'Credenciales de alumno incorrectas.';
        try {
          const errData = await response.json();
          if (errData?.error) errorMessage = errData.error;
        } catch {
          // Usar mensaje por defecto
        }
        throw new Error(errorMessage);
      }

      const { customToken } = await response.json();
      return signInWithCustomToken(auth, customToken);
    }

    // Login de Padre / Tutor / Staff con tolerancia automática de formato DNI (sin puntos <-> con puntos)
    try {
      return await signInWithEmailAndPassword(auth, cleanId, rawPwd);
    } catch (authError) {
      const isCredentialError =
        authError?.code === 'auth/invalid-credential' ||
        authError?.code === 'auth/wrong-password' ||
        authError?.message?.includes('INVALID_LOGIN_CREDENTIALS');

      if (isCredentialError) {
        const isDigitsOnly = /^\d{7,9}$/.test(rawPwd);
        const isDniWithDots = /^\d{1,2}\.\d{3}\.\d{3}$/.test(rawPwd);

        let alternatePassword = null;
        if (isDigitsOnly) {
          const len = rawPwd.length;
          alternatePassword = `${rawPwd.slice(0, len - 6)}.${rawPwd.slice(
            len - 6,
            len - 3
          )}.${rawPwd.slice(len - 3)}`;
        } else if (isDniWithDots) {
          alternatePassword = rawPwd.replace(/\./g, '');
        }

        if (alternatePassword && alternatePassword !== rawPwd) {
          try {
            return await signInWithEmailAndPassword(auth, cleanId, alternatePassword);
          } catch {
            // Continuar para lanzar error legible
          }
        }
        throw new Error(
          'Correo electrónico o contraseña incorrectos. Recuerde que su clave inicial por defecto es su número de DNI.'
        );
      }

      throw new Error(authError?.message || 'Error al iniciar sesión en Firebase Auth.');
    }
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
    } catch {
      // Continuar
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
