import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { PoliceAuth } from '../services/auth';
import { pushNotifications } from '../services/pushNotifications';
import type { PoliceOfficerWithStation } from '../services/supabase';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

type AuthContextType = {
  status: AuthStatus;
  isAuthenticated: boolean;
  officer: PoliceOfficerWithStation | null;
  login: (serviceNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [officer, setOfficer] = useState<PoliceOfficerWithStation | null>(null);
  const loginInProgress = useRef(false);

  useEffect(() => {
    let mounted = true;
    PoliceAuth.restoreSession().then((session) => {
      if (!mounted || loginInProgress.current) return;
      if (session) {
        setOfficer(session);
        setStatus('authenticated');
        pushNotifications.initialize(session.id);
      } else {
        setStatus('unauthenticated');
      }
    }).catch(() => {
      if (mounted && !loginInProgress.current) setStatus('unauthenticated');
    });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (serviceNumber: string, password: string) => {
    loginInProgress.current = true;
    try {
      const result = await PoliceAuth.login(serviceNumber, password);
      setOfficer(result);
      setStatus('authenticated');
      pushNotifications.initialize(result.id);
    } finally {
      loginInProgress.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    const id = officer?.id;
    setOfficer(null);
    setStatus('unauthenticated');
    if (id) {
      await pushNotifications.unregister(id);
      await PoliceAuth.logout(id);
    } else {
      await PoliceAuth.logout();
    }
  }, [officer?.id]);

  const refresh = useCallback(async () => {
    const session = await PoliceAuth.restoreSession();
    if (session) {
      setOfficer(session);
      setStatus('authenticated');
    } else {
      setOfficer(null);
      setStatus('unauthenticated');
    }
  }, []);

  const isAuthenticated = status === 'authenticated';

  return (
    <AuthContext.Provider value={{ status, isAuthenticated, officer, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
