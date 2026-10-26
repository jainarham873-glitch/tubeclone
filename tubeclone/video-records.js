(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TubeVideoRecords = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isMissingMediaType(error) {
    if (!error || ['PGRST204', '42703'].indexOf(error.code) === -1) return false;
    var message = String(error.message || '');
    return /\bmedia_type\b/i.test(message) && /\bvideos\b/i.test(message) && /\bcolumn\b/i.test(message)
      && /could not find|does not exist/i.test(message);
  }

  async function insertVideo(client, payload) {
    var result = await client.from('videos').insert(payload).select().single();
    // Only a known missing optional column is safe to retry: this error rejects
    // the original insert. Never retry auth/RLS, network, or ambiguous failures.
    if (isMissingMediaType(result && result.error) && Object.prototype.hasOwnProperty.call(payload, 'media_type')) {
      var legacyPayload = Object.assign({}, payload);
      delete legacyPayload.media_type;
      result = await client.from('videos').insert(legacyPayload).select().single();
    }
    return result;
  }

  var MEDIA_TYPES = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska', ogv: 'video/ogg',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
    flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
    pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip',
  };

  function mediaTypeFor(row) {
    var explicit = row && typeof row.media_type === 'string' ? row.media_type.trim().toLowerCase() : '';
    if (explicit) return explicit;
    try {
      var url = new URL(row.video_url);
      if (['http:', 'https:'].indexOf(url.protocol) === -1) return 'application/octet-stream';
      var cloudinary = url.hostname === 'res.cloudinary.com';
      // Raw Cloudinary assets should remain downloads, not active inline content.
      if (cloudinary && /^\/[^/]+\/raw\/upload\//.test(url.pathname)) return 'application/octet-stream';
      var extension = /\.([a-z0-9]+)$/i.exec(url.pathname);
      if (extension && Object.prototype.hasOwnProperty.call(MEDIA_TYPES, extension[1].toLowerCase())) return MEDIA_TYPES[extension[1].toLowerCase()];
      // Auto-format Cloudinary delivery URLs can omit an extension.
      if (cloudinary && /^\/[^/]+\/video\/upload\//.test(url.pathname)) return 'video/mp4';
      if (cloudinary && /^\/[^/]+\/image\/upload\//.test(url.pathname)) return 'image/jpeg';
    } catch (_error) { /* Unknown formats are downloads rather than broken videos. */ }
    return 'application/octet-stream';
  }

  return { insertVideo: insertVideo, mediaTypeFor: mediaTypeFor, isMissingMediaType: isMissingMediaType };
}));
