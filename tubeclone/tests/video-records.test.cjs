const test = require('node:test');
const assert = require('node:assert/strict');
const VideoRecords = require('../video-records.js');

const missing = { code: 'PGRST204', message: "Could not find the 'media_type' column of 'videos' in the schema cache" };
const payload = { owner_id: 'owner-1', title: 'An upload', video_url: 'https://cdn.example.test/clip.webm', thumbnail_url: null, visibility: 'public', media_type: 'video/webm' };

function clientWith(results) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'videos');
      return { insert(value) {
        calls.push(value);
        return { select() { return { async single() {
          const result = results[calls.length - 1];
          if (result instanceof Error) throw result;
          return result;
        } }; } };
      } };
    },
  };
}

test('only recognizes a missing media_type column in videos, not auth or unrelated errors', () => {
  assert.equal(VideoRecords.isMissingMediaType(missing), true);
  assert.equal(VideoRecords.isMissingMediaType({ code: '42703', message: 'column videos.media_type does not exist' }), true);
  for (const error of [
    null,
    { code: '42501', message: 'permission denied for column media_type of videos' },
    { code: 'PGRST204', message: "Could not find the 'category' column of 'videos' in the schema cache" },
    { code: 'PGRST204', message: "Could not find the 'media_type' column of 'profiles' in the schema cache" },
    { code: 'PGRST301', message: 'JWT expired' },
    { message: missing.message },
  ]) assert.equal(VideoRecords.isMissingMediaType(error), false);
});

test('keeps the modern insert and readback unchanged', async () => {
  const result = { data: { id: 'record-1', ...payload }, error: null };
  const client = clientWith([result]);
  assert.equal(await VideoRecords.insertVideo(client, payload), result);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].media_type, 'video/webm');
});

test('retries only the optional metadata without mutating the original payload', async () => {
  const { media_type, ...legacyPayload } = payload;
  const result = { data: { id: 'record-1', ...legacyPayload }, error: null };
  const client = clientWith([{ data: null, error: missing }, result]);
  assert.equal(await VideoRecords.insertVideo(client, payload), result);
  assert.deepEqual(client.calls[1], legacyPayload);
  assert.equal(payload.media_type, media_type);
  assert.equal(client.calls[1].owner_id, payload.owner_id);
  assert.equal(client.calls[1].visibility, 'public');
});

test('does not retry RLS, authentication, unrelated schema, or network failures', async () => {
  for (const error of [
    { code: '42501', message: 'row violates row-level security policy' },
    { code: 'PGRST301', message: 'JWT expired' },
    { code: 'PGRST204', message: "Could not find the 'title' column of 'videos' in the schema cache" },
  ]) {
    const client = clientWith([{ data: null, error }]);
    const result = await VideoRecords.insertVideo(client, payload);
    assert.equal(result.error, error);
    assert.equal(client.calls.length, 1);
  }
  const client = clientWith([new Error('Network disconnected')]);
  await assert.rejects(VideoRecords.insertVideo(client, payload), /Network disconnected/);
  assert.equal(client.calls.length, 1, 'an ambiguous network failure must not create a duplicate');
});

test('surfaces the second error and stops after one schema compatibility retry', async () => {
  const error = { code: '42501', message: 'RLS denied' };
  const client = clientWith([{ error: missing }, { error }]);
  assert.equal((await VideoRecords.insertVideo(client, payload)).error, error);
  assert.equal(client.calls.length, 2);
});

test('renders legacy rows by URL without treating every file as an MP4', () => {
  const examples = [
    ['https://cdn.example.test/video.WEBM?token=test#fragment', 'video/webm'],
    ['https://cdn.example.test/music.mp3', 'audio/mpeg'],
    ['https://cdn.example.test/photo.png', 'image/png'],
    ['https://cdn.example.test/document.pdf', 'application/pdf'],
    ['https://res.cloudinary.com/demo/video/upload/f_auto:video/v1/clip', 'video/mp4'],
    ['https://res.cloudinary.com/demo/image/upload/f_auto/v1/photo', 'image/jpeg'],
    ['https://res.cloudinary.com/demo/image/upload/v1/file.pdf', 'application/pdf'],
    ['https://res.cloudinary.com/demo/raw/upload/v1/page.html', 'application/octet-stream'],
    ['https://example.test/video/upload/file', 'application/octet-stream'],
    ['https://cdn.example.test/file.constructor', 'application/octet-stream'],
    ['https://cdn.example.test/archive', 'application/octet-stream'],
    ['javascript:alert(1)', 'application/octet-stream'],
    ['not a URL', 'application/octet-stream'],
  ];
  for (const [url, type] of examples) {
    assert.equal(VideoRecords.mediaTypeFor({ video_url: url }), type, url);
    assert.equal(VideoRecords.mediaTypeFor({ video_url: url, media_type: null }), type, `nullable migration: ${url}`);
  }
  assert.equal(VideoRecords.mediaTypeFor({ video_url: 'https://cdn.example.test/clip', media_type: 'audio/mp4' }), 'audio/mp4');
  assert.equal(VideoRecords.mediaTypeFor({ video_url: 'https://cdn.example.test/raw.png', media_type: 'application/octet-stream' }), 'application/octet-stream');
});
