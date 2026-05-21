import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './config';

// ─────────────────────────────────────────────
// Create or update user document in Firestore
// ─────────────────────────────────────────────
export const upsertUserDocument = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0],
      photoURL: user.photoURL || '',
      projectIds: [],
      fcmTokens: [],
      preferences: { theme: 'dark', notifications: true },
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });
  } else {
    await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
  }
};

// ─────────────────────────────────────────────
// Google Sign-In
// ─────────────────────────────────────────────
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  await upsertUserDocument(result.user);
  return result.user;
};

// ─────────────────────────────────────────────
// Email / Password Auth
// ─────────────────────────────────────────────
export const signInWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await upsertUserDocument(result.user);
  return result.user;
};

export const registerWithEmail = async (
  email: string,
  password: string,
  displayName: string
) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await upsertUserDocument(result.user);
  return result.user;
};

// ─────────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────────
export const signOutUser = () => signOut(auth);

// ─────────────────────────────────────────────
// Auth state observer
// ─────────────────────────────────────────────
export const onAuthChange = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);
