(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const auth = window.TubeAuth;
  const kind = document.body.dataset.authPage;
  const initialUrl = window.location.href;
  if (kind === 'login' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
    window.location.replace('reset-password.html' + window.location.hash);
    return;
  }
  const params = new URL(initialUrl).searchParams;
  const next = auth.safeNext(params.get('next'), initialUrl);
  const state = { client: null, mode: params.get('mode') === 'signup' ? 'signup' : 'signin', busy: false, ready: false, user: null, completed: false, cooldown: 0 };
  let timer;

  function message(text, error = false) {
    const element = $('#auth-message');
    element.textContent = text;
    element.hidden = !text;
    element.classList.toggle('is-error', error);
    element.setAttribute('role', error ? 'alert' : 'status');
    if (text) element.focus();
  }

  function label() {
    if (kind === 'forgot') return state.cooldown ? `Resend in ${state.cooldown}s` : 'Send reset link →';
    if (kind === 'reset') return 'Save new password →';
    return state.mode === 'signup' ? 'Create account →' : 'Sign in →';
  }

  function busy(value) {
    state.busy = value;
    $('#auth-form').setAttribute('aria-busy', String(value));
    $('#auth-fields').disabled = value || !state.ready;
    $('#auth-submit').disabled = value || Boolean(state.cooldown);
    $('#auth-submit').textContent = value ? 'Please wait…' : label();
  }

  function clearPasswords() {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      const input = document.getElementById(button.dataset.passwordToggle);
      input.value = '';
      input.type = 'password';
      button.textContent = 'Show';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', input.id === 'auth-confirm' ? 'Show confirmation password' : 'Show password');
    });
  }

  function mode() {
    const signup = state.mode === 'signup';
    $('#auth-title').textContent = signup ? 'Make yourself at home' : 'Welcome back';
    $('#auth-description').textContent = signup ? 'Create your account to watch, save, and share.' : 'Sign in to pick up where you left off.';
    $('#auth-confirm-wrap').hidden = !signup;
    $('#auth-confirm').disabled = !signup;
    $('#auth-confirm').required = signup;
    $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    $('#auth-password').minLength = signup ? auth.MIN_PASSWORD_LENGTH : 1;
    $('#auth-password-help').hidden = !signup;
    $('#auth-forgot').hidden = signup;
    $('#auth-mode').textContent = signup ? 'Sign in' : 'Create an account';
    $('#auth-switch-copy').textContent = signup ? 'Already part of the community?' : 'New around here?';
    $('#auth-submit').textContent = label();
    clearPasswords();
  }

  function renderSession() {
    $('#auth-session').hidden = !state.user;
    $('#auth-form').hidden = Boolean(state.user);
    $('#auth-session-email').textContent = state.user?.email || '';
    $('#auth-continue').href = next;
  }

  async function checkSession() {
    const result = await state.client.auth.getSession();
    if (result.error) throw result.error;
    state.user = null;
    if (result.data?.session) {
      const verified = await state.client.auth.getUser();
      if (verified.error) throw verified.error;
      state.user = verified.data?.user || null;
    }
    renderSession();
  }

  function cooldown() {
    state.cooldown = 60;
    const until = Date.now() + 60000;
    clearInterval(timer);
    timer = setInterval(() => {
      state.cooldown = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      busy(false);
      if (!state.cooldown) clearInterval(timer);
    }, 1000);
  }

  async function finishSignOut() {
    const retry = $('#auth-retry-signout');
    retry.disabled = true;
    try {
      const result = await state.client.auth.signOut({ scope: 'global' });
      if (result.error) throw result.error;
      $('#auth-success-copy').textContent = 'Your password has been changed. Sign in again with your new password.';
      $('#auth-success-login').hidden = false;
      retry.hidden = true;
    } catch (_error) {
      $('#auth-success-copy').textContent = 'Your password was saved, but automatic sign-out could not finish. Reconnect and retry sign-out; you do not need to reset your password again.';
      retry.hidden = false;
    } finally { retry.disabled = false; }
  }

  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.ready || state.busy || state.cooldown || state.completed) return;
    message('');
    busy(true);
    try {
      if (kind === 'forgot') {
        await auth.sendRecovery(state.client, $('#auth-email').value, initialUrl);
        message('If an account exists for that email, you’ll receive a reset link. Check your inbox and spam folder.');
        cooldown();
      } else if (kind === 'reset') {
        await auth.updatePassword(state.client, state.user.id, $('#auth-password').value, $('#auth-confirm').value);
        state.completed = true;
        clearPasswords();
        $('#auth-form').hidden = true;
        $('#auth-description').hidden = true;
        $('#auth-new-link').hidden = true;
        $('#auth-success').hidden = false;
        await finishSignOut();
      } else {
        const data = state.mode === 'signup'
          ? await auth.signUp(state.client, $('#auth-email').value, $('#auth-password').value, $('#auth-confirm').value, initialUrl)
          : await auth.signIn(state.client, $('#auth-email').value, $('#auth-password').value);
        clearPasswords();
        if (data?.session) window.location.assign(next);
        else {
          state.mode = 'signin';
          mode();
          message('Check your email to confirm your account, then sign in. If you already have an account, sign in or use Forgot password.');
        }
      }
    } catch (error) {
      message(auth.errorMessage(error), true);
      if (kind === 'reset' && (error.code === 'recovery_invalid' || /session|token/.test(error.code || ''))) {
        state.ready = false;
        clearPasswords();
        $('#auth-form').hidden = true;
      }
    } finally { busy(false); }
  });

  document.querySelectorAll('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${input.id === 'auth-confirm' ? 'confirmation password' : 'password'}`);
  }));

  $('#auth-mode')?.addEventListener('click', () => {
    if (state.busy) return;
    state.mode = state.mode === 'signin' ? 'signup' : 'signin';
    mode();
    message('');
  });
  $('#auth-signout')?.addEventListener('click', async () => {
    const button = $('#auth-signout');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const result = await state.client.auth.signOut();
      if (result.error) throw result.error;
      state.user = null;
      renderSession();
      message('You’re signed out.');
    } catch (error) { message(auth.errorMessage(error), true); }
    finally { button.disabled = false; }
  });
  $('#auth-retry-signout')?.addEventListener('click', finishSignOut);
  window.addEventListener('pagehide', () => { clearInterval(timer); clearPasswords(); });

  async function init() {
    if (kind === 'login') mode();
    let tokens;
    try {
      if (kind === 'reset') {
        // Remove callback credentials/errors from the address bar even when validation fails.
        window.history.replaceState(null, '', window.location.pathname);
        tokens = auth.recoveryTokens(initialUrl);
      }
      // Keep recovery credentials in this page's memory, isolated from other tabs/accounts.
      state.client = auth.createClient({ detectSessionInUrl: kind === 'login', persistSession: kind !== 'reset' });
      if (kind === 'reset') {
        state.user = await auth.beginRecovery(state.client, tokens);
        $('#auth-form').hidden = false;
        $('#auth-description').textContent = 'Link verified. Set a new password to get back to your account.';
      } else if (kind === 'login') {
        const callback = new URLSearchParams(new URL(initialUrl).hash.slice(1));
        try {
          if (params.get('reset') === 'complete') renderSession();
          else await checkSession();
        }
        finally {
          const cleaned = new URLSearchParams();
          if (params.has('next')) cleaned.set('next', next);
          if (params.get('reason') === 'auth_required') cleaned.set('reason', 'auth_required');
          window.history.replaceState(null, '', window.location.pathname + (cleaned.size ? '?' + cleaned.toString() : ''));
        }
        if (callback.has('error') || callback.has('error_code') || params.has('error')) {
          message('This confirmation link is invalid or expired. Try signing in, or request a password reset.', true);
        }
        if (params.get('reason') === 'auth_required') {
          message('Please sign in first to access Tubeclone. Your requested page will open after login.');
        }
        state.client.auth.onAuthStateChange((event) => {
          if (event !== 'SIGNED_OUT') return;
          // No SDK calls inside the auth callback (avoids SDK lock re-entry).
          state.user = null;
          renderSession();
        });
      }
      state.ready = true;
    } catch (error) {
      if (kind === 'reset') $('#auth-description').textContent = 'A valid link from your reset email is required.';
      // A stale login session must not prevent the user from signing in again.
      if (kind === 'login' && state.client) { state.ready = true; state.user = null; renderSession(); }
      message(auth.errorMessage(error), true);
    } finally { tokens = null; busy(false); }
  }
  init();
}());
