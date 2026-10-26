const test = require('node:test');
const assert = require('node:assert/strict');
const TubeUpload = require('../upload-service.js');

const videoFile = (overrides = {}) => ({
  name: 'sample.mp4',
  size: 1024,
  type: 'video/mp4',
  ...overrides,
});

const thumbnailFile = (overrides = {}) => ({
  name: 'thumb.png',
  size: 512,
  type: 'image/png',
  ...overrides,
});

function makeClient(options = {}) {
  const calls = {
    auth: 0,
    profiles: [],
    uploads: [],
    publicUrls: [],
    removals: [],
    inserts: [],
  };
  const users = options.users || [{ id: 'user-1' }];
  const uploaded = new Map();
  const row = options.row || { id: 'video-1', owner_id: 'user-1', title: 'Published video' };

  const storage = {
    from(bucket) {
      return {
        async upload(path, file, uploadOptions) {
          calls.uploads.push({ bucket, path, file, uploadOptions });
          if (options.uploadError && (!options.uploadErrorBucket || options.uploadErrorBucket === bucket)) {
            return { error: new Error(options.uploadError) };
          }
          uploaded.set(`${bucket}/${path}`, true);
          return { data: { path }, error: null };
        },
        getPublicUrl(path) {
          calls.publicUrls.push({ bucket, path });
          return { data: { publicUrl: `https://cdn.test/${bucket}/${path}` }, error: null };
        },
        async remove(paths) {
          calls.removals.push({ bucket, paths });
          if (options.cleanupError && (!options.cleanupErrorBucket || options.cleanupErrorBucket === bucket)) {
            return { error: new Error(options.cleanupError) };
          }
          paths.forEach((path) => uploaded.delete(`${bucket}/${path}`));
          return { data: null, error: null };
        },
      };
    },
  };

  const client = {
    calls,
    storage,
    auth: {
      async getUser() {
        const user = users[Math.min(calls.auth, users.length - 1)];
        calls.auth += 1;
        return options.authError ? { data: { user: null }, error: new Error(options.authError) } : { data: { user }, error: null };
      },
    },
    from(table) {
      if (table === 'profiles') {
        return {
          async upsert(payload, upsertOptions) {
            calls.profiles.push({ payload, upsertOptions });
            if (options.profileError) return { error: new Error(options.profileError) };
            return { data: null, error: null };
          },
        };
      }
      if (table === 'videos') {
        return {
          insert(payload) {
            calls.inserts.push(payload);
            return {
              select() {
                return {
                  async single() {
                    if (options.missingMediaType && Object.hasOwn(payload, 'media_type')) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'media_type' column of 'videos' in the schema cache" } };
                    if (options.insertError) return { data: null, error: new Error(options.insertError) };
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  return client;
}

const validInput = (overrides = {}) => ({
  title: '  A useful upload  ',
  description: 'A short description.',
  category: 'Music',
  videoFile: videoFile(),
  durationSeconds: 12.5,
  ...overrides,
});

test('requires an authenticated user', async () => {
  const client = makeClient({ users: [null] });
  await assert.rejects(
    TubeUpload.publishVideo(client, validInput()),
    /sign in before uploading/i,
  );
  assert.equal(client.calls.uploads.length, 0);
});

test('publishes a valid video and returns the readback row', async () => {
  const row = { id: 'video-1', owner_id: 'user-1', title: 'Published video' };
  const client = makeClient({ row });
  const result = await TubeUpload.publishVideo(client, validInput());

  assert.deepEqual(result, row);
  assert.deepEqual(client.calls.profiles[0], {
    payload: { id: 'user-1' },
    upsertOptions: { onConflict: 'id', ignoreDuplicates: true },
  });
  assert.equal(client.calls.uploads.length, 1);
  assert.match(client.calls.uploads[0].path, /^user-1\/[0-9a-f-]{36}\.mp4$/i);
  assert.deepEqual(client.calls.inserts[0], {
    owner_id: 'user-1',
    title: 'A useful upload',
    description: 'A short description.',
    category: 'Music',
     duration_seconds: 13,
    visibility: 'public',
    media_type: 'video/mp4',
    video_url: client.calls.publicUrls[0] && `https://cdn.test/videos/${client.calls.uploads[0].path}`,
    thumbnail_url: null,
  });
  assert.equal(client.calls.auth, 2);
});

test('rounds fractional browser video duration for the integer database column', async () => {
  const client = makeClient();
  await TubeUpload.publishVideo(client, validInput({ durationSeconds: 12.533333 }));
  assert.equal(client.calls.inserts[0].duration_seconds, 13);
});

test('publishes on a legacy videos schema without reuploading or deleting media', async () => {
  const client = makeClient({ missingMediaType: true });
  const result = await TubeUpload.publishVideo(client, validInput());
  assert.equal(result.id, 'video-1');
  assert.equal(client.calls.uploads.length, 1);
  assert.equal(client.calls.removals.length, 0);
  assert.equal(client.calls.inserts.length, 2);
  assert.equal(Object.hasOwn(client.calls.inserts[1], 'media_type'), false);
  assert.equal(client.calls.inserts[0].video_url, client.calls.inserts[1].video_url);
});

test('rejects invalid title, video type, empty video, and oversized files', () => {
  assert.throws(() => TubeUpload.validateUpload(validInput({ title: '   ' })), /title is required/i);
  assert.throws(() => TubeUpload.validateUpload(validInput({ title: 'x'.repeat(101) })), /100 characters/i);
  assert.throws(() => TubeUpload.validateUpload(validInput({ videoFile: videoFile({ type: 'video/avi' }) })), /allowed file type/i);
  assert.throws(() => TubeUpload.validateUpload(validInput({ videoFile: videoFile({ size: 0 }) })), /cannot be empty/i);
  assert.throws(() => TubeUpload.validateUpload(validInput({ videoFile: videoFile({ size: TubeUpload.MAX_VIDEO_BYTES + 1 }) })), /50 MiB/i);
});

test('rejects an oversized optional thumbnail and invalid category', () => {
  assert.throws(() => TubeUpload.validateUpload(validInput({ category: 'Unknown category' })), /valid video category/i);
  assert.throws(() => TubeUpload.validateUpload(validInput({ thumbnailFile: thumbnailFile({ size: TubeUpload.MAX_THUMBNAIL_BYTES + 1 }) })), /5 MiB/i);
});

test('surfaces storage upload errors without attempting cleanup for an incomplete write', async () => {
  const client = makeClient({ uploadError: 'bucket denied' });
  await assert.rejects(
    TubeUpload.publishVideo(client, validInput()),
    /uploading the video: bucket denied/i,
  );
  assert.equal(client.calls.removals.length, 0);
});

test('uploads an optional thumbnail and includes its public URL', async () => {
  const client = makeClient();
  await TubeUpload.publishVideo(client, validInput({ thumbnailFile: thumbnailFile() }));

  assert.deepEqual(client.calls.uploads.map((call) => call.bucket), ['videos', 'thumbnails']);
  assert.match(client.calls.uploads[1].path, /^user-1\/[0-9a-f-]{36}\.png$/i);
  assert.equal(client.calls.inserts[0].thumbnail_url, `https://cdn.test/thumbnails/${client.calls.uploads[1].path}`);
});

test('cleans both uploaded files when the insert fails', async () => {
  const client = makeClient({ insertError: 'row violates RLS policy' });
  await assert.rejects(
    TubeUpload.publishVideo(client, validInput({ thumbnailFile: thumbnailFile() })),
    /saving the video record: row violates RLS policy/i,
  );
  assert.deepEqual(client.calls.removals.map((call) => call.bucket), ['thumbnails', 'videos']);
  assert.equal(client.calls.removals.every((call) => call.paths.length === 1), true);
});

test('cleans uploaded files if the authenticated account changes', async () => {
  const client = makeClient({ users: [{ id: 'user-1' }, { id: 'user-2' }] });
  await assert.rejects(
    TubeUpload.publishVideo(client, validInput({ thumbnailFile: thumbnailFile() })),
    /account changed during upload/i,
  );
  assert.equal(client.calls.inserts.length, 0);
  assert.deepEqual(client.calls.removals.map((call) => call.bucket), ['thumbnails', 'videos']);
});

test('surfaces cleanup failures while preserving the original failure', async () => {
  const client = makeClient({ insertError: 'insert failed', cleanupError: 'remove forbidden', cleanupErrorBucket: 'thumbnails' });
  await assert.rejects(
    TubeUpload.publishVideo(client, validInput({ thumbnailFile: thumbnailFile() })),
    (error) => {
      assert.match(error.message, /insert failed/i);
      assert.match(error.message, /cleanup failed/i);
      assert.match(error.message, /remove forbidden/i);
      return true;
    },
  );
  assert.deepEqual(client.calls.removals.map((call) => call.bucket), ['thumbnails', 'videos']);
});
