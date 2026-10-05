import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownRight, Building2, FileClock, LayoutDashboard, LogOut, Menu, Settings2, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToastMessage } from '@/lib/toast-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Brand } from './brand';

export function AppFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { profile, user } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToastMessage();
  const logout = async () => { await supabase?.auth.signOut(); toast('You are signed out.'); };
  const links = admin
    ? [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }, { href: '/admin/services', label: 'Services', icon: Building2 }, { href: '/admin/users', label: 'Users', icon: Users }]
    : [{ href: '/dashboard', label: 'Find a service', icon: LayoutDashboard }, { href: '/history', label: 'Token history', icon: FileClock }, { href: '/profile', label: 'My profile', icon: UserRound }];
  return <div className="app-layout">
    <aside className="sidebar"><Brand /><div className="side-label">{admin ? 'Operations' : 'Your account'}</div>
      {links.map(item => <Link key={item.href} href={item.href} className={`side-link ${location === item.href ? 'active' : ''}`} aria-current={location === item.href ? 'page' : undefined} data-testid={`link-nav-${item.href.replaceAll('/', '-')}`}><item.icon size={17} />{item.label}</Link>)}
      {admin && <Link href="/dashboard" className="side-link" data-testid="link-user-view"><ArrowDownRight size={17} />User view</Link>}
      <div className="side-bottom"><Link href="/profile" className="side-link" data-testid="link-account-settings"><Settings2 size={17} />Account settings</Link>
        <button className="side-link" onClick={() => void logout()} data-testid="button-logout" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }}><LogOut size={17} />Sign out</button></div>
    </aside>
    <div className="main-area"><header className="app-header">
      <button className="mobile-menu button outline small-btn" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} data-testid="button-mobile-menu"><Menu size={17} /></button>
      <div className="muted" style={{ fontSize: 13 }}>{admin ? 'Queue operations' : 'Your SmartQueue'}</div>
      <Link href="/profile" className="side-link" style={{ color: 'inherit', margin: 0 }} data-testid="link-profile-header"><span className="brand-mark" style={{ width: 30, height: 30 }}><UserRound size={15} /></span><span className="quiet-link">{profile?.full_name || user?.email}</span></Link>
    </header>
    {menuOpen && <nav className="mobile-nav" aria-label="App navigation">{links.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="side-link"><item.icon size={17} />{item.label}</Link>)}</nav>}
    <main className="main-content">{children}</main></div>
  </div>;
}

export function AuthGate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, profile, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!loading && !user) navigate('/login'); }, [loading, user, navigate]);
  if (!isSupabaseConfigured) return <SetupNoticeView />;
  if (loading) return <div className="loading" aria-live="polite"><div className="skeleton" style={{ width: 'min(560px,90%)' }} /></div>;
  if (!user) return <div className="loading">Taking you to sign in…</div>;
  if (!profile) return <main className="setup-screen"><div className="setup-card"><h1>Profile setup needed</h1><p className="muted">Your account is authenticated, but its profile could not be loaded. Please contact your service administrator.</p><button className="button" onClick={() => void supabase?.auth.signOut()} data-testid="button-profile-setup-sign-out">Sign out</button></div></main>;
  if (admin && profile.role !== 'admin') return <main className="setup-screen"><div className="setup-card"><ShieldCheck size={26} /><h1>Operations access required</h1><p className="muted">This area is available to authorized queue staff only.</p><Link className="button" href="/dashboard">Return to your dashboard</Link></div></main>;
  return <>{children}</>;
}

function SetupNoticeView() {
  return <main className="setup-screen"><section className="setup-card"><Brand /><h1>Connect your queue.</h1><p className="muted">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable SmartQueue.</p></section></main>;
}
