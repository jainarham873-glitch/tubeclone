(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.TubeAuth = factory(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const MIN_PASSWORD_LENGTH = 8;
  const pages = new Set(['index.html', 'account.html', 'studio.html', 'upload.html', 'history.html', 'watch-later.html', 'liked.html', 'subscriptions.html', 'playlists.html', 'shorts.html', 'admin.html', 'admin-user.html']);
  function failure(code, message) { return Object.assign(new Error(message), { code }); }
  function stored(key) { try { return root.localStorage?.getItem(key); } catch (_error) { return null; } }

  function createClient(options = {}) {
    const config = root.SUPABASE_CONFIG || {};
    const raw = stored('tubeclone.supabase.url') || config.url;
    const key = stored('tubeclone.supabase.anonKey') || config.anonKey;
    if (!raw || !key || !root.supabase?.createClient) throw failure('setup', 'Account connection unavailable. Check supabase-config.js and your internet connection, then reload.');
    let url;
    try {
      url = new URL(raw.trim());
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      url.hash = '';
      url.search = '';
      url.pathname = url.pathname.replace(/\/(?:rest\/v1|auth\/v1)\/?$/i, '');
    } catch (_error) { throw failure('setup', 'Check the project URL in supabase-config.js, then reload.'); }
    return root.supabase.createClient(url.toString().replace(/\/$/, ''), key, {
      auth: { flowType: 'implicit', persistSession: options.persistSession !== false, autoRefreshToken: true, detectSessionInUrl: options.detectSessionInUrl !== false },
    });
  }

  function pageUrl(name, href) {
    const url = new URL(name, href || root.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) throw failure('setup', 'Open the app through its HTTP server, not a file:// URL.');
    return url.href;
  }

  function safeNext(value, href) {
    const base = new URL('.', href);
    const fallback = new URL('index.html', base).pathname;
    try {
      const url = new URL(value || 'index.html', base);
      const name = url.pathname.slice(base.pathname.length);
      if (url.origin !== base.origin || url.username || url.password || !url.pathname.startsWith(base.pathname) || !pages.has(name)) return fallback;
      // Only retain known navigation state, never callback tokens or arbitrary redirects.
      const params = new URLSearchParams();
      if (name === 'index.html') for (const key of ['search', 'category']) if (url.searchParams.has(key)) params.set(key, url.searchParams.get(key));
      if (name === 'admin-user.html' && url.searchParams.has('id')) params.set('id', url.searchParams.get('id'));
      const hash = name === 'index.html' && /^#watch=[\w-]+$/.test(url.hash) ? url.hash : '';
      return url.pathname + (params.size ? '?' + params.toString() : '') + hash;
    } catch (_error) { return fallback; }
  }

  function emailValue(value) {
    const email = String(value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw failure('validation', 'Enter a valid email address.');
    return email;
  }

  function validatePassword(password, confirmation) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || !password.trim()) throw failure('validation', 'Use at least 8 characters for your new password.');
    if (password !== confirmation) throw failure('validation', 'The passwords do not match.');
    return password;
  }

  async function signIn(client, email, password) {
    email = emailValue(email);
    if (!password) throw failure('validation', 'Enter your password.');
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (!result.data?.session?.user) throw failure('session_missing', 'Sign-in did not return a session. Please try again.');
    return result.data;
  }

  async function signUp(client, email, password, confirmation, href) {
    email = emailValue(email);
    validatePassword(password, confirmation);
    const result = await client.auth.signUp({ email, password, options: { emailRedirectTo: pageUrl('login.html', href) } });
    if (result.error) throw result.error;
    return result.data;
  }

  async function sendRecovery(client, email, href) {
    const result = await client.auth.resetPasswordForEmail(emailValue(email), { redirectTo: pageUrl('reset-password.html', href) });
    if (result.error) throw result.error;
    // Deliberately do not reveal whether this email has an account.
  }

  function recoveryTokens(href) {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.slice(1));
    if (['error', 'error_code', 'error_description'].some((key) => hash.has(key) || url.searchParams.has(key)) || hash.get('type') !== 'recovery' || !hash.get('access_token') || !hash.get('refresh_token')) {
      throw failure('recovery_invalid', 'This reset link is missing, invalid, or expired. Request a new email and open its latest link.');
    }
    return { access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') };
  }

  async function beginRecovery(client, tokens) {
    // Reset pages disable automatic URL detection. Never use an unrelated cached session.
    const result = await client.auth.setSession(tokens);
    if (result.error || !result.data?.session?.user?.id) throw failure('recovery_invalid', 'This reset link could not be verified. Request a new email and open its latest link.');
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data?.user?.id || verified.data.user.id !== result.data.session.user.id) throw failure('recovery_invalid', 'Your reset session is no longer valid. Request a new reset email.');
    return verified.data.user;
  }

  async function updatePassword(client, userId, password, confirmation) {
    validatePassword(password, confirmation);
    const verified = await client.auth.getUser();
    if (!userId || verified.error || verified.data?.user?.id !== userId) throw failure('recovery_invalid', 'Your account session changed or expired. Request a new reset email.');
    const result = await client.auth.updateUser({ password });
    if (result.error) throw result.error;
    if (result.data?.user?.id !== userId) throw failure('update_failed', 'The password update was not confirmed. Request a new link before trying again.');
  }

  function errorMessage(error) {
    const code = error?.code || '';
    const message = error?.message || '';
    if (['validation', 'setup', 'recovery_invalid', 'update_failed', 'session_missing'].includes(code)) return message;
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'Invalid email or password. Please try again.';
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'Confirm your email before signing in. Check your inbox and spam folder.';
    if (error?.status === 429 || /rate_limit|over_.*limit/.test(code) || /rate limit/i.test(message)) return 'Too many attempts. Please wait a few minutes before trying again.';
    if (code === 'same_password') return 'Choose a different password from the one you currently use.';
    if (code === 'weak_password') return 'Choose a stronger password that meets this account’s password requirements.';
    if (/session|token|otp_expired/.test(code)) return 'Your session or email link has expired. Request a new link and try again.';
    if (/fetch|network|offline/i.test(message)) return 'Could not connect. Check your internet connection and try again.';
    if (/email.*(send|not allowed|unauthorized)|smtp/i.test(message) || code === 'email_address_not_authorized') return 'Email could not be sent. The site owner may need to configure Supabase email delivery. Please try again later.';
    return 'We couldn’t complete that request. Please try again, or contact the site owner if it continues.';
  }

  return { MIN_PASSWORD_LENGTH, createClient, pageUrl, safeNext, emailValue, validatePassword, signIn, signUp, sendRecovery, recoveryTokens, beginRecovery, updatePassword, errorMessage };
}));
