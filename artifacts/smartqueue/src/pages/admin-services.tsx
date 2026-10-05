import { useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Plus, X } from 'lucide-react';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { useAuth } from '@/hooks/use-auth';
import { useServices } from '@/hooks/use-queue';
import { useToastMessage } from '@/lib/toast-context';
import { friendlyError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/lib/types';

export default function AdminServicesPage() {
  const { user } = useAuth();
  const { services, loading, error, refresh } = useServices(true, !!user);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useToastMessage();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const values = { name: String(form.get('name')).trim(), description: String(form.get('description')).trim(), department: String(form.get('department')).trim(), prefix: String(form.get('prefix')).trim().toUpperCase(), average_service_time_minutes: Number(form.get('average_service_time_minutes')), max_daily_tokens: Number(form.get('max_daily_tokens')), is_active: form.get('is_active') === 'on', updated_at: new Date().toISOString() };
    const query = editing ? supabase.from('services').update(values).eq('id', editing.id) : supabase.from('services').insert(values);
    const { error: saveError } = await query;
    setBusy(false);
    if (saveError) { setMessage(friendlyError(saveError.message)); return; }
    toast(editing ? 'Service updated.' : 'Service created.'); setEditing(null); setCreating(false); await refresh();
  };
  const setActive = async (service: Service, is_active: boolean) => {
    if (!supabase) return;
    if (!is_active && !window.confirm(`Deactivate ${service.name}? It will no longer be available for new tickets.`)) return;
    setBusy(true);
    const { error: updateError } = await supabase.from('services').update({ is_active, updated_at: new Date().toISOString() }).eq('id', service.id);
    setBusy(false);
    if (updateError) setMessage(friendlyError(updateError.message));
    else { toast(is_active ? 'Service activated.' : 'Service deactivated.'); await refresh(); }
  };
  const form = (service?: Service) => <form onSubmit={event => void save(event)} className="card" style={{ marginBottom: 22, maxWidth: 760 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 className="card-title">{service ? 'Edit service' : 'New service'}</h2><button type="button" className="button outline small-btn" onClick={() => { setEditing(null); setCreating(false); }} aria-label="Close service form" data-testid="button-close-service-form"><X size={15} /></button></div>
    <div className="service-grid"><div className="field"><label htmlFor="service-name">Service name</label><input id="service-name" name="name" required defaultValue={service?.name || ''} data-testid="input-service-name" /></div><div className="field"><label htmlFor="service-department">Department</label><input id="service-department" name="department" required defaultValue={service?.department || ''} data-testid="input-service-department" /></div>
      <div className="field"><label htmlFor="service-prefix">Ticket prefix</label><input id="service-prefix" name="prefix" required maxLength={8} defaultValue={service?.prefix || ''} data-testid="input-service-prefix" /></div><div className="field"><label htmlFor="service-time">Average service time (minutes)</label><input id="service-time" name="average_service_time_minutes" type="number" min="1" required defaultValue={service?.average_service_time_minutes ?? 10} data-testid="input-service-average-time" /></div>
      <div className="field"><label htmlFor="service-max">Maximum daily tickets</label><input id="service-max" name="max_daily_tokens" type="number" min="1" required defaultValue={service?.max_daily_tokens ?? 100} data-testid="input-service-max-tokens" /></div>
      <div className="field"><label htmlFor="service-description">Description</label><textarea id="service-description" name="description" defaultValue={service?.description || ''} data-testid="input-service-description" /></div></div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, margin: '8px 0 20px' }}><input type="checkbox" name="is_active" defaultChecked={service?.is_active ?? true} data-testid="input-service-active" /> Available for new tickets</label>
    {message && <div className="form-error" role="alert">{message}</div>}<button className="button" disabled={busy} type="submit" data-testid="button-save-service">{busy ? 'Saving…' : service ? 'Save changes' : 'Create service'}</button>
  </form>;
  return <AuthGate admin><AppFrame admin><div className="page-heading"><div><div className="eyebrow">Operations setup</div><h1>Services.</h1><p className="muted">Manage the services customers can join.</p></div><button className="button" onClick={() => { setCreating(true); setEditing(null); setMessage(''); }} data-testid="button-new-service"><Plus size={17} /> Add service</button></div>
    {message && !creating && !editing && <div className="form-error" role="alert">{message}</div>}{(creating || editing) && form(editing || undefined)}
    {loading ? <div className="skeleton" /> : error ? <div className="empty" role="alert"><h3>Services could not load</h3><p>{friendlyError(error)}</p><button className="button outline" onClick={() => void refresh()}>Try again</button></div> : services.length === 0 ? <div className="empty"><Building2 size={24} /><h3>No services configured</h3><p>Create a service to make the first queue available.</p><button className="button" onClick={() => setCreating(true)}>Add a service</button></div> : <div className="card table-wrap"><table><thead><tr><th>Service</th><th>Department</th><th>Prefix</th><th>Daily limit</th><th>Queue</th><th>Status</th><th>Actions</th></tr></thead><tbody>{services.map(service => <tr key={service.id} data-testid={`row-service-${service.id}`}><td><strong>{service.name}</strong><div className="muted" style={{ fontSize: 12 }}>{service.description}</div></td><td>{service.department}</td><td>{service.prefix}</td><td>{service.max_daily_tokens}</td><td>{service.queue_size}</td><td><span className={`status ${service.is_active ? 'serving' : 'cancelled'}`}>{service.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="row-actions"><button className="button outline small-btn" onClick={() => { setEditing(service); setCreating(false); setMessage(''); }} data-testid={`button-edit-service-${service.id}`}>Edit</button>{service.is_active ? <button className="button outline small-btn" disabled={busy} onClick={() => void setActive(service, false)} data-testid={`button-deactivate-service-${service.id}`}>Deactivate</button> : <button className="button small-btn" disabled={busy} onClick={() => void setActive(service, true)} data-testid={`button-activate-service-${service.id}`}>Activate</button>}</div></td></tr>)}</tbody></table></div>}
  </AppFrame></AuthGate>;
}
