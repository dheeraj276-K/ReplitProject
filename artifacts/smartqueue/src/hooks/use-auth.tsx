import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type AuthValue = { session: Session | null; user: User | null; profile: Profile | null; loading: boolean; refreshProfile: (userId?: string) => Promise<void> };
const AuthContext = createContext<AuthValue>({ session: null, user: null, profile: null, loading: true, refreshProfile: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  async function loadProfile(userId: string) {
    if (!supabase) return;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) { setProfile(data as Profile); return; }
      if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, 350));
    }
    setProfile(null);
  }
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      if (alive) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next?.user) { setProfile(null); setLoading(false); }
      else queueMicrotask(() => { void loadProfile(next.user.id).finally(() => setLoading(false)); });
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ session, user: session?.user ?? null, profile, loading, refreshProfile: async (userId?: string) => { const id = userId ?? session?.user.id; if (id) await loadProfile(id); } }), [session, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
