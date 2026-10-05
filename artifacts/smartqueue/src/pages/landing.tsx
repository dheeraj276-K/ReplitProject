import { ArrowRight, Ticket } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Brand } from '@/components/brand';

function SiteNav() {
  const { user } = useAuth();
  return <header className="topbar"><Brand /><nav className="navlinks" aria-label="Main navigation">
    <a className="quiet-link" href="#how-it-works" data-testid="link-how-it-works">How it works</a>
    {user ? <Link href="/dashboard" className="button small-btn" data-testid="link-dashboard">Go to dashboard <ArrowRight size={15} /></Link> : <>
      <Link href="/login" className="quiet-link" data-testid="link-sign-in">Sign in</Link><Link href="/register" className="button small-btn" data-testid="link-create-account">Create account <ArrowRight size={15} /></Link>
    </>}
  </nav></header>;
}

export default function LandingPage() {
  const { user } = useAuth();
  return <div className="shell">
    <SiteNav />
    {!isSupabaseConfigured && <div className="notice info" role="status" style={{ margin: '20px auto', maxWidth: 900 }}>Setup needed: connect Supabase to enable secure accounts and live queue data.</div>}
    <main>
      <section className="hero">
        <div><div className="eyebrow">Your time is worth more than a waiting room</div>
          <h1>Wait where<br />life <em>happens.</em></h1>
          <p className="hero-copy">Join a service queue from wherever you are. Keep an eye on your place, and head in when it is nearly your turn.</p>
          <div className="hero-actions"><Link className="button" href={user ? '/dashboard' : '/register'} data-testid="link-find-service">Find a service <ArrowRight size={17} /></Link><Link className="button outline" href="/login" data-testid="link-landing-login">Sign in to your account</Link></div>
        </div>
        <div className="visual" aria-label="Illustration of a live queue ticket">
          <div className="ticket"><div className="ticket-head"><span>TICKET PREVIEW · EXAMPLE</span><Ticket size={17} /></div><div className="ticket-number">A-024</div><span className="ticket-status"><i className="pulse" /> Example queue status</span><div className="ticket-row"><span>People ahead</span><strong>3 people</strong></div><div className="ticket-row" style={{ marginTop: 0 }}><span>Estimated wait</span><strong>~18 min</strong></div></div>
        </div>
      </section>
      <section className="section" id="how-it-works"><div className="eyebrow">A better way to wait</div><h2 className="section-title">Your place in line.<br />Without the line.</h2>
        <div className="steps"><article className="step"><span className="step-index">01 / Choose</span><h3>Find your service</h3><p>See available departments and join the queue that fits what you need.</p></article>
          <article className="step"><span className="step-index">02 / Join</span><h3>Take your place</h3><p>Get a live ticket with your queue position and a helpful wait estimate.</p></article>
          <article className="step"><span className="step-index">03 / Arrive</span><h3>Come when called</h3><p>Follow the live queue and arrive when your turn is getting close.</p></article></div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}><div className="card" style={{ padding: '34px clamp(22px,5vw,58px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 28, flexWrap: 'wrap', background: '#e5eee6' }}>
        <div><div className="eyebrow">Make today a little easier</div><h2 className="section-title" style={{ marginBottom: 5 }}>A calmer kind of queue.</h2><p className="muted" style={{ margin: 0 }}>Your ticket stays with you, wherever the day takes you.</p></div>
        <Link className="button" href={user ? '/dashboard' : '/register'} data-testid="link-get-started">Get started <ArrowRight size={16} /></Link>
      </div></section>
    </main>
    <footer className="footer"><Brand /><span>SmartQueue · Less waiting, more living.</span></footer>
  </div>;
}
