import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Prevent duplicate app initialization in Next.js dev mode
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Storage is only available on Firebase Blaze (paid) plan.
// On the free Spark plan, storage is null — file upload features are disabled.
export const getStorageInstance = async () => {
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) return null;
  try {
    const { getStorage } = await import('firebase/storage');
    return getStorage(app);
  } catch {
    return null;
  }
};

googleProvider.setCustomParameters({ prompt: 'select_account' });

// FCM — only in browser, only on Blaze plan
export const getMessagingInstance = async () => {
  if (typeof window !== 'undefined' && (await isSupported())) {
    try {
      return getMessaging(app);
    } catch {
      return null;
    }
  }
  return null;
};

export default app;

