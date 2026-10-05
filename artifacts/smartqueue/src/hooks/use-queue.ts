import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, QueueInfo, Service, Token, TokenStatus } from '@/lib/types';

export function useServices(includeInactive = false, enabled = true) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);
  const refresh = useCallback(async () => {
    if (!supabase || !enabled) { setLoading(false); return; }
    if (!hasLoaded.current) setLoading(true);
    setError('');
    const result = await supabase.rpc('public_service_overview');
    if (result.error) setError(result.error.message);
    else setServices(((result.data ?? []) as Service[]).filter(service => includeInactive || service.is_active));
    hasLoaded.current = true;
    setLoading(false);
  }, [includeInactive, enabled]);
  useEffect(() => {
    void refresh();
    if (!supabase || !enabled) return;
    const channel = supabase.channel(`service-overview-${includeInactive ? 'admin' : 'user'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => { void refresh(); })
      .subscribe();
    const interval = window.setInterval(() => { void refresh(); }, 12000);
    return () => { window.clearInterval(interval); void supabase?.removeChannel(channel); };
  }, [refresh, includeInactive, enabled]);
  return { services, loading, error, refresh };
}

export function useTokens(userId?: string, all = false) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return; }
    setLoading(true); setError('');
    let query = supabase.from('tokens').select(all ? '*, profile:profiles!tokens_user_id_fkey(full_name,email)' : '*').order('created_at', { ascending: false }).limit(all ? 1000 : 60);
    if (all) query = query.in('status', ['WAITING', 'CALLED', 'SERVING']);
    else query = query.eq('user_id', userId);
    const { data, error: queryError } = await query;
    if (queryError) setError(queryError.message); else setTokens((data ?? []) as unknown as Token[]);
    setLoading(false);
  }, [userId, all]);
  useEffect(() => {
    void refresh();
    if (!supabase || !userId) return;
    const channel = supabase.channel(`tokens-${all ? 'admin' : userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [refresh, userId, all]);
  return { tokens, loading, error, refresh };
}

export function useActiveTokens(userId?: string) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('tokens').select('*')
      .eq('user_id', userId).in('status', ['WAITING', 'CALLED', 'SERVING']).order('created_at', { ascending: false });
    if (queryError) setError(queryError.message); else setTokens((data ?? []) as Token[]);
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    void refresh();
    if (!supabase || !userId) return;
    const channel = supabase.channel(`active-tokens-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens', filter: `user_id=eq.${userId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [refresh, userId]);
  return { tokens, loading, error, refresh };
}

export function useTokenHistory(userId: string | undefined, status: TokenStatus | 'ALL', ascending: boolean, page: number, pageSize = 12) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return; }
    setLoading(true); setError('');
    let query = supabase.from('tokens').select('*', { count: 'exact' }).eq('user_id', userId);
    if (status !== 'ALL') query = query.eq('status', status);
    const from = (page - 1) * pageSize;
    const { data, count, error: queryError } = await query.order('created_at', { ascending }).range(from, from + pageSize - 1);
    if (queryError) setError(queryError.message);
    else { setTokens((data ?? []) as Token[]); setTotal(count ?? 0); }
    setLoading(false);
  }, [userId, status, ascending, page, pageSize]);
  useEffect(() => {
    void refresh();
    if (!supabase || !userId) return;
    const channel = supabase.channel(`history-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tokens', filter: `user_id=eq.${userId}` }, () => { void refresh(); }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [refresh, userId]);
  return { tokens, total, loading, error, refresh };
}

export function useAdminProfiles(enabled = true) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || !enabled) { setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (queryError) setError(queryError.message); else setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }, [enabled]);
  useEffect(() => {
    void refresh();
    if (!supabase || !enabled) return;
    const channel = supabase.channel('admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [refresh, enabled]);
  return { profiles, loading, error, refresh };
}

export async function getQueueInfo(tokenId: string): Promise<QueueInfo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('user_token_details', { p_token_id: tokenId });
  if (error) throw error;
  if (!data) return null;
  return data as QueueInfo;
}

export function useLiveTokenDetails(tokenId: string) {
  const [details, setDetails] = useState<QueueInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setError('');
    try {
      const result = await getQueueInfo(tokenId);
      if (!result) throw new Error('Queue details were not returned.');
      setDetails(result);
      setLoading(false);
    } catch {
      setError('Live queue details are temporarily unavailable.');
      setLoading(false);
    }
  }, [tokenId]);
  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const channel = supabase.channel(`token-details-${tokenId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, () => { void refresh(); })
      .subscribe();
    const interval = window.setInterval(() => { void refresh(); }, 12000);
    return () => { window.clearInterval(interval); void supabase?.removeChannel(channel); };
  }, [refresh, tokenId]);
  return { details, loading, error, refresh };
}
