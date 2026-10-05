import { useState } from 'react';
import { ArrowRight, Building2, CircleHelp, Clock3, RefreshCw } from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { useAuth } from '@/hooks/use-auth';
import { useActiveTokens, useServices } from '@/hooks/use-queue';
import { useToastMessage } from '@/lib/toast-context';
import { friendlyError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { QueueInfo, Service } from '@/lib/types';
import { LiveTicketSummary } from '@/components/live-ticket-summary';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [, navigate] = useLocation();
  const { services, loading, error, refresh } = useServices(false, !!user);
  const { tokens, loading: activeLoading, error: activeError, refresh: refreshTokens } = useActiveTokens(user?.id);
  const [busyService, setBusyService] = useState('');
  const [notice, setNotice] = useState('');
  const toast = useToastMessage();
  const activeByService = new Map<string, (typeof tokens)[number]>();
  for (const token of tokens) {
    if (['WAITING', 'CALLED', 'SERVING'].includes(token.status) && !activeByService.has(token.service_id)) {
      activeByService.set(token.service_id, token);
    }
  }
  const activeTickets = [...activeByService.values()];
  const join = async (service: Service) => {
    if (!supabase) return;
    if (activeByService.has(service.id)) { setNotice(`You already have an active ticket for ${service.name}. Follow or cancel it before joining this service again.`); return; }
    setBusyService(service.id); setNotice('');
    const { data, error: rpcError } = await supabase.rpc('generate_token', { p_service_id: service.id });
    setBusyService('');
    if (rpcError) { setNotice(friendlyError(rpcError.message)); return; }
    const payload = data as (QueueInfo & { id: string }) | null;
    if (!payload?.id) { setNotice('We could not create your ticket. Refresh the page and try again.'); return; }
    await refreshTokens();
    toast(`Ticket ${payload.token_number} joined the queue.`);
    navigate(`/token/${payload.id}`);
  };
  return <AuthGate><AppFrame><div className="page-heading"><div><div className="eyebrow">Good to see you{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</div><h1>Find a service.</h1></div><button className="button outline small-btn" onClick={() => { void refresh(); void refreshTokens(); }} data-testid="button-refresh-services"><RefreshCw size={14} /> Refresh</button></div>
    {activeTickets.length > 0 && <section aria-label="Your active tickets" style={{ marginBottom: 26 }}>
      <div className="page-heading" style={{ marginBottom: 14 }}><div><div className="eyebrow">Your active queues</div><h2 className="card-title" style={{ fontSize: 22 }}>Places you are holding.</h2></div></div>
      <div style={{ display: 'grid', gap: 12 }}>{activeTickets.map(token => <LiveTicketSummary key={token.id} token={token} />)}</div>
    </section>}
    {activeError && <div className="form-error" role="alert" data-testid="text-active-ticket-error">{friendlyError(activeError)} <button className="button outline small-btn" onClick={() => void refreshTokens()}>Retry</button></div>}
    {notice && <div className="form-error" role="alert" data-testid="text-queue-message">{notice}</div>}
    <div className="page-heading" style={{ marginBottom: 16 }}><div><h2 className="card-title" style={{ fontSize: 22 }}>Available services</h2><p className="muted" style={{ margin: '5px 0 0', fontSize: 13 }}>Choose a department to see your place in line.</p></div></div>
    {loading ? <div className="service-grid">{[0,1,2,3].map(i => <div key={i} className="skeleton" />)}</div> : error ? <div className="empty" role="alert"><CircleHelp size={22} /><h3>Services could not load</h3><p>{friendlyError(error)}</p><button className="button outline" onClick={() => void refresh()}>Try again</button></div> : services.length === 0 ? <div className="empty"><Building2 size={25} /><h3>No services are open right now</h3><p>Please check back later or refresh this page.</p><button className="button outline" onClick={() => void refresh()}>Refresh services</button></div> : <div className="service-grid">{services.map(service => <article className="service-card" key={service.id} data-testid={`card-service-${service.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span className="service-icon"><Building2 size={19} /></span><span className="eyebrow" style={{ fontSize: 10 }}>{service.department}</span></div>
      <h3>{service.name}</h3><p className="muted" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>{service.description || 'Join the queue for this service.'}</p>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }} data-testid={`value-queue-size-${service.id}`}><strong>{service.queue_size}</strong> {service.queue_size === 1 ? 'person waiting' : 'people waiting'}{service.current_serving_token ? ` · Serving ${service.current_serving_token}` : ''}</p>
      <div className="service-bottom"><span className="muted" style={{ fontSize: 12 }}><Clock3 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />About {service.average_service_time_minutes} min per person</span>{activeByService.has(service.id) ? <Link className="button secondary small-btn" href={`/token/${activeByService.get(service.id)!.id}`} data-testid={`link-view-service-token-${service.id}`}>View token <ArrowRight size={14} /></Link> : <button className="button small-btn" disabled={activeLoading || !!activeError || busyService === service.id} onClick={() => void join(service)} data-testid={`button-join-${service.id}`}>{busyService === service.id ? 'Joining…' : activeLoading ? 'Checking tickets…' : 'Join queue'} <ArrowRight size={14} /></button>}</div>
    </article>)}</div>}
  </AppFrame></AuthGate>;
}
