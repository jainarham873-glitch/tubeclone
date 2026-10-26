const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const Auth = require('../auth-service.js');
const here = 'https://app.example.test/tube/login.html';
const user = { id: 'user-one', email: 'viewer@example.test' };
const password = 'a-test-passphrase';

function client(options = {}) {
  const calls = [];
  return { calls, auth: {
    async signInWithPassword(value) { calls.push(['signin', value]); return options.loginError ? { error: options.loginError } : { data: { session: { user } } }; },
    async signUp(value) { calls.push(['signup', value]); return { data: { session: options.autoConfirm ? { user } : null } }; },
    async resetPasswordForEmail(...args) { calls.push(['recover', ...args]); return { error: options.emailError }; },
    async setSession(value) { calls.push(['setSession', value]); return options.tokenError ? { error: options.tokenError } : { data: { session: { user } } }; },
    async getUser() { calls.push(['getUser']); return { data: { user: options.otherUser || user }, error: options.userError }; },
    async updateUser(value) { calls.push(['updateUser', value]); return { data: { user }, error: options.updateError }; },
  } };
}

test('safe destinations stay in this app and discard credentials and arbitrary redirects', () => {
  assert.equal(Auth.safeNext('studio.html', here), '/tube/studio.html');
  assert.equal(Auth.safeNext('index.html?search=music&next=https://evil.test&access_token=secret#watch=v1', here), '/tube/index.html?search=music#watch=v1');
  for (const value of ['https://evil.test', '//evil.test', 'javascript:alert(1)', '../index.html', 'login.html', 'reset-password.html', 'https://other@app.example.test/tube/index.html', '/tube/%69ndex.html']) {
    assert.equal(Auth.safeNext(value, here), '/tube/index.html', value);
  }
  assert.equal(Auth.safeNext('index.html#access_token=secret', here), '/tube/index.html');
});

test('callback URLs are fixed same-app pages and work in subdirectory deployments', () => {
  assert.equal(Auth.pageUrl('reset-password.html', here + '?next=https://evil.test'), 'https://app.example.test/tube/reset-password.html');
  assert.throws(() => Auth.pageUrl('reset-password.html', 'file:///app/login.html'), /HTTP server/);
});

test('client setup normalizes the URL, tolerates blocked storage, and isolates recovery sessions', () => {
  let received;
  const context = { URL, URLSearchParams, SUPABASE_CONFIG: { url: 'https://example.supabase.co/rest/v1/', anonKey: 'public-test-only' },
    localStorage: { getItem() { throw new Error('blocked'); } },
    supabase: { createClient(...args) { received = args; return {}; } },
  };
  vm.runInNewContext(readFileSync(require.resolve('../auth-service.js'), 'utf8'), context);
  context.TubeAuth.createClient({ persistSession: false, detectSessionInUrl: false });
  assert.equal(received[0], 'https://example.supabase.co');
  assert.equal(received[2].auth.flowType, 'implicit');
  assert.equal(received[2].auth.persistSession, false);
  assert.equal(received[2].auth.detectSessionInUrl, false);
  context.TubeAuth.createClient();
  assert.equal(received[2].auth.persistSession, true);
  context.supabase = null;
  assert.throws(() => context.TubeAuth.createClient(), /supabase-config.js/);
});

test('login uses Supabase, trims email but not passwords, and supports legacy short passwords', async () => {
  const api = client();
  const result = await Auth.signIn(api, ' viewer@example.test ', ' old ');
  assert.equal(result.session.user.id, user.id);
  assert.deepEqual(api.calls[0], ['signin', { email: user.email, password: ' old ' }]);
  await assert.rejects(Auth.signIn(api, 'invalid', password), /valid email/);
  await assert.rejects(Auth.signIn(api, user.email, ''), /Enter your password/);
  await assert.rejects(Auth.signIn(client({ loginError: { code: 'invalid_credentials' } }), user.email, password), { code: 'invalid_credentials' });
});

test('signup requires a matching new password and uses the confirmation callback', async () => {
  const api = client();
  await assert.rejects(Auth.signUp(api, user.email, 'short', 'short', here), /8 characters/);
  await assert.rejects(Auth.signUp(api, user.email, password, 'different', here), /not match/);
  assert.equal(api.calls.length, 0);
  const result = await Auth.signUp(api, user.email, password, password, here);
  assert.equal(result.session, null, 'confirmation is not reported as a signed-in session');
  assert.equal(api.calls[0][1].options.emailRedirectTo, 'https://app.example.test/tube/login.html');
});

test('recovery requests go to Supabase with only the intended callback', async () => {
  const api = client();
  assert.equal(await Auth.sendRecovery(api, ' viewer@example.test ', here), undefined);
  assert.deepEqual(api.calls[0], ['recover', user.email, { redirectTo: 'https://app.example.test/tube/reset-password.html' }]);
  await assert.rejects(Auth.sendRecovery(client({ emailError: { status: 429 } }), user.email, here), { status: 429 });
});

test('missing, expired, partial, and non-recovery links cannot authorize a reset', () => {
  const base = 'https://app.example.test/reset-password.html';
  for (const suffix of ['', '?code=pkce-not-supported', '#type=recovery', '#type=recovery&access_token=one', '#type=signup&access_token=one&refresh_token=two', '#error=access_denied&error_code=otp_expired']) {
    assert.throws(() => Auth.recoveryTokens(base + suffix), { code: 'recovery_invalid' });
  }
  assert.deepEqual(Auth.recoveryTokens(base + '#type=recovery&access_token=test-access&refresh_token=test-refresh'), { access_token: 'test-access', refresh_token: 'test-refresh' });
});

test('recovery verifies the link session with Supabase rather than trusting cached login', async () => {
  const api = client();
  assert.equal((await Auth.beginRecovery(api, { access_token: 'test', refresh_token: 'test' })).id, user.id);
  assert.deepEqual(api.calls.map(([method]) => method), ['setSession', 'getUser']);
  await assert.rejects(Auth.beginRecovery(client({ tokenError: new Error('expired') }), {}), { code: 'recovery_invalid' });
  await assert.rejects(Auth.beginRecovery(client({ userError: new Error('invalid') }), {}), { code: 'recovery_invalid' });
  await assert.rejects(Auth.beginRecovery(client({ otherUser: { id: 'another-user' } }), {}), { code: 'recovery_invalid' });
});

test('reset checks password matching, current identity and the server update result', async () => {
  const api = client();
  await assert.rejects(Auth.updatePassword(api, user.id, password, 'different'), /not match/);
  assert.equal(api.calls.length, 0);
  const switched = client({ otherUser: { id: 'another-user' } });
  await assert.rejects(Auth.updatePassword(switched, user.id, password, password), { code: 'recovery_invalid' });
  assert.equal(switched.calls.some(([method]) => method === 'updateUser'), false);
  await Auth.updatePassword(api, user.id, password, password);
  assert.deepEqual(api.calls, [['getUser'], ['updateUser', { password }]]);
  await assert.rejects(Auth.updatePassword(client({ updateError: { code: 'weak_password' } }), user.id, password, password), { code: 'weak_password' });
});

test('errors are actionable without reflecting private backend diagnostics', () => {
  assert.match(Auth.errorMessage({ code: 'invalid_credentials' }), /Invalid email or password/);
  assert.match(Auth.errorMessage({ code: 'email_not_confirmed' }), /Confirm your email/);
  assert.match(Auth.errorMessage({ status: 429 }), /Too many/);
  assert.match(Auth.errorMessage({ code: 'same_password' }), /different password/);
  assert.match(Auth.errorMessage({ code: 'weak_password' }), /stronger password/);
  assert.match(Auth.errorMessage({ code: 'email_address_not_authorized' }), /email delivery/);
  assert.match(Auth.errorMessage(new Error('Failed to fetch')), /internet connection/);
  assert.doesNotMatch(Auth.errorMessage({ message: 'backend secret: do-not-display' }), /do-not-display/);
});
