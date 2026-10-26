// Uses the real Supabase browser SDK with intercepted HTTP responses.
// No real passwords, emails, Supabase projects, or Cloudinary uploads are used.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'viewer@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const password = 'test-only-passphrase';
function session(account = user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: account.id, aud: 'authenticated', role: 'authenticated', exp })}.${encode('test-only-signature')}`, refresh_token: 'test-only-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: account };
}
function callback(type = 'recovery') {
  const value = session();
  return '#' + new URLSearchParams({ type, access_token: value.access_token, refresh_token: value.refresh_token, expires_in: '3600', token_type: 'bearer' });
}
let browser, server, base, sdk;

before(async () => {
  sdk = await readFile(path.join(path.dirname(require.resolve('@supabase/supabase-js')), 'umd/supabase.js'), 'utf8');
  server = createServer(async (req, res) => {
    const name = path.basename(new URL(req.url, 'http://localhost').pathname) || 'index.html';
    if (!/^[a-z-]+\.(html|js|css|svg)$/.test(name)) return res.writeHead(404).end();
    try {
      res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript');
      res.end(await readFile(path.join(root, name)));
    } catch (_error) { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise((resolve) => server ? server.close(resolve) : resolve()); });

async function openPage(t, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1366, height: 900 } });
  t.after(() => context.close());
  const calls = [];
  const errors = [];
  const control = { rejectUser: false, recoveryError: options.recoveryError, updateError: options.updateError, logoutError: options.logoutError };
  let releaseLogin;
  const loginGate = new Promise((resolve) => { releaseLogin = resolve; });
  t.after(() => releaseLogin());
  const pageName = (options.start || 'login.html').split(/[?#]/)[0];
  const needsSession = options.signedIn === true || (options.signedIn !== false && !/^(?:login|forgot-password|reset-password)\.html$/.test(pageName));
  if (needsSession) await context.addInitScript((value) => {
    if (!sessionStorage.getItem('test-seeded')) {
      localStorage.setItem('sb-auth-test-auth-token', JSON.stringify(value));
      sessionStorage.setItem('test-seeded', 'true');
    }
  }, session(options.otherUser ? { ...user, id: 'other-test-user' } : user));
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/supabase-config.js')) return route.fulfill({ contentType: 'application/javascript', body: 'window.SUPABASE_CONFIG = {url:"https://auth-test.supabase.co",anonKey:"public-test-only"};' });
    if (url.pathname.endsWith('/cloudinary-config.js')) return route.fulfill({ contentType: 'application/javascript', body: 'window.CLOUDINARY_CONFIG = {cloudName:"test-only", unsignedUploadPreset:"test-only"};' });
    if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'application/javascript', body: options.noSdk ? '' : sdk });
    if (url.hostname === 'auth-test.supabase.co') {
      if (url.pathname.endsWith('/user_bans') && options.banned) return route.fulfill({ contentType: 'application/json', body: JSON.stringify([options.banned]) });
      if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ contentType: 'application/json', body: '[]' });
      const entry = { path: url.pathname, query: url.search, method: request.method(), body: request.postDataJSON() };
      calls.push(entry);
      let status = 200, body = {};
      if (url.pathname.endsWith('/token')) {
        if (options.holdLogin) await loginGate;
        if (entry.body?.password === 'wrong-password') { status = 400; body = { code: 'invalid_credentials', msg: 'Invalid login credentials' }; }
        else if (options.unconfirmed) { status = 400; body = { code: 'email_not_confirmed', msg: 'Email not confirmed' }; }
        else body = session();
      } else if (url.pathname.endsWith('/signup')) body = options.autoConfirm ? session() : user;
      else if (url.pathname.endsWith('/recover')) {
        if (control.recoveryError) { status = control.recoveryError === 'over_email_send_rate_limit' ? 429 : 400; body = { code: control.recoveryError, msg: 'Email could not be sent' }; }
      } else if (url.pathname.endsWith('/user')) {
        if (control.rejectUser || options.invalidToken) { status = 401; body = { code: 'bad_jwt', msg: 'JWT expired' }; }
        else if (entry.method === 'PUT' && control.updateError) { status = 422; body = { code: control.updateError, msg: 'Password rejected' }; }
        else body = user;
      } else if (url.pathname.endsWith('/logout')) {
        if (control.logoutError) { status = 400; body = { code: 'unexpected_failure', msg: 'Test sign-out failure' }; }
        else return route.fulfill({ status: 204, body: '' });
      } else { status = 404; body = { msg: 'Unexpected mocked endpoint' }; }
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (url.origin === base) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'no uncaught page errors'));
  await page.goto(`${base}/${options.start || 'login.html'}`);
  return { page, context, calls, control, releaseLogin };
}
async function ready(page) { await page.waitForFunction(() => !document.querySelector('#auth-fields').disabled); }
async function credentials(page, value = password) {
  await page.locator('#auth-email').fill(user.email);
  await page.locator('#auth-password').fill(value);
}
const requests = (calls, name) => calls.filter((call) => call.path.endsWith('/' + name));

test('every app entry point requires a verified Supabase session', async (t) => {
  for (const start of ['index.html', 'studio.html', 'account.html', 'history.html', 'watch-later.html', 'liked.html', 'subscriptions.html', 'playlists.html', 'shorts.html', 'upload.html', 'admin.html', 'admin-user.html?id=test-user']) {
    const { page } = await openPage(t, { start, signedIn: false });
    assert.match(page.url(), /login\.html/, start);
    assert.equal(new URL(page.url()).searchParams.get('reason'), 'auth_required', start);
    assert.match(new URL(page.url()).searchParams.get('next'), new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('admin console stays closed to signed-in non-admin users', async (t) => {
  const { page } = await openPage(t, { start: 'admin.html', signedIn: true });
  await page.waitForURL('**/account.html');
  assert.equal(await page.locator('#admin-root').count(), 0);
});

test('admin user profiles stay closed to signed-in non-admin users', async (t) => {
  const { page } = await openPage(t, { start: 'admin-user.html?id=test-user', signedIn: true });
  await page.waitForURL('**/account.html');
  assert.equal(await page.locator('#admin-user-root').count(), 0);
});

test('temporary bans show the live time remaining and automatic unban time', async (t) => {
  const { page } = await openPage(t, { start: 'banned.html', signedIn: true, banned: { banned_until: new Date(Date.now() + 95 * 60000).toISOString(), is_permanent: false, reason: 'Test-only restriction' } });
  await page.locator('#banned-countdown').waitFor();
  assert.match(await page.locator('#banned-countdown').textContent(), /remaining/);
  assert.match(await page.locator('#banned-expiry').textContent(), /Unban time:/);
  assert.match(await page.locator('#banned-reason').textContent(), /Test-only restriction/);
});

test('signed-in viewers can add threaded replies to comments', async (t) => {
  const { page } = await openPage(t, { start: 'index.html', signedIn: true });
  await page.locator('#video-grid').waitFor();
  await page.evaluate(() => { window.location.hash = 'watch=v1'; });
  await page.locator('#watch-page').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#hero-banner').isVisible(), false);
  assert.equal(await page.locator('#watch-page-player').isVisible(), true);
  await page.locator('#comments-toggle').click();
  assert.equal(await page.locator('#comments-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#comments-list').isVisible(), false);
  await page.locator('#comments-toggle').click();
  assert.equal(await page.locator('#comments-toggle').getAttribute('aria-expanded'), 'true');
  await page.locator('#watch-page-like-button').click();
  assert.equal(await page.locator('#watch-page-like-button').evaluate((button) => button.classList.contains('pill-button--active')), true);
  await page.locator('#watch-page-save-button').click();
  assert.equal(await page.locator('#watch-page-save-button').evaluate((button) => button.classList.contains('pill-button--active')), true);
  await page.locator('#watch-page-subscribe-button').click();
  assert.equal(await page.locator('#watch-page-subscribe-button').evaluate((button) => button.classList.contains('subscribe-button--subscribed')), true);
  await page.locator('#comment-input').fill('Top-level comment');
  await page.locator('#comment-form button[type="submit"]').click();
  await page.locator('.comment-item').waitFor();
  await page.locator('[data-action="reply-comment"]').click();
  assert.equal(await page.locator('#comment-replying').isVisible(), true);
  assert.match(await page.locator('#comment-replying-text').textContent(), /viewer/);
  await page.locator('#comment-input').fill('A threaded reply');
  await page.locator('#comment-form button[type="submit"]').click();
  await page.locator('.comment-replies .comment-item').waitFor();
  assert.equal(await page.locator('.comment-replies .comment-item').count(), 1);
  assert.match(await page.locator('.comment-replies').textContent(), /A threaded reply/);
});

test('login validates, reports bad credentials, toggles visibility, and returns to the requested page', async (t) => {
  const { page, calls } = await openPage(t, { start: 'login.html?next=' + encodeURIComponent('index.html#watch=v1') });
  await ready(page);
  await page.locator('#auth-submit').click();
  assert.match(await page.locator('#auth-message').textContent(), /valid email/);
  assert.equal(requests(calls, 'token').length, 0);
  await credentials(page, 'wrong-password');
  await page.locator('#auth-submit').click();
  await page.getByRole('alert').filter({ hasText: 'Invalid email or password' }).waitFor();
  await page.locator('[data-password-toggle="auth-password"]').click();
  assert.equal(await page.locator('#auth-password').getAttribute('type'), 'text');
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-submit').click();
  await page.waitForURL('**/index.html#watch=v1');
  assert.equal(requests(calls, 'token').length, 2);
  assert.equal(requests(calls, 'token')[1].body.email, user.email);
});

test('pending sign-in cannot submit twice and external next URLs are rejected', async (t) => {
  const { page, calls, releaseLogin } = await openPage(t, { start: 'login.html?next=https://evil.example', holdLogin: true });
  await ready(page);
  await credentials(page);
  await page.locator('#auth-submit').click();
  assert.equal(await page.locator('#auth-email').isDisabled(), true);
  await page.locator('#auth-form').evaluate((form) => form.dispatchEvent(new Event('submit', { cancelable: true })));
  releaseLogin();
  await page.waitForURL('**/index.html');
  assert.equal(requests(calls, 'token').length, 1);
});

test('signup confirms passwords and waits for email confirmation without claiming a session', async (t) => {
  const { page, calls } = await openPage(t);
  await ready(page);
  await page.locator('#auth-mode').click();
  await credentials(page, 'short');
  await page.locator('#auth-confirm').fill('short');
  await page.locator('#auth-submit').click();
  assert.match(await page.locator('#auth-message').textContent(), /8 characters/);
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-submit').click();
  assert.match(await page.locator('#auth-message').textContent(), /not match/);
  assert.equal(requests(calls, 'signup').length, 0);
  await page.locator('#auth-confirm').fill(password);
  await page.locator('#auth-submit').click();
  await page.getByRole('status').filter({ hasText: 'Check your email' }).waitFor();
  assert.equal(await page.locator('#auth-session').isVisible(), false);
  assert.equal(await page.locator('#auth-password').inputValue(), '');
  assert.match(requests(calls, 'signup')[0].query, /redirect_to=/);
  assert.equal(new URLSearchParams(requests(calls, 'signup')[0].query).get('redirect_to'), base + '/login.html');
});

test('unconfirmed email stays on login with a useful error', async (t) => {
  const { page } = await openPage(t, { unconfirmed: true });
  await ready(page);
  await credentials(page);
  await page.locator('#auth-submit').click();
  await page.getByRole('alert').filter({ hasText: 'Confirm your email' }).waitFor();
  assert.equal(await page.locator('#auth-submit').isDisabled(), false);
});

test('restores a verified session and does not report sign-out success after failure', async (t) => {
  const { page } = await openPage(t, { signedIn: true, logoutError: true });
  await page.locator('#auth-session').waitFor();
  assert.equal(await page.locator('#auth-session-email').textContent(), user.email);
  await page.locator('#auth-signout').click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('#auth-session').isVisible(), false, 'failed sign-out does not claim the user is still signed in');
  assert.equal(await page.locator('#auth-form').isVisible(), true);
});

test('forgot-password validates, requests the fixed callback, and shows a neutral response with cooldown', async (t) => {
  const { page, calls } = await openPage(t, { start: 'forgot-password.html' });
  await ready(page);
  await page.locator('#auth-submit').click();
  assert.match(await page.locator('#auth-message').textContent(), /valid email/);
  assert.equal(requests(calls, 'recover').length, 0);
  await page.locator('#auth-email').fill('possibly-unknown@example.test');
  await page.locator('#auth-submit').click();
  await page.getByRole('status').filter({ hasText: 'If an account exists' }).waitFor();
  assert.equal(requests(calls, 'recover')[0].body.email, 'possibly-unknown@example.test');
  assert.equal(new URLSearchParams(requests(calls, 'recover')[0].query).get('redirect_to'), base + '/reset-password.html');
  assert.equal(await page.locator('#auth-submit').isDisabled(), true);
  await page.locator('#auth-form').evaluate((form) => form.dispatchEvent(new Event('submit', { cancelable: true })));
  assert.equal(requests(calls, 'recover').length, 1);
});

test('recovery rate limits are not mistaken for a sent email and allow intentional retry', async (t) => {
  const { page, calls, control } = await openPage(t, { start: 'forgot-password.html', recoveryError: 'over_email_send_rate_limit' });
  await ready(page);
  await page.locator('#auth-email').fill(user.email);
  await page.locator('#auth-submit').click();
  await page.getByRole('alert').filter({ hasText: 'Too many attempts' }).waitFor();
  assert.equal(await page.locator('#auth-submit').isDisabled(), false);
  control.recoveryError = null;
  await page.locator('#auth-submit').click();
  await page.getByRole('status').filter({ hasText: 'If an account exists' }).waitFor();
  assert.equal(requests(calls, 'recover').length, 2);
});

test('invalid links never fall back to an existing signed-in session', async (t) => {
  for (const suffix of ['', '#type=recovery', '#error=access_denied&error_code=otp_expired', callback('signup')]) {
    const { page, calls } = await openPage(t, { start: 'reset-password.html' + suffix, signedIn: true });
    await page.getByRole('alert').waitFor();
    assert.match(await page.locator('#auth-message').textContent(), /missing, invalid, or expired/);
    assert.equal(await page.locator('#auth-form').isVisible(), false);
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(requests(calls, 'user').length, 0);
  }
});

test('a verified recovery link updates the password, isolates credentials, and signs out before re-login', async (t) => {
  const { page, calls } = await openPage(t, { start: 'reset-password.html' + callback(), signedIn: true, otherUser: true });
  await ready(page);
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sb-auth-test-auth-token')).user.id), 'other-test-user', 'recovery does not overwrite a different remembered account');
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-confirm').fill('different');
  await page.locator('#auth-submit').click();
  assert.match(await page.locator('#auth-message').textContent(), /not match/);
  assert.equal(requests(calls, 'user').filter((call) => call.method === 'PUT').length, 0);
  await page.locator('#auth-confirm').fill(password);
  await page.locator('#auth-submit').click();
  await page.locator('#auth-success-login').waitFor();
  assert.equal(requests(calls, 'user').filter((call) => call.method === 'PUT').length, 1);
  assert.equal(requests(calls, 'user').find((call) => call.method === 'PUT').body.password, password);
  assert.equal(new URLSearchParams(requests(calls, 'logout')[0].query).get('scope'), 'global');
  assert.equal(await page.locator('#auth-password').inputValue(), '');
  await page.locator('#auth-success-login').click();
  await ready(page);
  assert.equal(await page.locator('#auth-form').isVisible(), true, 'a remembered login does not hide the re-login form');
  await credentials(page);
  await page.locator('#auth-submit').click();
  await page.waitForURL('**/index.html');
});

test('Supabase rejects expired recovery credentials and no password form is enabled', async (t) => {
  const { page, calls } = await openPage(t, { start: 'reset-password.html' + callback(), invalidToken: true });
  await page.getByRole('alert').waitFor();
  assert.match(await page.locator('#auth-message').textContent(), /could not be verified/);
  assert.equal(await page.locator('#auth-form').isVisible(), false);
  assert.equal(requests(calls, 'user').filter((call) => call.method === 'PUT').length, 0);
});

test('expired recovery session at submit cannot change a password', async (t) => {
  const { page, calls, control } = await openPage(t, { start: 'reset-password.html' + callback() });
  await ready(page);
  control.rejectUser = true;
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-confirm').fill(password);
  await page.locator('#auth-submit').click();
  await page.getByRole('alert').filter({ hasText: 'changed or expired' }).waitFor();
  assert.equal(await page.locator('#auth-form').isVisible(), false);
  assert.equal(requests(calls, 'user').filter((call) => call.method === 'PUT').length, 0);
});

// AUTH_BROWSER_INTEGRATION
