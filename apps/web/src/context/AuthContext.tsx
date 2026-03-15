'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AuthUser,
  AuthError,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  confirmSignUp as authConfirmSignUp,
  getCurrentUser,
} from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  error: AuthError | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Check auth state on mount
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const authUser = await authSignIn(email, password);
      setUser(authUser);
    } catch (err) {
      const authErr = err as AuthError;
      setError(authErr);
      throw authErr;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authSignUp(email, password, name);
    } catch (err) {
      const authErr = err as AuthError;
      setError(authErr);
      throw authErr;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await authSignOut();
      setUser(null);
    } catch (err) {
      const authErr = err as AuthError;
      setError(authErr);
      throw authErr;
    }
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authConfirmSignUp(email, code);
    } catch (err) {
      const authErr = err as AuthError;
      setError(authErr);
      throw authErr;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
      confirmSignUp,
      error,
      clearError,
    }),
    [user, isLoading, signIn, signUp, signOut, confirmSignUp, error, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}
