import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = typeof process !== 'undefined' && process.env ? process.env : {};

const getEnvVar = (key, fallback = '') => {
  return (
    env[`EXPO_PUBLIC_${key}`] ||
    env[key] ||
    env[`VITE_${key}`] ||
    fallback
  );
};

export const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY', 'dummy-api-key'),
  authDomain: getEnvVar(
    'FIREBASE_AUTH_DOMAIN',
    'centro-educativo-f5cc5.firebaseapp.com'
  ),
  projectId: getEnvVar('FIREBASE_PROJECT_ID', 'centro-educativo-f5cc5'),
  storageBucket: getEnvVar(
    'FIREBASE_STORAGE_BUCKET',
    'centro-educativo-f5cc5.appspot.com'
  ),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID', ''),
  appId: getEnvVar('FIREBASE_APP_ID', ''),
};

export const FUNCTIONS_BASE_URL = getEnvVar(
  'FUNCTIONS_BASE_URL',
  'https://us-central1-centro-educativo-f5cc5.cloudfunctions.net'
);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const storage = getStorage(app);
export default app;
