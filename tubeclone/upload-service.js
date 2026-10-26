(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root, require('./video-records.js'));
  } else {
    root.TubeUpload = factory(root, root.TubeVideoRecords);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root, videoRecords) {
  'use strict';

  var CATEGORIES = ['Music', 'Mixes', 'Movies & TV', 'Gaming', 'News', 'Sports', 'Learning', 'Podcasts', 'Travel', 'Design', 'Fashion & Beauty', 'Live', 'Other'];
  var MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  var MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
  var CONTEXTUAL_ERROR = '__tubeUploadContextualError';

  var VIDEO_TYPES = {
    'video/mp4': { extension: 'mp4', contentType: 'video/mp4' },
    'video/webm': { extension: 'webm', contentType: 'video/webm' },
  };
  var THUMBNAIL_TYPES = {
    'image/jpeg': { extension: 'jpg', contentType: 'image/jpeg' },
    'image/png': { extension: 'png', contentType: 'image/png' },
    'image/webp': { extension: 'webp', contentType: 'image/webp' },
  };

  function errorMessage(error) {
    if (error && typeof error === 'object') {
      var message = typeof error.message === 'string' ? error.message.trim() : '';
      var details = typeof error.details === 'string' ? error.details.trim() : '';
      var hint = typeof error.hint === 'string' ? error.hint.trim() : '';
      var code = typeof error.code === 'string' ? error.code.trim() : '';
      var parts = [message, details, hint].filter(Boolean);
      if (code && parts.length) parts.push('code ' + code);
      if (parts.length) return parts.join(' — ');
    }
    if (error && typeof error.message === 'string' && error.message) return error.message;
    if (typeof error === 'string' && error) return error;
    return 'Unknown error';
  }

  function contextualError(context, error) {
    if (error && error[CONTEXTUAL_ERROR]) return error;
    var wrapped = new Error('Upload failed ' + context + ': ' + errorMessage(error));
    wrapped[CONTEXTUAL_ERROR] = true;
    wrapped.cause = error;
    return wrapped;
  }

  function fileType(file, allowedTypes, allowedExtensions) {
    var type = file && typeof file.type === 'string'
      ? file.type.split(';')[0].trim().toLowerCase()
      : '';
    if (type) return allowedTypes[type] || null;

    var name = file && typeof file.name === 'string' ? file.name.toLowerCase() : '';
    var match = /\.([a-z0-9]+)$/.exec(name);
    return match ? (allowedExtensions[match[1]] || null) : null;
  }

  function assertFile(file, label, maxBytes, allowedTypes, allowedExtensions) {
    if (!file) throw new Error(label + ' is required.');

    var size = typeof file.size === 'number' ? file.size : NaN;
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(label + ' cannot be empty.');
    }
    if (size > maxBytes) {
      throw new Error(label + ' must be ' + (maxBytes / (1024 * 1024)) + ' MiB or smaller.');
    }
    if (!fileType(file, allowedTypes, allowedExtensions)) {
      throw new Error(label + ' must be an allowed file type.');
    }
  }

  function validateUpload(input) {
    var values = input || {};
    var title = typeof values.title === 'string' ? values.title.trim() : '';
    if (!title) throw new Error('Title is required.');
    if (title.length > 100) throw new Error('Title must be 100 characters or fewer.');

    var description = values.description == null ? '' : values.description;
    if (typeof description !== 'string') throw new Error('Description must be text.');
    if (description.length > 5000) throw new Error('Description must be 5000 characters or fewer.');

    if (CATEGORIES.indexOf(values.category) === -1) {
      throw new Error('Choose a valid video category.');
    }

    assertFile(values.videoFile, 'Video file', MAX_VIDEO_BYTES, VIDEO_TYPES, {
      mp4: VIDEO_TYPES['video/mp4'],
      webm: VIDEO_TYPES['video/webm'],
    });

    if (values.thumbnailFile != null) {
      assertFile(values.thumbnailFile, 'Thumbnail file', MAX_THUMBNAIL_BYTES, THUMBNAIL_TYPES, {
        jpg: THUMBNAIL_TYPES['image/jpeg'],
        jpeg: THUMBNAIL_TYPES['image/jpeg'],
        png: THUMBNAIL_TYPES['image/png'],
        webp: THUMBNAIL_TYPES['image/webp'],
      });
    }

    var durationSeconds = values.durationSeconds == null ? 0 : values.durationSeconds;
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw new Error('Duration must be a nonnegative finite number.');
    }

    return {
      title: title,
      description: description,
      category: values.category,
      videoFile: values.videoFile,
      thumbnailFile: values.thumbnailFile == null ? null : values.thumbnailFile,
      durationSeconds: durationSeconds,
    };
  }

  function reportStatus(onStatus, status) {
    if (typeof onStatus !== 'function') return;
    try {
      onStatus(status);
    } catch (_error) {
      // Status reporting must not turn a successful upload into a failed one.
    }
  }

  function uuid() {
    var cryptoObject = root && root.crypto;
    if (!cryptoObject && typeof globalThis !== 'undefined') cryptoObject = globalThis.crypto;
    if (!cryptoObject || typeof cryptoObject.randomUUID !== 'function') {
      throw new Error('Secure file naming is unavailable in this browser.');
    }
    return cryptoObject.randomUUID();
  }

  function authUser(result) {
    var user = result && result.data && result.data.user;
    return user && typeof user.id === 'string' && user.id ? user : null;
  }

  async function getVerifiedUser(client, context) {
    var result;
    try {
      result = await client.auth.getUser();
    } catch (error) {
      throw contextualError(context, error);
    }
    if (result && result.error) throw contextualError(context, result.error);
    var user = authUser(result);
    if (!user) throw new Error('Upload failed: Sign in before uploading.');
    return user;
  }

  async function uploadObject(client, bucketName, path, file, mediaType, writes, stage) {
    var storage;
    try {
      storage = client.storage.from(bucketName);
      var result = await storage.upload(path, file, {
        contentType: mediaType.contentType,
        upsert: false,
      });
      if (result && result.error) throw result.error;
    } catch (error) {
      throw contextualError(stage, error);
    }
    writes.push({ bucketName: bucketName, path: path, storage: storage });
    return storage;
  }

  async function publicUrl(storage, path, context) {
    var result;
    try {
      result = await storage.getPublicUrl(path);
    } catch (error) {
      throw contextualError(context, error);
    }
    if (result && result.error) throw contextualError(context, result.error);
    var url = result && result.data && result.data.publicUrl;
    if (!url) throw contextualError(context, new Error('Storage did not return a public URL.'));
    return url;
  }

  async function cleanupWrites(writes) {
    var failures = [];
    for (var index = writes.length - 1; index >= 0; index -= 1) {
      var write = writes[index];
      try {
        var result = await write.storage.remove([write.path]);
        if (result && result.error) {
          failures.push(write.bucketName + ' storage: ' + errorMessage(result.error));
        }
      } catch (error) {
        failures.push(write.bucketName + ' storage: ' + errorMessage(error));
      }
    }
    return failures;
  }

  async function publishVideo(client, input, onStatus) {
    var validated = validateUpload(input);
    var statusCallback = typeof onStatus === 'function' ? onStatus : function () {};
    var writes = [];
    var published = false;
    var stage = 'starting';

    try {
      if (!client || !client.auth || typeof client.auth.getUser !== 'function') {
        throw new Error('A Supabase client with authentication is required.');
      }
      reportStatus(statusCallback, 'authenticating');
      stage = 'verifying your account';
      var initialUser = await getVerifiedUser(client, stage);
      var userId = initialUser.id;

      reportStatus(statusCallback, 'ensuring profile');
      stage = 'creating your profile';
      var profileResult = await client.from('profiles').upsert(
        { id: userId },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (profileResult && profileResult.error) throw contextualError(stage, profileResult.error);

      var videoMediaType = fileType(validated.videoFile, VIDEO_TYPES, {
        mp4: VIDEO_TYPES['video/mp4'],
        webm: VIDEO_TYPES['video/webm'],
      });
      var videoPath = userId + '/' + uuid() + '.' + videoMediaType.extension;
      reportStatus(statusCallback, 'uploading video');
      stage = 'uploading the video';
      var videoStorage = await uploadObject(client, 'videos', videoPath, validated.videoFile, videoMediaType, writes, stage);
      var videoUrl = await publicUrl(videoStorage, videoPath, 'creating the video URL');

      var thumbnailUrl = null;
      if (validated.thumbnailFile) {
        var thumbnailMediaType = fileType(validated.thumbnailFile, THUMBNAIL_TYPES, {
          jpg: THUMBNAIL_TYPES['image/jpeg'],
          jpeg: THUMBNAIL_TYPES['image/jpeg'],
          png: THUMBNAIL_TYPES['image/png'],
          webp: THUMBNAIL_TYPES['image/webp'],
        });
        var thumbnailPath = userId + '/' + uuid() + '.' + thumbnailMediaType.extension;
        reportStatus(statusCallback, 'uploading thumbnail');
        stage = 'uploading the thumbnail';
        var thumbnailStorage = await uploadObject(client, 'thumbnails', thumbnailPath, validated.thumbnailFile, thumbnailMediaType, writes, stage);
        thumbnailUrl = await publicUrl(thumbnailStorage, thumbnailPath, 'creating the thumbnail URL');
      }

      reportStatus(statusCallback, 'checking account');
      stage = 'checking your account before publishing';
      var currentUser = await getVerifiedUser(client, stage);
      if (currentUser.id !== userId) {
        throw new Error('Upload failed: The signed-in account changed during upload. Please try again.');
      }

      reportStatus(statusCallback, 'publishing');
      stage = 'saving the video record';
      var insertResult = await videoRecords.insertVideo(client, {
        owner_id: userId,
        title: validated.title,
        description: validated.description,
        category: validated.category,
        // HTMLMediaElement.duration is often fractional, while the SQL schema
        // stores whole seconds. Normalize before PostgREST receives the row.
        duration_seconds: Math.round(validated.durationSeconds),
        visibility: 'public',
        media_type: videoMediaType.contentType,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
      });
      if (insertResult && insertResult.error) throw contextualError(stage, insertResult.error);
      if (!insertResult || !insertResult.data) {
        throw contextualError(stage, new Error('The database did not return the published video.'));
      }

      published = true;
      reportStatus(statusCallback, 'published');
      return insertResult.data;
    } catch (error) {
      var failure = error && error[CONTEXTUAL_ERROR]
        ? error
        : contextualError('while ' + stage, error);
      if (!published && writes.length) {
        var cleanupFailures = await cleanupWrites(writes);
        if (cleanupFailures.length) {
          var cleanupError = new Error(failure.message + ' (cleanup failed: ' + cleanupFailures.join('; ') + ')');
          cleanupError.cause = failure;
          cleanupError.cleanupFailures = cleanupFailures;
          throw cleanupError;
        }
      }
      throw failure;
    }
  }

  return {
    CATEGORIES: CATEGORIES.slice(),
    MAX_VIDEO_BYTES: MAX_VIDEO_BYTES,
    MAX_THUMBNAIL_BYTES: MAX_THUMBNAIL_BYTES,
    validateUpload: validateUpload,
    publishVideo: publishVideo,
  };
}));
