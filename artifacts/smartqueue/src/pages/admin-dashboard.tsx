import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Settings2, Users } from 'lucide-react';
import { Link } from 'wouter';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { useAuth } from '@/hooks/use-auth';
import { useServices, useTokens } from '@/hooks/use-queue';
import { useToastMessage } from '@/lib/toast-context';
import { formatDate, friendlyError, prettyStatus } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Token, TokenStatus } from '@/lib/types';

function Status({ status }: { status: TokenStatus }) {
  return <span className={`status ${status.toLowerCase()}`} data-testid={`status-token-${status.toLowerCase()}`}>{prettyStatus(status)}</span>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { tokens, loading, error, refresh } = useTokens(user?.id, true);
  const { services, refresh: refreshServices } = useServices(true, !!user);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const toast = useToastMessage();
  const refreshSummary = async () => {
    if (!supabase) return;
    const { data, error: rpcError } = await supabase.rpc('admin_dashboard_summary');
    if (rpcError) setMessage(friendlyError(rpcError.message));
    else if (data) setSummary(data as Record<string, number>);
  };
  useEffect(() => { if (user) void refreshSummary(); }, [user]);
  const act = async (token: Token, next: TokenStatus) => {
    if (!supabase) return;
    setBusy(token.id); setMessage('');
    const { data, error: rpcError } = await supabase.rpc('admin_set_token_status', { p_token_id: token.id, p_status: next });
    setBusy('');
    if (rpcError || data !== true) setMessage(friendlyError(rpcError?.message));
    else { toast(`Ticket ${token.token_number} marked ${prettyStatus(next).toLowerCase()}.`); await refresh(); await refreshSummary(); }
  };
  const callNext = async (serviceId: string) => {
    if (!supabase) return;
    setBusy(serviceId); setMessage('');
    const { data, error: rpcError } = await supabase.rpc('admin_call_next', { p_service_id: serviceId });
    setBusy('');
    if (rpcError) setMessage(friendlyError(rpcError.message));
    else if (!data) toast('There are no waiting tickets for this service.');
    else { toast('Next ticket called.'); await refresh(); await refreshSummary(); await refreshServices(); }
  };
  const cancel = async (token: Token) => {
    if (!supabase || !window.confirm(`Cancel ticket ${token.token_number}? This cannot be undone.`)) return;
    setBusy(token.id); setMessage('');
    const { data, error: rpcError } = await supabase.rpc('admin_set_token_status', {
      p_token_id: token.id,
      p_status: 'CANCELLED',
    });
    setBusy('');
    if (rpcError || data !== true) setMessage(friendlyError(rpcError?.message));
    else { toast(`Ticket ${token.token_number} cancelled.`); await refresh(); await refreshSummary(); }
  };
  const metrics = [{ label: "Today's tickets", key: 'today_tokens' }, { label: 'Active queue', key: 'active_tokens' }, { label: 'Completed', key: 'completed_tokens' }, { label: 'Cancelled', key: 'cancelled_tokens' }, { label: 'Avg. wait (min)', key: 'average_wait_minutes' }];
  const activeTokens = tokens.filter(token => ['WAITING','CALLED','SERVING'].includes(token.status));
  return <AuthGate admin><AppFrame admin><div className="page-heading"><div><div className="eyebrow">Live operations</div><h1>Queue overview.</h1><p className="muted">Keep the line moving, one ticket at a time.</p></div><button className="button outline small-btn" onClick={() => { void refresh(); void refreshSummary(); void refreshServices(); }} data-testid="button-refresh-admin"><RefreshCw size={14} /> Refresh</button></div>
    <div className="metric-grid">{metrics.map(metric => <div className="metric" key={metric.key}><div className="metric-label">{metric.label}</div><div className="metric-value" data-testid={`value-${metric.key}`}>{summary?.[metric.key] ?? '—'}</div></div>)}</div>
    {message && <div className="form-error" role="alert" data-testid="text-admin-error">{message}</div>}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '30px 0 14px', gap: 12 }}><div><h2 className="card-title" style={{ fontSize: 22 }}>Active tickets</h2><p className="muted" style={{ margin: 0, fontSize: 13 }}>Current statuses update in real time.</p></div><Link className="button outline small-btn" href="/admin/services" data-testid="link-manage-services"><Settings2 size={14} /> Manage services</Link></div>
    {loading ? <div className="skeleton" /> : error ? <div className="empty" role="alert"><h3>Queue could not load</h3><p>{friendlyError(error)}</p><button className="button outline" onClick={() => void refresh()}>Try again</button></div> : <div className="card table-wrap"><table><thead><tr><th>Ticket</th><th>Customer</th><th>Service</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{activeTokens.map(token => <tr key={token.id} data-testid={`row-admin-token-${token.id}`}><td><strong>{token.token_number}</strong></td><td><strong>{token.profile?.full_name || 'Customer'}</strong>{token.profile?.email && <div className="muted" style={{ fontSize: 12 }}>{token.profile.email}</div>}</td><td>{services.find(service => service.id === token.service_id)?.name || 'Service'}</td><td><Status status={token.status} /></td><td>{formatDate(token.created_at)}</td><td><div className="row-actions">
      {token.status === 'WAITING' && <button className="button small-btn" disabled={busy === token.id} onClick={() => void act(token, 'CALLED')} data-testid={`button-call-${token.id}`}>Call</button>}
      {token.status === 'CALLED' && <button className="button small-btn" disabled={busy === token.id} onClick={() => void act(token, 'SERVING')} data-testid={`button-serve-${token.id}`}>Start service</button>}
      {token.status === 'SERVING' && <button className="button small-btn" disabled={busy === token.id} onClick={() => void act(token, 'COMPLETED')} data-testid={`button-complete-${token.id}`}>Complete</button>}
      {['WAITING','CALLED'].includes(token.status) && <><button className="button outline small-btn" disabled={busy === token.id} onClick={() => void act(token, 'SKIPPED')} data-testid={`button-skip-${token.id}`}>Skip</button><button className="button danger small-btn" disabled={busy === token.id} onClick={() => void cancel(token)} data-testid={`button-cancel-${token.id}`}>Cancel</button></>}
    </div></td></tr>)}</tbody></table>
    {activeTokens.length === 0 && <div className="empty" style={{ margin: 14 }}><Users size={24} /><h3>No active tickets</h3><p>The active queue is clear. New tickets will appear here.</p></div>}</div>}
    <div style={{ marginTop: 28 }}><h2 className="card-title" style={{ fontSize: 22 }}>Call next by service</h2><p className="muted" style={{ fontSize: 13 }}>The next waiting ticket will be called for the selected service.</p><div className="service-grid" style={{ marginTop: 14 }}>{services.filter(service => service.is_active).map(service => <div className="card" key={service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><div style={{ fontWeight: 700 }}>{service.name}</div><div className="muted" style={{ fontSize: 12 }}>{service.department} · {service.queue_size} waiting</div></div><button className="button small-btn" onClick={() => void callNext(service.id)} disabled={busy === service.id} data-testid={`button-call-next-${service.id}`}>{busy === service.id ? 'Calling…' : 'Call next'} <ArrowRight size={14} /></button></div>)}</div></div>
  </AppFrame></AuthGate>;
}
