// Optional browser regression suite. Requires Playwright + Chromium (see README).
// All backend traffic is intercepted: no credentials or real uploads are used.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

let browser;
let server;
let base;
const root = path.resolve(__dirname, '..');
const textFile = { name: 'my-story.txt', mimeType: 'text/plain', buffer: Buffer.from('A local browser test, not a real upload.') };
const imageFile = { name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };

before(async () => {
  server = createServer(async (req, res) => {
    const name = path.basename(new URL(req.url, 'http://localhost').pathname) || 'index.html';
    if (!/^[a-z-]+\.(html|js|css|svg)$/.test(name)) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(path.join(root, name));
      res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript');
      res.end(body);
    } catch (_error) { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
});

async function openPage(t, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1366, height: 900 } });
  t.after(() => context.close());
  const errors = [];
  const requests = [];
  let releaseUpload;
  const uploadGate = new Promise((resolve) => { releaseUpload = resolve; });
  t.after(() => releaseUpload());
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'no uncaught browser errors'));
  await page.addInitScript(({ signedIn, databaseError, legacySchema, feedRows, expiredAuth }) => {
    const user = { id: 'user-test', email: 'creator@example.test', user_metadata: { display_name: 'Test creator' } };
    let currentUser = signedIn ? user : null;
    let authCallback = () => {};
    window.__inserts = [];
    window.__videoSelects = [];
    window.__authCalls = [];
    window.__storageUploads = [];
    window.__revoked = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => { window.__revoked.push(url); revoke(url); };
    window.__client = {
      auth: {
        async getSession() { window.__authCalls.push('getSession'); return { data: { session: currentUser ? { user: currentUser } : null } }; },
        async getUser() { window.__authCalls.push('getUser'); return expiredAuth ? { data: { user: null }, error: { message: 'JWT expired' } } : { data: { user: currentUser } }; },
        onAuthStateChange(callback) { authCallback = callback; },
        async signInWithPassword({ password }) {
          window.__authCalls.push('signInWithPassword');
          if (password === 'wrong-password') return { error: { message: 'Invalid login credentials' } };
          currentUser = user;
          authCallback('SIGNED_IN', { user });
          return { data: { session: { user } } };
        },
        async signUp() { return { data: { session: null } }; },
        async signOut() { currentUser = null; authCallback('SIGNED_OUT', null); return {}; },
      },
      from(table) {
        let columns = '';
        const query = {
          async upsert() { return { data: [], error: null }; },
          insert(payload) { window.__inserts.push(payload); return { select() { return { async single() {
            if (legacySchema && Object.hasOwn(payload, 'media_type')) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'media_type' column of 'videos' in the schema cache" } };
            return databaseError ? { error: { message: 'Database refused this record' } } : { data: { id: 'published-test', ...payload } };
          } }; } }; },
          select(value) { columns = value; if (table === 'videos') window.__videoSelects.push(value); return query; }, eq() { return query; }, order() { return query; }, limit() { return query; }, in() { return query; },
          then(resolve) {
            if (table === 'videos' && legacySchema && columns.includes('media_type')) return resolve({ data: null, error: { code: '42703', message: 'column videos.media_type does not exist' } });
            resolve({ data: table === 'videos' ? feedRows : [], error: null });
          },
        };
        return query;
      },
      storage: { from(bucket) { return {
        async upload(objectPath, file) { window.__storageUploads.push({ bucket, name: file.name, objectPath }); return { error: null }; },
        getPublicUrl(objectPath) { return { data: { publicUrl: `https://storage.example.test/${bucket}/${objectPath}` } }; },
        async remove() { return { error: null }; },
      }; } },
    };
  }, { signedIn: options.signedIn !== false, databaseError: Boolean(options.databaseError), legacySchema: Boolean(options.legacySchema), feedRows: options.feedRows || [], expiredAuth: Boolean(options.expiredAuth) });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/supabase-config.js')) return route.fulfill({ contentType: 'application/javascript', body: 'window.SUPABASE_CONFIG = {url: "https://example.supabase.co", anonKey: "test-only"};' });
    if (url.pathname.endsWith('/cloudinary-config.js')) return route.fulfill({ contentType: 'application/javascript', body: options.fallback ? 'window.CLOUDINARY_CONFIG = {};' : 'window.CLOUDINARY_CONFIG = {cloudName: "test-only", unsignedUploadPreset: "test-only"};' });
    if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'application/javascript', body: options.noSdk ? '' : 'window.supabase = {createClient() { return window.__client; }};' });
    if (url.hostname === 'api.cloudinary.com') {
      requests.push(route.request());
      if (options.holdUpload) await uploadGate;
      const failed = options.failFirst && requests.length === 1;
      return route.fulfill({ status: failed ? 400 : 200, contentType: 'application/json', body: JSON.stringify(failed ? { error: { message: 'Upload preset rejected this file' } } : { resource_type: 'raw', secure_url: 'https://res.cloudinary.com/test-only/raw/upload/v1/story.txt' }) });
    }
    if (url.origin === base) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(`${base}/${options.start || 'upload.html'}`);
  if (options.signedIn === false || options.noSdk || options.expiredAuth) {
    await page.waitForURL('**/login.html**');
  } else if (!options.start || options.start === 'upload.html') {
    await page.waitForFunction(() => !document.querySelector('#upload-account-label').textContent.includes('Checking'));
  }
  return { page, requests, releaseUpload };
}

async function chooseAndReview(page, file = textFile) {
  await page.locator('#upload-file').setInputFiles(file);
  await page.locator('#upload-description').fill('A useful description.');
  await page.locator('#upload-category').selectOption('Design');
  await page.locator('#upload-next').click();
  await page.locator('#upload-review').waitFor({ state: 'visible' });
}

test('home, Studio, and legacy upload links reach the standalone page', async (t) => {
  const { page } = await openPage(t, { start: 'index.html' });
  assert.equal(await page.locator('#upload-modal').count(), 0);
  await page.getByRole('link', { name: 'Create an upload' }).click();
  await page.waitForURL('**/upload.html');
  assert.equal(await page.locator('h1').textContent(), 'Upload your next story.');
  await page.goto(`${base}/studio.html`);
  await page.locator('[data-studio-upload]').click();
  await page.waitForURL('**/upload.html');
  await page.goto(`${base}/index.html#upload`);
  await page.waitForURL('**/upload.html');
});

test('details validate before review, stay local, and preserve custom titles', async (t) => {
  const { page, requests } = await openPage(t);
  await page.locator('#upload-next').click();
  assert.match(await page.locator('#upload-feedback').textContent(), /Select a file/);
  await page.locator('#upload-file').setInputFiles({ ...textFile, buffer: Buffer.alloc(0) });
  assert.match(await page.locator('#upload-feedback').textContent(), /non-empty/);
  await page.locator('#upload-file').setInputFiles(textFile);
  assert.equal(await page.locator('#upload-title').inputValue(), 'my story');
  await page.locator('#upload-title').fill('   ');
  await page.locator('#upload-next').click();
  assert.match(await page.locator('#upload-feedback').textContent(), /Title is required/);
  await page.locator('#upload-title').fill('My custom title');
  await page.locator('#upload-file').setInputFiles({ ...textFile, name: 'new-file.txt' });
  assert.equal(await page.locator('#upload-title').inputValue(), 'My custom title');
  assert.equal(await page.locator('#upload-title-count').textContent(), '15 / 100');
  await page.locator('#upload-next').click();
  assert.equal(await page.locator('#upload-review-name').textContent(), 'My custom title');
  await page.locator('#upload-publish').click();
  assert.match(await page.locator('#upload-feedback').textContent(), /permission.*publicly/);
  assert.equal(requests.length, 0, 'nothing is transferred before explicit publish confirmation');
  await page.locator('#upload-back').click();
  assert.equal(await page.locator('#upload-title').inputValue(), 'My custom title');
});

test('drag/drop, safe previews, thumbnail replacement, and URL cleanup', async (t) => {
  const { page } = await openPage(t);
  await page.locator('#upload-dropzone').evaluate((zone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['<script>window.injection = true</script>'], '<script>.html', { type: 'text/html' }));
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  });
  assert.equal(await page.locator('#upload-file-name').textContent(), '<script>.html');
  assert.equal(await page.locator('#upload-preview iframe').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.injection)), false);
  await page.locator('#upload-thumbnail').setInputFiles(textFile);
  assert.match(await page.locator('#upload-feedback').textContent(), /image format/);
  await page.locator('#upload-thumbnail').setInputFiles(imageFile);
  assert.equal(await page.locator('#upload-preview img').count(), 1);
  await page.locator('#upload-remove-thumbnail').click();
  assert.equal(await page.locator('#upload-preview img').count(), 0);
  await page.locator('#upload-file').setInputFiles(imageFile);
  assert.equal(await page.locator('#upload-preview img').count(), 1);
  await page.locator('#upload-remove').click();
  assert.equal(await page.locator('#upload-dropzone').isVisible(), true);
  assert.ok(await page.evaluate(() => window.__revoked.length >= 3));
});

test('publishes once, shows real upload state, and links to the returned record', async (t) => {
  const { page, requests, releaseUpload } = await openPage(t, { holdUpload: true });
  await chooseAndReview(page);
  await page.locator('#upload-public-confirm').check();
  await page.locator('#upload-publish').click();
  await page.waitForFunction(() => document.querySelector('#upload-status').textContent === 'Uploading your file…');
  assert.equal(await page.locator('#upload-fields').evaluate((element) => element.disabled), true);
  assert.equal(await page.locator('#upload-publish').isDisabled(), true);
  assert.equal(await page.locator('#upload-title').isDisabled(), true);
  assert.equal(await page.locator('#upload-progress').getAttribute('value'), null, 'no invented upload percentage');
  await page.locator('#upload-form').evaluate((form) => form.dispatchEvent(new Event('submit', { cancelable: true })));
  releaseUpload();
  await page.locator('#upload-success').waitFor({ state: 'visible' });
  assert.equal(requests.length, 1);
  assert.equal(await page.locator('#upload-view').getAttribute('href'), 'index.html#watch=published-test');
  const records = await page.evaluate(() => window.__inserts);
  assert.equal(records.length, 1);
  assert.equal(records[0].title, 'my story');
  assert.equal(records[0].description, 'A useful description.');
  assert.equal(records[0].category, 'Design');
  assert.equal(records[0].media_type, 'text/plain');
  await page.locator('#upload-another').click();
  assert.equal(await page.locator('#upload-title').inputValue(), '');
  assert.equal(await page.locator('#upload-dropzone').isVisible(), true);
  assert.equal(await page.locator('#upload-public-confirm').isChecked(), false);
});

test('failed upload keeps details and selection for an intentional retry', async (t) => {
  const { page, requests } = await openPage(t, { failFirst: true });
  await chooseAndReview(page);
  await page.locator('#upload-public-confirm').check();
  await page.locator('#upload-publish').click();
  await page.locator('#upload-feedback').waitFor({ state: 'visible' });
  assert.match(await page.locator('#upload-feedback').textContent(), /preset rejected/);
  assert.equal(await page.locator('#upload-fields').evaluate((element) => element.disabled), false);
  assert.equal(await page.locator('#upload-success').isVisible(), false);
  assert.equal(await page.locator('#upload-title').inputValue(), 'my story');
  assert.equal(await page.locator('#upload-description').inputValue(), 'A useful description.');
  assert.equal(await page.evaluate(() => window.__inserts.length), 0);
  await page.locator('#upload-publish').click();
  await page.locator('#upload-success').waitFor({ state: 'visible' });
  assert.equal(requests.length, 2);
});

test('database failure is not shown as success after media transfer', async (t) => {
  const { page } = await openPage(t, { databaseError: true });
  await chooseAndReview(page);
  await page.locator('#upload-public-confirm').check();
  await page.locator('#upload-publish').click();
  await page.locator('#upload-feedback').waitFor({ state: 'visible' });
  assert.match(await page.locator('#upload-feedback').textContent(), /Database refused/);
  assert.match(await page.locator('#upload-progress-note').textContent(), /avoid duplicates/);
  assert.equal(await page.locator('#upload-success').isVisible(), false);
});

test('a guest is redirected to Supabase login before the upload page is accessible', async (t) => {
  const { page, requests } = await openPage(t, { signedIn: false });
  assert.match(page.url(), /login\.html/);
  assert.match(new URL(page.url()).searchParams.get('next'), /upload\.html/);
  assert.equal(requests.length, 0);
});

test('Supabase fallback shows its actual limits and rejects non-video files', async (t) => {
  const { page, requests } = await openPage(t, { fallback: true });
  assert.match(await page.locator('#upload-provider').textContent(), /Supabase/);
  assert.match(await page.locator('#upload-file-limits').textContent(), /50 MiB/);
  assert.match(await page.locator('#upload-thumbnail-limits').textContent(), /5 MiB/);
  await page.locator('#upload-file').setInputFiles(textFile);
  assert.match(await page.locator('#upload-feedback').textContent(), /allowed file type/);
  await chooseAndReview(page, { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from('test file: preview may fail, upload is mocked') });
  await page.locator('#upload-public-confirm').check();
  await page.locator('#upload-publish').click();
  await page.locator('#upload-success').waitFor({ state: 'visible' });
  assert.equal(requests.length, 0);
  assert.equal(await page.evaluate(() => window.__storageUploads.length), 1);
});

test('missing Supabase SDK cannot bypass the protected-page login gate', async (t) => {
  const { page, requests } = await openPage(t, { noSdk: true });
  assert.match(page.url(), /login\.html/);
  assert.equal(requests.length, 0);
});

test('mobile form and review fit the viewport and remain usable', async (t) => {
  const { page } = await openPage(t, { viewport: { width: 375, height: 812 } });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(await overflow(), false);
  await chooseAndReview(page, { ...textFile, name: 'a'.repeat(160) + '.txt' });
  assert.equal(await overflow(), false);
  assert.equal(await page.locator('#upload-publish').isVisible(), true);
  await page.locator('#upload-back').click();
  assert.equal(await overflow(), false);
});

test('the screenshot schema error recovers in the browser without retransferring to Cloudinary', async (t) => {
  const { page, requests } = await openPage(t, { legacySchema: true, viewport: { width: 400, height: 554 } });
  assert.match(await page.locator('#upload-account-hint').textContent(), /Supabase Auth/);
  assert.match(await page.locator('#upload-provider').textContent(), /Cloudinary media storage/);
  await chooseAndReview(page);
  await page.locator('#upload-public-confirm').check();
  await page.locator('#upload-publish').click();
  await page.locator('#upload-success').waitFor({ state: 'visible' });
  const inserts = await page.evaluate(() => window.__inserts);
  assert.equal(inserts.length, 2);
  assert.equal(Object.hasOwn(inserts[1], 'media_type'), false);
  assert.equal(inserts[1].owner_id, inserts[0].owner_id);
  assert.equal(inserts[1].video_url, inserts[0].video_url);
  assert.equal(requests.length, 1);
  assert.equal(await page.locator('#upload-feedback').isVisible(), false);
});

test('legacy schema also works through the Supabase Storage publishing path', async (t) => {
  const { page, requests } = await openPage(t, { fallback: true, legacySchema: true });
  await chooseAndReview(page, { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from('local test fixture') });
  await page.locator('#upload-public-confirm').check();
  await page.locator('#upload-publish').click();
  await page.locator('#upload-success').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.__storageUploads.length), 1);
  assert.equal(await page.evaluate(() => window.__inserts.length), 2);
  assert.equal(requests.length, 0);
});

test('legacy feed loads without querying the absent column and renders the right file types', async (t) => {
  const files = [
    { id: 'legacy-video', title: 'Legacy video', video_url: 'https://res.cloudinary.com/test-only/video/upload/v1/clip.mp4', selector: 'video' },
    { id: 'legacy-image', title: 'Legacy picture', video_url: 'https://res.cloudinary.com/test-only/image/upload/v1/photo.png', selector: 'img' },
    { id: 'legacy-file', title: 'Legacy document', video_url: 'https://res.cloudinary.com/test-only/raw/upload/v1/notes.txt', selector: 'a.watch-player__download' },
  ];
  const { page } = await openPage(t, { start: 'index.html', legacySchema: true, feedRows: files.map(({ selector, ...file }) => ({ ...file, owner_id: null, category: 'Design', visibility: 'public' })) });
  await page.waitForFunction(() => document.querySelector('#video-grid').textContent.includes('Legacy video'));
  assert.deepEqual(await page.evaluate(() => window.__videoSelects), ['*']);
  for (const file of files) {
    await page.evaluate((id) => { window.location.hash = `watch=${id}`; }, file.id);
    await page.waitForFunction((title) => document.querySelector('#watch-page-title').textContent === title, file.title);
    assert.equal(await page.locator(`#watch-page-player ${file.selector}`).count(), 1, file.title);
  }
});

test('an expired Supabase session cannot access the upload page', async (t) => {
  const { page, requests } = await openPage(t, { expiredAuth: true, legacySchema: true });
  assert.match(page.url(), /login\.html/);
  assert.equal(requests.length, 0);
});

test('upload page includes a working local favicon', async (t) => {
  const { page } = await openPage(t);
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  assert.equal(href, 'favicon.svg');
  const response = await page.request.get(`${base}/${href}`);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['content-type'], /image\/svg\+xml/);
});
