import { useState } from 'react';
import type { FormEvent } from 'react';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { useAuth } from '@/hooks/use-auth';
import { useToastMessage } from '@/lib/toast-context';
import { friendlyError } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useToastMessage();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !user) return;
    setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const values = { full_name: String(form.get('full_name')).trim(), phone: String(form.get('phone')).trim(), date_of_birth: String(form.get('date_of_birth') || '') || null, gender: String(form.get('gender') || '') || null, address: String(form.get('address') || '') || null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').update(values).eq('id', user.id);
    setBusy(false);
    if (error) setMessage(friendlyError(error.message)); else { await refreshProfile(); toast('Your profile has been saved.'); }
  }
  return <AuthGate><AppFrame><div className="page-heading"><div><div className="eyebrow">Personal details</div><h1>My profile.</h1></div></div>
    <section className="form-panel" style={{ maxWidth: 700 }}><p className="muted">Keep your contact details up to date for your queue account.</p><form onSubmit={event => void save(event)}>
      <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required minLength={2} defaultValue={profile?.full_name} data-testid="input-profile-full-name" /></div>
      <div className="field"><label htmlFor="profile-email">Email address</label><input id="profile-email" value={profile?.email || user?.email || ''} readOnly data-testid="input-profile-email" /><small className="muted">Email changes are managed by your account provider.</small></div>
      <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" pattern="\+?[0-9\s().-]{7,20}" defaultValue={profile?.phone || ''} data-testid="input-profile-phone" /></div>
      <div className="field"><label htmlFor="date_of_birth">Date of birth</label><input id="date_of_birth" name="date_of_birth" type="date" defaultValue={profile?.date_of_birth || ''} data-testid="input-profile-birth-date" /></div>
      <div className="field"><label htmlFor="gender">Gender</label><select name="gender" id="gender" defaultValue={profile?.gender || ''} data-testid="select-profile-gender"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non-binary">Non-binary</option><option value="other">Other</option></select></div>
      <div className="field"><label htmlFor="address">Address</label><textarea id="address" name="address" defaultValue={profile?.address || ''} data-testid="input-profile-address" /></div>
      {message && <div className="form-error" role="alert">{message}</div>}
      <button className="button" type="submit" disabled={busy} data-testid="button-save-profile">{busy ? 'Saving…' : 'Save profile'}</button>
    </form></section>
  </AppFrame></AuthGate>;
}
