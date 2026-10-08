"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncAuth = () => {
    try {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth sync error:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAuth();

    // Cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user' || e.key === null) {
        syncAuth();
      }
    };

    // Handle bfcache when user navigates using browser back/forward buttons
    const handlePageShow = () => {
      syncAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const login = (token: string, userData: User) => {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err) {
      console.error("Login storage error:", err);
    }
    setUser(userData);
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Clear any session cache
      sessionStorage.clear();
      // Notify other listeners in this window
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error("Logout storage error:", err);
    }
    setUser(null);
    // Hard navigate to login replacing current history entry
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
