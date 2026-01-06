import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { AuthUser } from '../types';
import { checkRateLimit, recordFailedAttempt, recordSuccess, getClientIdentifier } from '../utils/rateLimiter';

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Admin'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    
    // Check rate limiting
    const identifier = getClientIdentifier();
    const rateLimitCheck = checkRateLimit(identifier);
    
    if (!rateLimitCheck.allowed) {
      setLoading(false);
      const error = new Error('Too many failed login attempts. Please try again later.');
      (error as any).code = 'auth/too-many-requests';
      (error as any).rateLimitInfo = {
        blocked: rateLimitCheck.blocked,
        resetTime: rateLimitCheck.resetTime,
        remainingAttempts: rateLimitCheck.remainingAttempts
      };
      throw error;
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // Success - reset rate limit
      recordSuccess(identifier);
    } catch (error: any) {
      setLoading(false);
      // Record failed attempt
      recordFailedAttempt(identifier);
      
      // Check if blocked after this attempt
      const newRateLimitCheck = checkRateLimit(identifier);
      if (newRateLimitCheck.blocked) {
        const rateLimitError = new Error('Too many failed login attempts. Your account is temporarily blocked.');
        (rateLimitError as any).code = 'auth/too-many-requests';
        (rateLimitError as any).rateLimitInfo = {
          blocked: true,
          resetTime: newRateLimitCheck.resetTime,
          remainingAttempts: 0
        };
        throw rateLimitError;
      }
      
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
