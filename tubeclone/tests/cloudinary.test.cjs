const test = require('node:test');
const assert = require('node:assert/strict');
const CloudinaryUpload = require('../cloudinary-service.js');

const videoFile = (overrides = {}) => ({ name: 'sample.mp4', size: 1024, type: 'video/mp4', ...overrides });

function makeClient(options = {}) {
  const calls = { auth: 0, profile: null, insert: null, inserts: [] };
  return {
    calls,
    auth: { async getUser() {
      const users = options.users || [{ id: 'user-1' }];
      const user = users[Math.min(calls.auth, users.length - 1)];
      calls.auth += 1;
      return { data: { user }, error: options.authError || null };
    } },
    from(table) {
      if (table === 'profiles') return { async upsert(payload, options) { calls.profile = { payload, options }; return { data: null, error: null }; } };
      if (table === 'videos') return { insert(payload) {
        calls.insert = payload;
        calls.inserts.push(payload);
        return { select() { return { async single() {
          if (options.missingMediaType && Object.hasOwn(payload, 'media_type')) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'media_type' column of 'videos' in the schema cache" } };
          if (options.insertError) return { data: null, error: options.insertError };
          return { data: { id: 'video-1', ...payload }, error: null };
        } }; } };
      } };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

test('validates Cloudinary-compatible upload files', () => {
  assert.throws(() => CloudinaryUpload.validateUpload({ title: '', category: 'Music', videoFile: videoFile() }), /title is required/i);
  assert.doesNotThrow(() => CloudinaryUpload.validateUpload({ title: 'Test', category: 'Music', videoFile: videoFile({ type: 'application/pdf' }) }));
  assert.doesNotThrow(() => CloudinaryUpload.validateUpload({ title: 'Test', category: 'Music', videoFile: videoFile({ type: 'video/avi' }) }));
  assert.doesNotThrow(() => CloudinaryUpload.validateUpload({ title: 'Test', category: 'Music', videoFile: videoFile({ name: 'voice.flac', type: '' }) }));
  const result = CloudinaryUpload.validateUpload({ title: ' Test ', category: 'Music', videoFile: videoFile(), durationSeconds: 12.6 });
  assert.equal(result.title, 'Test');
  assert.equal(result.durationSeconds, 13);
});

test('publishes Cloudinary URLs into the Supabase video row', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(url);
    return { ok: true, status: 200, async json() { return { secure_url: `https://res.cloudinary.com/demo/video/upload/v1/tubeclone/${requests.length}.mp4` }; } };
  };
  try {
    const client = makeClient();
    const row = await CloudinaryUpload.publishVideo(client, { title: 'Cloud video', category: 'Music', videoFile: videoFile(), durationSeconds: 4.2 }, null, { cloudName: 'demo', unsignedUploadPreset: 'tubeclone-test' });
    assert.equal(row.video_url, 'https://res.cloudinary.com/demo/video/upload/w_1920,q_auto/f_auto:video/v1/tubeclone/1.mp4');
    assert.equal(client.calls.insert.media_type, 'video/mp4');
    assert.equal(client.calls.insert.duration_seconds, 4);
    assert.equal(client.calls.auth, 2);
    assert.equal(requests.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('reports the actual Cloudinary app size limits shown on the upload page', () => {
  const input = { title: 'Test', category: 'Other', videoFile: videoFile() };
  assert.throws(() => CloudinaryUpload.validateUpload({ ...input, videoFile: videoFile({ size: CloudinaryUpload.MAX_VIDEO_BYTES + 1 }) }), /2 GiB/);
  assert.throws(() => CloudinaryUpload.validateUpload({ ...input, thumbnailFile: { name: 'cover.png', type: 'image/png', size: CloudinaryUpload.MAX_THUMBNAIL_BYTES + 1 } }), /100 MiB/);
  assert.doesNotThrow(() => CloudinaryUpload.validateUpload({ ...input, videoFile: videoFile({ size: CloudinaryUpload.MAX_VIDEO_BYTES }) }));
  assert.throws(() => CloudinaryUpload.validateUpload({ ...input, videoFile: videoFile({ size: 0 }) }), /non-empty/);
});

test('publishes against the old videos schema without uploading the media twice', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(url);
    return { ok: true, async json() { return { resource_type: 'video', secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/movie.mp4' }; } };
  };
  try {
    const client = makeClient({ missingMediaType: true });
    const row = await CloudinaryUpload.publishVideo(client, { title: 'Existing project', category: 'Other', videoFile: videoFile() }, null, { cloudName: 'demo', unsignedUploadPreset: 'test-only' });
    assert.equal(row.id, 'video-1');
    assert.equal(requests.length, 1, 'retry only the metadata, not the Cloudinary upload');
    assert.equal(client.calls.inserts.length, 2);
    assert.equal(client.calls.inserts[0].media_type, 'video/mp4');
    assert.equal(Object.hasOwn(client.calls.inserts[1], 'media_type'), false);
    assert.equal(client.calls.inserts[1].video_url, client.calls.inserts[0].video_url);
    assert.equal(client.calls.inserts[1].owner_id, 'user-1');
  } finally { global.fetch = originalFetch; }
});

test('uses Cloudinary chunked upload headers for large media', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(options);
    return {
      ok: true,
      status: 200,
      async json() {
        return { secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/tubeclone/large.mp4' };
      },
    };
  };
  try {
    const largeFile = {
      name: 'large.mov',
      type: 'video/quicktime',
      size: CloudinaryUpload.CHUNK_THRESHOLD + 1,
      slice() { return new Blob(['chunk'], { type: 'video/quicktime' }); },
    };
    await CloudinaryUpload.publishVideo(makeClient(), { title: 'Large video', category: 'Travel', videoFile: largeFile }, null, { cloudName: 'demo', unsignedUploadPreset: 'tubeclone-test' });
    assert.equal(requests.length, 6);
    assert.match(requests[0].headers['Content-Range'], /^bytes 0-/);
    assert.match(requests[1].headers['Content-Range'], /\/104857601$/);
    assert.ok(requests[0].headers['X-Unique-Upload-Id']);
    assert.equal(requests[0].headers['X-Unique-Upload-Id'], requests[5].headers['X-Unique-Upload-Id']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Cloudinary publishing still requires a verified Supabase user', async () => {
  const originalFetch = global.fetch;
  let transfers = 0;
  global.fetch = async () => { transfers += 1; throw new Error('Must not upload'); };
  try {
    for (const options of [{ users: [null] }, { authError: { message: 'JWT expired' } }]) {
      const client = makeClient(options);
      await assert.rejects(CloudinaryUpload.publishVideo(client, { title: 'No session', category: 'Other', videoFile: videoFile() }, null, { cloudName: 'demo', unsignedUploadPreset: 'test-only' }), /Sign in|JWT expired/);
      assert.equal(client.calls.inserts.length, 0);
    }
    assert.equal(transfers, 0);
  } finally { global.fetch = originalFetch; }
});

test('changing Supabase accounts during transfer cannot publish as the previous owner', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, async json() { return { secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4' }; } });
  try {
    const client = makeClient({ users: [{ id: 'user-1' }, { id: 'user-2' }], missingMediaType: true });
    await assert.rejects(CloudinaryUpload.publishVideo(client, { title: 'Account changed', category: 'Other', videoFile: videoFile() }, null, { cloudName: 'demo', unsignedUploadPreset: 'test-only' }), /account changed/i);
    assert.equal(client.calls.inserts.length, 0);
  } finally { global.fetch = originalFetch; }
});
