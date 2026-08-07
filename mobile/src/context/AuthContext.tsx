import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PoliceAuth } from '../lib/policeAuth';
import type { PoliceOfficerWithStation } from '../lib/supabase';

type AuthState = {
  officer: PoliceOfficerWithStation | null;
  loading: boolean;
  signIn: (serviceNumber: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [officer, setOfficer] = useState<PoliceOfficerWithStation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    PoliceAuth.restoreSession()
      .then((restored) => {
        if (mounted) setOfficer(restored);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (serviceNumber: string, password: string) => {
    const next = await PoliceAuth.login(serviceNumber, password);
    setOfficer(next);
  }, []);

  const signOut = useCallback(async () => {
    await PoliceAuth.logout(officer?.id);
    setOfficer(null);
  }, [officer?.id]);

  const value = useMemo(() => ({ officer, loading, signIn, signOut }), [officer, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
