import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../types';

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (pin: string) => Promise<void>; // Changed to accept PIN
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hardcoded PIN for development
const HARDCODED_PIN = '1234';
const MOCK_AUTH_USER: AuthUser = {
  uid: 'pin-user-1234',
  email: 'pin.user@tajneed.com',
  displayName: 'PIN User',
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved auth state in local storage (for persistence across sessions)
    const savedUserStr = localStorage.getItem('tajneed_auth_user');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr) as AuthUser;
        setUser(savedUser);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('tajneed_auth_user'); // Clear corrupted data
      }
    }
    setLoading(false);
  }, []);

  // Login function now accepts a PIN
  const login = async (pin: string) => {
    setLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      if (pin === HARDCODED_PIN) {
        localStorage.setItem('tajneed_auth_user', JSON.stringify(MOCK_AUTH_USER));
        setUser(MOCK_AUTH_USER);
      } else {
        throw new Error('Invalid PIN');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.removeItem('tajneed_auth_user');
      setUser(null);
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
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
