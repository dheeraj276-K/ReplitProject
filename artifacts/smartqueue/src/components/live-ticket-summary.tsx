import { Link } from 'wouter';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useLiveTokenDetails } from '@/hooks/use-queue';
import { prettyStatus } from '@/lib/format';
import type { Token } from '@/lib/types';

export function LiveTicketSummary({ token }: { token: Token }) {
  const { details, loading, error, refresh } = useLiveTokenDetails(token.id);
  const status = details?.status ?? token.status;
  return <article className="card" data-testid={`card-active-ticket-${token.id}`} style={{ background: '#e6eee8', borderColor: '#d3e1d7' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div><div className="eyebrow">{details?.service_name || 'Active service'}</div>
        <div className="token-big" style={{ fontSize: 38 }} data-testid={`value-active-ticket-${token.id}`}>{token.token_number}</div>
      </div>
      <span className={`status ${status.toLowerCase()}`} data-testid={`status-active-ticket-${token.id}`}>{prettyStatus(status)}</span>
    </div>
    {loading && !details ? <div className="skeleton" style={{ height: 42 }} aria-label="Loading queue position" /> : error ? <div className="form-error" role="alert">{error}<button className="button outline small-btn" onClick={() => void refresh()} data-testid={`button-refresh-ticket-details-${token.id}`}><RefreshCw size={13} /> Retry</button></div> : <div className="queue-line" aria-live="polite">
      <span>Position <strong data-testid={`value-ticket-position-${token.id}`}>{details?.queue_position ?? '—'}</strong></span>
      <span>People ahead <strong data-testid={`value-ticket-ahead-${token.id}`}>{details?.people_ahead ?? '—'}</strong></span>
      <span>Estimated wait <strong data-testid={`value-ticket-wait-${token.id}`}>{details ? `${details.estimated_wait_minutes} min` : '—'}</strong></span>
      <span>Now serving <strong data-testid={`value-ticket-serving-${token.id}`}>{details?.current_serving_token ?? '—'}</strong></span>
    </div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
      <Link className="button" href={`/token/${token.id}`} data-testid={`link-view-ticket-${token.id}`}>View live ticket <ArrowRight size={14} /></Link>
    </div>
  </article>;
}
