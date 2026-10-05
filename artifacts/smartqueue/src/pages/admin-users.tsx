import { useAuth } from '@/hooks/use-auth';
import { useAdminProfiles } from '@/hooks/use-queue';
import { AppFrame, AuthGate } from '@/components/app-frame';
import { formatDate, friendlyError } from '@/lib/format';
import { RefreshCw, Users } from 'lucide-react';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { profiles, loading, error, refresh } = useAdminProfiles(!!user);
  return <AuthGate admin><AppFrame admin>
    <div className="page-heading"><div><div className="eyebrow">Account directory</div><h1>Users.</h1><p className="muted">Profiles visible to operations staff under your access policy.</p></div>
      <button className="button outline small-btn" onClick={() => void refresh()} data-testid="button-refresh-users"><RefreshCw size={14} /> Refresh</button>
    </div>
    {loading ? <div className="skeleton" aria-label="Loading users" /> : error ? <div className="empty" role="alert"><h3>Users could not load</h3><p>{friendlyError(error)}</p><button className="button outline" onClick={() => void refresh()}>Try again</button></div> : profiles.length === 0 ? <div className="empty"><Users size={25} /><h3>No profiles available</h3><p>Profiles visible to your operations account will appear here.</p></div> : <div className="card table-wrap">
      <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Created</th></tr></thead>
        <tbody>{profiles.map(profile => <tr key={profile.id} data-testid={`row-profile-${profile.id}`}>
          <td><strong data-testid={`value-user-name-${profile.id}`}>{profile.full_name}</strong></td>
          <td>{profile.email}</td><td>{profile.phone || '—'}</td>
          <td><span className={`status ${profile.role === 'admin' ? 'called' : 'completed'}`}>{profile.role === 'admin' ? 'Admin' : 'User'}</span></td>
          <td>{formatDate(profile.created_at)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </AppFrame></AuthGate>;
}
