(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root, require('./video-records.js'));
  } else {
    root.CloudinaryUpload = factory(root, root.TubeVideoRecords);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root, videoRecords) {
  'use strict';

  var CATEGORIES = ['Music', 'Mixes', 'Movies & TV', 'Gaming', 'News', 'Sports', 'Learning', 'Podcasts', 'Travel', 'Design', 'Fashion & Beauty', 'Live', 'Other'];
  // Cloudinary requires chunked uploads above 100 MB. Keep the browser-side
  // guard generous while still preventing accidental multi-gigabyte uploads
  // from freezing a normal browser tab.
  var MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
  var MAX_THUMBNAIL_BYTES = 100 * 1024 * 1024;
  var CHUNK_SIZE = 20 * 1024 * 1024;
  var CHUNK_THRESHOLD = 100 * 1024 * 1024;
  var MEDIA_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'flv', 'f4v', 'wmv', 'mpeg', 'mpg', 'm2ts', 'mts', 'ts', '3gp', 'ogv', 'vob', 'mxf', 'hevc', 'h264', 'h265', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus']);

  function messageOf(error) {
    if (error && typeof error === 'object') {
      var parts = [error.message, error.details, error.hint].filter(function (part) {
        return typeof part === 'string' && part.trim();
      });
      if (parts.length) return parts.join(' — ');
    }
    return error && error.message ? error.message : String(error || 'Unknown error');
  }

  function configured(config) {
    return Boolean(config && config.cloudName && config.unsignedUploadPreset);
  }

  function fileExtension(file) {
    var name = file && typeof file.name === 'string' ? file.name.toLowerCase() : '';
    var match = /\.([a-z0-9]+)$/.exec(name);
    return match ? match[1] : '';
  }

  function isMediaFile(file) {
    return Boolean(file && Number.isFinite(file.size) && file.size > 0);
  }

  function isImageFile(file) {
    var type = file && typeof file.type === 'string' ? file.type.split(';')[0].trim().toLowerCase() : '';
    if (type) return type.indexOf('image/') === 0;
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'tif', 'tiff', 'svg'].indexOf(fileExtension(file)) !== -1;
  }

  function validate(input) {
    var values = input || {};
    var title = typeof values.title === 'string' ? values.title.trim() : '';
    if (!title) throw new Error('Title is required.');
    if (title.length > 100) throw new Error('Title must be 100 characters or fewer.');
    var description = values.description == null ? '' : values.description;
    if (typeof description !== 'string') throw new Error('Description must be text.');
    if (description.length > 5000) throw new Error('Description must be 5000 characters or fewer.');
    if (CATEGORIES.indexOf(values.category) === -1) throw new Error('Choose a valid video category.');

    var video = isMediaFile(values.videoFile);
    if (!values.videoFile || !video) throw new Error('Choose a non-empty file to upload.');
    if (!Number.isFinite(values.videoFile.size) || values.videoFile.size <= 0) throw new Error('Video file cannot be empty.');
    if (values.videoFile.size > MAX_VIDEO_BYTES) throw new Error('File must be 2 GiB or smaller. Your Cloudinary account may have a lower limit.');

    if (values.thumbnailFile) {
      var thumbnail = isImageFile(values.thumbnailFile);
      if (!thumbnail) throw new Error('Thumbnail must be an image format supported by Cloudinary.');
      if (!Number.isFinite(values.thumbnailFile.size) || values.thumbnailFile.size <= 0) throw new Error('Thumbnail cannot be empty.');
      if (values.thumbnailFile.size > MAX_THUMBNAIL_BYTES) throw new Error('Thumbnail must be 100 MiB or smaller. Your Cloudinary account may have a lower limit.');
    }

    var durationSeconds = values.durationSeconds == null ? 0 : values.durationSeconds;
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error('Duration must be a nonnegative finite number.');
    return {
      title: title,
      description: description,
      category: values.category,
      videoFile: values.videoFile,
      thumbnailFile: values.thumbnailFile || null,
      durationSeconds: Math.round(durationSeconds),
    };
  }

  function report(onStatus, status, progress) {
    if (typeof onStatus !== 'function') return;
    try { onStatus(status, progress); } catch (_error) { /* status reporting is non-critical */ }
  }

  async function currentUser(client, context) {
    var result;
    try {
      result = await client.auth.getUser();
    } catch (error) {
      throw new Error('Upload failed while ' + context + ': ' + messageOf(error));
    }
    if (result && result.error) throw new Error('Upload failed while ' + context + ': ' + messageOf(result.error));
    var user = result && result.data && result.data.user;
    if (!user || !user.id) throw new Error('Upload failed: Sign in before uploading.');
    return user;
  }

  function randomUploadId() {
    var cryptoObject = root && root.crypto;
    if (!cryptoObject && typeof globalThis !== 'undefined') cryptoObject = globalThis.crypto;
    if (cryptoObject && typeof cryptoObject.randomUUID === 'function') return cryptoObject.randomUUID();
    return 'tubeclone-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function uploadBody(file, config, folder) {
    var body = new FormData();
    body.append('file', file);
    body.append('upload_preset', config.unsignedUploadPreset);
    body.append('folder', folder);
    body.append('tags', 'tubeclone');
    return body;
  }

  async function readUploadResponse(response, statusLabel) {
    var payload = {};
    try { payload = await response.json(); } catch (_error) { /* handled below */ }
    if (!response.ok || payload.error) {
      throw new Error('Upload failed while ' + statusLabel + ': ' + messageOf(payload.error || new Error('Cloudinary returned HTTP ' + response.status)));
    }
    return payload;
  }

  async function uploadAsset(file, resourceType, config, folder, statusLabel, onProgress) {
    var endpoint = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(config.cloudName) + '/' + resourceType + '/upload';
    var payload;
    var progress = typeof onProgress === 'function' ? onProgress : function () {};
    progress(0);
    if (file.size <= CHUNK_THRESHOLD) {
      try {
        payload = await readUploadResponse(await fetch(endpoint, { method: 'POST', body: uploadBody(file, config, folder) }), statusLabel);
      } catch (error) {
        if (error && /^Upload failed while /.test(error.message || '')) throw error;
        throw new Error('Upload failed while ' + statusLabel + ': ' + messageOf(error));
      }
      progress(100);
    } else {
      var uploadId = randomUploadId();
      for (var start = 0; start < file.size; start += CHUNK_SIZE) {
        var end = Math.min(start + CHUNK_SIZE, file.size);
        var chunk = file.slice(start, end);
        var response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            body: uploadBody(chunk, config, folder),
            headers: {
              'X-Unique-Upload-Id': uploadId,
              'Content-Range': 'bytes ' + start + '-' + (end - 1) + '/' + file.size,
            },
          });
          payload = await readUploadResponse(response, statusLabel);
        } catch (error) {
          if (error && /^Upload failed while /.test(error.message || '')) throw error;
          throw new Error('Upload failed while ' + statusLabel + ': ' + messageOf(error));
        }
        progress(Math.round((end / file.size) * 100));
      }
    }
    if (!payload.secure_url) throw new Error('Upload failed while ' + statusLabel + ': Cloudinary did not return a secure URL.');
    return payload;
  }

  function optimizeDeliveryUrl(url, assetType) {
    if (!url || typeof url !== 'string' || url.indexOf('/upload/') === -1) return url;
    if (assetType === 'raw') return url;
    var transformation = assetType === 'video' ? 'w_1920,q_auto/f_auto:video' : 'c_limit,w_1600,q_auto/f_auto';
    return url.replace('/upload/', '/upload/' + transformation + '/');
  }

  function resourceTypeFor(file, payload) {
    if (payload && payload.resource_type) return payload.resource_type;
    var type = file && typeof file.type === 'string' ? file.type.toLowerCase() : '';
    if (type.indexOf('image/') === 0) return 'image';
    if (type.indexOf('video/') === 0 || type.indexOf('audio/') === 0) return 'video';
    if (MEDIA_EXTENSIONS.has(fileExtension(file))) return 'video';
    return 'raw';
  }

  async function publishVideo(client, input, onStatus, configOverride) {
    var validated = validate(input);
    var config = Object.assign({}, (root && root.CLOUDINARY_CONFIG) || {}, configOverride || {});
    if (!configured(config)) throw new Error('Cloudinary is not configured. Add cloudName and unsignedUploadPreset.');
    if (!client || !client.auth || typeof client.auth.getUser !== 'function') throw new Error('A Supabase client with authentication is required.');

    report(onStatus, 'authenticating');
    var initialUser = await currentUser(client, 'checking your account');
    var userId = initialUser.id;
    report(onStatus, 'ensuring profile');
    var profileResult = await client.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
    if (profileResult && profileResult.error) throw new Error('Upload failed while creating your profile: ' + messageOf(profileResult.error));

    var folder = (config.folder || 'tubeclone').replace(/\/+$/, '') + '/' + userId;
    report(onStatus, 'uploading video');
    var videoAsset = await uploadAsset(validated.videoFile, 'auto', config, folder, 'uploading the file to Cloudinary', function (progress) {
      report(onStatus, 'uploading video', progress);
    });
    var thumbnailAsset = null;
    if (validated.thumbnailFile) {
      report(onStatus, 'uploading thumbnail');
      thumbnailAsset = await uploadAsset(validated.thumbnailFile, 'image', config, folder, 'uploading the thumbnail to Cloudinary', function (progress) {
        report(onStatus, 'uploading thumbnail', progress);
      });
    }

    report(onStatus, 'checking account');
    var finalUser = await currentUser(client, 'confirming your account');
    if (finalUser.id !== userId) throw new Error('Upload failed: The signed-in account changed during upload. Please try again.');

    report(onStatus, 'publishing');
    var insertResult = await videoRecords.insertVideo(client, {
      owner_id: userId,
      title: validated.title,
      description: validated.description,
      category: validated.category,
      duration_seconds: validated.durationSeconds,
      visibility: 'public',
      media_type: validated.videoFile.type || 'application/octet-stream',
      video_url: optimizeDeliveryUrl(videoAsset.secure_url, resourceTypeFor(validated.videoFile, videoAsset)),
      thumbnail_url: thumbnailAsset ? optimizeDeliveryUrl(thumbnailAsset.secure_url, 'image') : null,
    });
    if (insertResult && insertResult.error) {
      throw new Error('Upload failed while saving the video record: ' + messageOf(insertResult.error) + ' Cloudinary assets were uploaded; delete them from Media Library if needed.');
    }
    if (!insertResult || !insertResult.data) throw new Error('Upload failed while saving the video record: the database did not return the published video.');
    report(onStatus, 'published');
    return insertResult.data;
  }

  return {
    CATEGORIES: CATEGORIES.slice(),
    MAX_VIDEO_BYTES: MAX_VIDEO_BYTES,
    MAX_THUMBNAIL_BYTES: MAX_THUMBNAIL_BYTES,
    CHUNK_SIZE: CHUNK_SIZE,
    CHUNK_THRESHOLD: CHUNK_THRESHOLD,
    isConfigured: configured,
    validateUpload: validate,
    optimizeDeliveryUrl: optimizeDeliveryUrl,
    publishVideo: publishVideo,
  };
}));
