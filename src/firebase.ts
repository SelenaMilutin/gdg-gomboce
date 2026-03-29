/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { initializeApp, FirebaseError } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot,
  query, where, addDoc, updateDoc, deleteDoc,
  Timestamp, getDocFromServer, writeBatch,
} from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey:            env.VITE_API_KEY,
  authDomain:        env.VITE_AUTH_DOMAIN,
  projectId:         env.VITE_PROJECT_ID,
  storageBucket:     env.VITE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_MESSAGING_SENDER_ID,
  appId:             env.VITE_APP_ID,
};

console.log('Initializing Firebase with config:', {
  apiKey:            env.VITE_API_KEY            ? '****' : 'MISSING',
  authDomain:        env.VITE_AUTH_DOMAIN        || 'MISSING',
  projectId:         env.VITE_PROJECT_ID         || 'MISSING',
  storageBucket:     env.VITE_STORAGE_BUCKET     || 'MISSING',
  messagingSenderId: env.VITE_MESSAGING_SENDER_ID || 'MISSING',
  appId:             env.VITE_APP_ID             ? '****' : 'MISSING',
});

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app, 'radi-molim-te');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

export const signInWithGoogle = async () => {
  try {
    if (auth.currentUser) return { user: auth.currentUser };
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    const code = error?.code;
    if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
      return null;
    }
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

/**
 * Register a new user with email + password.
 * Optionally sets a display name so userProfile.name gets populated.
 */
export const registerWithEmail = async (
  email: string,
  password: string,
  displayName?: string,
) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await firebaseUpdateProfile(credential.user, { displayName });
  }
  return credential;
};

/**
 * Sign in an existing user with email + password.
 */
export const signInWithEmail = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logout = () => signOut(auth);

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId:        string | undefined;
    email:         string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous:   boolean | undefined;
    tenantId:      string | null | undefined;
    providerInfo: {
      providerId:  string;
      displayName: string | null;
      email:       string | null;
      photoUrl:    string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId:        auth.currentUser?.uid,
      email:         auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous:   auth.currentUser?.isAnonymous,
      tenantId:      auth.currentUser?.tenantId,
      providerInfo:  auth.currentUser?.providerData.map(p => ({
        providerId:  p.providerId,
        displayName: p.displayName,
        email:       p.email,
        photoUrl:    p.photoURL,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection test
// ─────────────────────────────────────────────────────────────────────────────

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports (Firestore SDK surface used across the app)
// ─────────────────────────────────────────────────────────────────────────────
export {
  collection, doc, setDoc, getDoc, getDocs,
  onSnapshot, query, where,
  addDoc, updateDoc, deleteDoc,
  Timestamp, onAuthStateChanged, writeBatch,
};