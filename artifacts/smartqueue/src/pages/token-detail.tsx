import { useEffect, useState } from 'react';
import { RefreshCw, Ticket } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { useTokens } from '@/hooks/use-queue';
import { useAuth } from '@/hooks/use-auth';
import { getQueueInfo } from '@/hooks/use-queue';
import { formatDate, friendlyError, prettyStatus } from '@/lib/format';
import { useToastMessage } from '@/lib/toast-context';
import { supabase } from '@/lib/supabase';
import type { QueueInfo, Token } from '@/lib/types';

function Status({ status }: { status: Token['status'] }) {
  return <span className={`status ${status.toLowerCase()}`} data-testid={`status-token-${status.toLowerCase()}`}>{prettyStatus(status)}</span>;
}

export default function TokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { tokens, loading, error, refresh } = useTokens(user?.id);
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [queueError, setQueueError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useToastMessage();
  const token = tokens.find(item => item.id === id);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (!token || !supabase) { setQueue(null); return; }
      setQueueError('');
      void getQueueInfo(token.id).then(value => { if (alive) setQueue(value); }).catch(errorValue => { if (alive) setQueueError(friendlyError(errorValue instanceof Error ? errorValue.message : undefined)); });
    };
    load();
    const interval = token && supabase ? window.setInterval(load, 12000) : undefined;
    return () => { alive = false; if (interval) window.clearInterval(interval); };
  }, [token]);
  const cancel = async () => {
    if (!token || !supabase || !window.confirm(`Cancel ticket ${token.token_number}? This cannot be undone.`)) return;
    setBusy(true); setMessage('');
    const { data, error: rpcError } = await supabase.rpc('cancel_token', { p_token_id: token.id });
    setBusy(false);
    if (rpcError || data !== true) setMessage(friendlyError(rpcError?.message));
    else { toast('Ticket cancelled.'); await refresh(); }
  };
  return <AuthGate><AppFrame><div className="page-heading"><div><div className="eyebrow">Live queue ticket</div><h1>Your place in line.</h1></div><button className="button outline small-btn" onClick={() => void refresh()} data-testid="button-refresh-token"><RefreshCw size={14} /> Refresh</button></div>
    {loading ? <div className="skeleton" /> : error ? <div className="form-error" role="alert">{friendlyError(error)} <button className="button outline small-btn" onClick={() => void refresh()}>Try again</button></div> : !token ? <div className="empty"><Ticket size={25} /><h3>Ticket not found</h3><p>This ticket may no longer be available in your account.</p><Link href="/history" className="button outline">View token history</Link></div> : <section className="card" style={{ maxWidth: 760, padding: 'clamp(22px,5vw,42px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15 }}><span className="eyebrow">{queue?.service_name || 'Service queue'}</span><Status status={token.status} /></div>
      <div className="token-big" data-testid="value-token-number">{token.token_number}</div><p className="muted">Joined {formatDate(token.created_at)}</p>
      {['WAITING', 'CALLED', 'SERVING'].includes(token.status) && <div className="queue-line" aria-live="polite"><span>Position <strong data-testid="value-queue-position">{queue?.queue_position ?? '—'}</strong></span><span>People ahead <strong data-testid="value-people-ahead">{queue?.people_ahead ?? '—'}</strong></span><span>Estimated wait <strong data-testid="value-wait-time">{queue ? `${queue.estimated_wait_minutes} min` : 'Updating…'}</strong></span><span>Now serving <strong data-testid="value-current-token">{queue?.current_serving_token ?? '—'}</strong></span></div>}
      {queueError && <div className="form-error" role="alert">{queueError}<button className="button outline small-btn" onClick={() => { setQueue(null); void getQueueInfo(token.id).then(setQueue).catch(() => setQueueError('Queue details are temporarily unavailable.')); }} data-testid="button-retry-queue-details">Retry details</button></div>}
      {token.status === 'CALLED' && <div className="notice info" role="status" style={{ marginTop: 22 }}>Your turn is being called. Please make your way to the service desk.</div>}
      {token.status === 'SERVING' && <div className="notice info" role="status" style={{ marginTop: 22 }}>You are being served now.</div>}
      {message && <div className="form-error" role="alert">{message}</div>}
      {['WAITING', 'CALLED'].includes(token.status) && <button className="button danger" style={{ marginTop: 22 }} onClick={() => void cancel()} disabled={busy} data-testid="button-cancel-token">{busy ? 'Cancelling…' : 'Cancel ticket'}</button>}
      <div style={{ paddingTop: 20, marginTop: 22, borderTop: '1px solid hsl(var(--border))', display: 'flex', gap: 10, flexWrap: 'wrap' }}><Link href="/dashboard" className="button outline">Find another service</Link><Link href="/history" className="button outline">Token history</Link></div>
    </section>}
  </AppFrame></AuthGate>;
}
