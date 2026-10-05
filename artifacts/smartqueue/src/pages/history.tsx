import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileClock, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { useAuth } from '@/hooks/use-auth';
import { useServices, useTokenHistory } from '@/hooks/use-queue';
import { formatDate, friendlyError, prettyStatus } from '@/lib/format';
import type { TokenStatus } from '@/lib/types';

const PAGE_SIZE = 10;
const statuses: (TokenStatus | 'ALL')[] = ['ALL', 'WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED', 'EXPIRED'];

function TokenStatus({ status }: { status: Exclude<TokenStatus, 'ALL'> }) {
  return <span className={`status ${status.toLowerCase()}`}>{prettyStatus(status)}</span>;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<TokenStatus | 'ALL'>('ALL');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const { tokens, total, loading, error, refresh } = useTokenHistory(user?.id, filter, ascending, page, PAGE_SIZE);
  const { services } = useServices(true, !!user);
  const serviceMap = useMemo(() => new Map(services.map(service => [service.id, service.name])), [services]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const setFilterAndReset = (next: TokenStatus | 'ALL') => { setFilter(next); setPage(1); };
  return <AuthGate><AppFrame><div className="page-heading"><div><div className="eyebrow">Your queue activity</div><h1>Token history.</h1></div><button className="button outline small-btn" onClick={() => void refresh()} data-testid="button-refresh-history"><RefreshCw size={14} /> Refresh</button></div>
    <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
      <div className="field" style={{ margin: 0, minWidth: 190 }}><label htmlFor="history-filter">Filter by status</label><select id="history-filter" value={filter} onChange={event => setFilterAndReset(event.target.value as TokenStatus | 'ALL')} data-testid="select-history-status">{statuses.map(status => <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : prettyStatus(status)}</option>)}</select></div>
      <button className="button outline" onClick={() => { setAscending(value => !value); setPage(1); }} aria-label={`Sort by date ${ascending ? 'newest first' : 'oldest first'}`} data-testid="button-history-sort">Date: {ascending ? 'Oldest first' : 'Newest first'}</button>
      <span className="muted" style={{ fontSize: 13 }} data-testid="text-history-count">{total} {total === 1 ? 'ticket' : 'tickets'}</span>
    </div>
    {loading ? <div className="skeleton" /> : error ? <div className="empty" role="alert"><h3>History is unavailable</h3><p>{friendlyError(error)}</p><button className="button outline" onClick={() => void refresh()}>Try again</button></div> : tokens.length === 0 ? <div className="empty"><FileClock size={25} /><h3>{filter === 'ALL' ? 'Your history starts here' : 'No tickets match this status'}</h3><p>{filter === 'ALL' ? 'Tickets you join will appear here, along with their latest status.' : 'Choose another status filter to see more activity.'}</p>{filter === 'ALL' && <Link href="/dashboard" className="button">Find a service</Link>}</div> : <div className="card table-wrap"><table><thead><tr><th>Ticket</th><th>Service</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>{tokens.map(token => <tr key={token.id} data-testid={`row-token-${token.id}`}><td><strong>{token.token_number}</strong></td><td>{serviceMap.get(token.service_id) || 'Service'}</td><td>{formatDate(token.created_at)}</td><td><TokenStatus status={token.status} /></td><td><Link href={`/token/${token.id}`} className="button outline small-btn" data-testid={`link-token-${token.id}`}>{['WAITING','CALLED','SERVING'].includes(token.status) ? 'Follow live' : 'Details'} <ChevronRight size={14} /></Link></td></tr>)}</tbody></table>
      <div className="pagination" aria-label="History pages"><span className="muted" data-testid="text-history-page">Page {page} of {pages}</span><div><button className="button outline small-btn" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)} data-testid="button-history-previous"><ChevronLeft size={14} /> Previous</button><button className="button outline small-btn" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)} data-testid="button-history-next">Next <ChevronRight size={14} /></button></div></div>
    </div>}
  </AppFrame></AuthGate>;
}
