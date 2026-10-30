import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyABpbnz_eEaXdnqDJSGwRVw-EMoiMBhwis",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "openpurpl-f8dd3.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "openpurpl-f8dd3",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "openpurpl-f8dd3.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "656258819658",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:656258819658:web:c6534a48118471d073e8b3",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-7NDCX17T2Y"
};

// Initialize Firebase singleton
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Google Auth Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// User-friendly error message formatter
export function formatAuthError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const firebaseError = typeof error === 'object' && error !== null
    ? (error as { code?: string; message?: string })
    : { code: '', message: String(error) };

  const code = firebaseError.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid. Please check the spelling.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email address. Please sign up first.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing. Please try again.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in popup is already open. Please complete or close it.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Console. Please verify Authentication settings.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to many failed attempts. Try again later or reset your password.';
    default:
      return firebaseError.message || 'Authentication failed. Please try again.';
  }
}
