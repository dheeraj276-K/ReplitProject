import { Activity } from 'lucide-react';
import { Link } from 'wouter';

export function Brand() {
  return <Link href="/" className="brand" aria-label="SmartQueue home" data-testid="link-home">
    <span className="brand-mark"><Activity size={17} strokeWidth={2.6} /></span><span>smartqueue</span>
  </Link>;
}

export function SetupNotice() {
  return <main className="setup-screen"><section className="setup-card">
    <Brand /><p className="eyebrow" style={{ marginTop: 32 }}>One last connection</p>
    <h1>Connect your queue.</h1>
    <p className="muted" style={{ lineHeight: 1.7 }}>SmartQueue is ready for its Supabase project. Add the public project URL and anon key to the frontend environment before signing in or joining a live queue.</p>
    <div className="notice info" role="status">Required environment: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. No queue data is mocked or stored locally.</div>
    <p className="muted" style={{ fontSize: 13 }}>The anon key is safe to use in a browser when your database is protected by Row Level Security. Never add a service-role key here.</p>
  </section></main>;
}
