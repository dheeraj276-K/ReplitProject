import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'wouter';
import { Form } from '@/components/ui/form';
import { Brand } from '@/components/brand';
import { useAuth } from '@/hooks/use-auth';
import { useToastMessage } from '@/lib/toast-context';
import { friendlyError } from '@/lib/format';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthValues = { full_name: string; phone: string; email: string; password: string; confirm_password: string };
type Mode = 'login' | 'register' | 'forgot' | 'reset';
const titles: Record<Mode, string> = { login: 'Welcome back.', register: 'Start with less waiting.', forgot: 'Reset your password.', reset: 'Choose a new password.' };

export default function AuthPage({ mode }: { mode: Mode }) {
  const { user, refreshProfile } = useAuth();
  const toast = useToastMessage();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<AuthValues>({ defaultValues: { full_name: '', phone: '', email: '', password: '', confirm_password: '' }, mode: 'onTouched' });

  async function submit(values: AuthValues) {
    if (!supabase) return;
    setBusy(true); setError('');
    try {
      if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
        if (loginError) throw loginError;
        await refreshProfile(data.user.id);
        navigate('/dashboard');
      } else if (mode === 'register') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: values.email.trim(), password: values.password,
          options: { data: { full_name: values.full_name.trim(), phone: values.phone.trim() } },
        });
        if (signupError) throw signupError;
        if (data.user) await refreshProfile(data.user.id);
        toast('Account created. Check your email to confirm your address.');
        navigate(data.session ? '/dashboard' : '/login');
      } else if (mode === 'forgot') {
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(values.email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (recoveryError) throw recoveryError;
        toast('If that email is registered, a reset link is on its way.');
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
        if (updateError) throw updateError;
        toast('Password updated. Sign in with your new password.');
        navigate('/login');
      }
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) return <main className="setup-screen"><section className="setup-card"><Brand /><h1>Connect your queue.</h1><p className="muted">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable SmartQueue.</p></section></main>;
  if (user && mode === 'login') return <main className="setup-screen"><section className="setup-card"><h1>Already signed in.</h1><Link className="button" href="/dashboard">Go to dashboard</Link></section></main>;
  const input = (name: keyof AuthValues, label: string, type: string, requiredMessage: string, autocomplete: string, validation?: Record<string, unknown>) => {
    const fieldError = form.formState.errors[name];
    return <div className="field" key={name}><label htmlFor={`auth-${name}`}>{label}</label>
      <input id={`auth-${name}`} type={type} autoComplete={autocomplete} data-testid={`input-${name}`} aria-invalid={!!fieldError}
        {...form.register(name, { required: requiredMessage, ...validation })} />
      {fieldError?.message && <small className="form-error" role="alert">{String(fieldError.message)}</small>}
    </div>;
  };
  return <div className="shell"><header className="topbar"><Brand /><Link href="/" className="quiet-link" data-testid="link-back-home">Back to home</Link></header><main className="form-wrap"><div className="form-panel">
    <div className="eyebrow">{mode === 'register' ? 'Get your place in line' : 'SmartQueue account'}</div><h1>{titles[mode]}</h1>
    <p className="muted">{mode === 'login' ? 'Sign in to follow your queue and manage your account.' : mode === 'register' ? 'A few details, then you can join a service queue.' : mode === 'forgot' ? 'We will email you a secure password reset link.' : 'Your new password must be at least 10 characters.'}</p>
    <Form {...form}><form onSubmit={form.handleSubmit(values => void submit(values))}>
      {mode === 'register' && <>
        {input('full_name', 'Full name', 'text', 'Enter your full name.', 'name', { minLength: { value: 2, message: 'Please enter at least 2 characters.' } })}
        {input('phone', 'Phone number', 'tel', 'Enter your phone number.', 'tel', { pattern: { value: /^\+?[0-9\s().-]{7,20}$/, message: 'Enter a valid phone number.' } })}
      </>}
      {mode !== 'reset' && input('email', 'Email address', 'email', 'Enter your email address.', 'email', { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' } })}
      {['login', 'register', 'reset'].includes(mode) && input('password', mode === 'reset' ? 'New password' : 'Password', 'password', 'Enter your password.', mode === 'login' ? 'current-password' : 'new-password', mode === 'login' ? {} : { validate: (value: string) => value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value) || 'Use at least 10 characters, including a letter and a number.' })}
      {mode === 'register' && input('confirm_password', 'Confirm password', 'password', 'Confirm your password.', 'new-password', { validate: (value: string) => value === form.getValues('password') || 'Passwords do not match.' })}
      {mode === 'register' && <p className="muted" style={{ fontSize: 12 }}>Passwords need 10 characters, at least one letter, and one number.</p>}
      {error && <div className="form-error" role="alert" data-testid="text-auth-error">{error}</div>}
      <button className="button" type="submit" disabled={busy} style={{ width: '100%', marginTop: 12 }} data-testid="button-auth-submit">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
    </form></Form>
    <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: 22, paddingTop: 18, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      {mode === 'login' && <><Link href="/forgot-password" className="muted" data-testid="link-forgot-password">Forgot password?</Link><Link href="/register" style={{ color: 'hsl(var(--primary))' }} data-testid="link-register">Create an account</Link></>}
      {mode === 'register' && <Link href="/login" style={{ color: 'hsl(var(--primary))' }} data-testid="link-login">Already have an account? Sign in</Link>}
      {mode === 'forgot' && <Link href="/login" style={{ color: 'hsl(var(--primary))' }} data-testid="link-login">Return to sign in</Link>}
      {mode === 'reset' && <Link href="/login" style={{ color: 'hsl(var(--primary))' }} data-testid="link-login">Return to sign in</Link>}
    </div>
  </div></main></div>;
}
