import type { TokenStatus } from './types';

export function prettyStatus(status: TokenStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
export function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function friendlyError(message?: string) {
  const value = (message ?? '').toLowerCase();
  if (!value) return 'Something went wrong. Please try again.';
  if ((value.includes('active') && value.includes('token')) || value.includes('already have an active')) return 'You already have an active ticket. Finish or cancel it before joining another queue.';
  if (value.includes('duplicate') || value.includes('unique')) return 'A record with those details already exists.';
  if (value.includes('permission') || value.includes('rls') || value.includes('not authorized') || value.includes('forbidden')) return 'You do not have permission to do that.';
  if (value.includes('network') || value.includes('fetch')) return 'Connection problem. Check your internet and try again.';
  if (value.includes('invalid login') || value.includes('credentials')) return 'Email or password is incorrect.';
  if (value.includes('email not confirmed')) return 'Please confirm your email address before signing in.';
  if (value.includes('password')) return 'Choose a stronger password and try again.';
  return 'We could not complete that request. Please try again.';
}
