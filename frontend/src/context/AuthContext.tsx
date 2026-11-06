'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider, formatAuthError } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<User>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (err) => {
        console.error('Firebase onAuthStateChanged error:', err);
        setError(formatAuthError(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User> => {
    clearError();
    setIsAuthenticating(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: unknown) {
      const formatted = formatAuthError(err);
      setError(formatted);
      throw new Error(formatted);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<User> => {
    clearError();
    setIsAuthenticating(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    } catch (err: unknown) {
      const formatted = formatAuthError(err);
      setError(formatted);
      throw new Error(formatted);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<User> => {
    clearError();
    setIsAuthenticating(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await updateProfile(result.user, {
          displayName: displayName.trim(),
        });
        // Force refresh user state so displayName is available immediately
        setUser({ ...result.user, displayName: displayName.trim() });
      }
      return result.user;
    } catch (err: unknown) {
      const formatted = formatAuthError(err);
      setError(formatted);
      throw new Error(formatted);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    clearError();
    setIsAuthenticating(true);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: unknown) {
      const formatted = formatAuthError(err);
      setError(formatted);
      throw new Error(formatted);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    clearError();
    setIsAuthenticating(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: unknown) {
      const formatted = formatAuthError(err);
      setError(formatted);
      throw new Error(formatted);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticating,
        error,
        clearError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
