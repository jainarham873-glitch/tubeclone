(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const cloudinary = Boolean(window.CloudinaryUpload?.isConfigured(window.CLOUDINARY_CONFIG || {}));
  const publisher = cloudinary ? window.CloudinaryUpload : window.TubeUpload;
  const providerName = cloudinary ? 'Cloudinary' : 'Supabase Storage';
  const state = { client: null, user: null, file: null, thumbnail: null, fileUrl: '', thumbnailUrl: '', review: false, busy: false, dirty: false, authMode: 'signin', authReady: false };
  const fields = $('#upload-fields');
  const form = $('#upload-form');

  function formatSize(bytes) {
    if (bytes >= 1024 ** 3) return `${Number((bytes / 1024 ** 3).toFixed(2))} GiB`;
    if (bytes >= 1024 ** 2) return `${Number((bytes / 1024 ** 2).toFixed(2))} MiB`;
    if (bytes >= 1024) return `${Number((bytes / 1024).toFixed(1))} KiB`;
    return `${bytes} bytes`;
  }

  function feedback(message) {
    const element = $('#upload-feedback');
    element.textContent = message || '';
    element.hidden = !message;
    if (message) element.focus();
  }

  function storageValue(key) {
    try { return localStorage.getItem(key); } catch (_error) { return null; }
  }

  function setStep() {
    const current = state.review ? 2 : state.file ? 1 : 0;
    ['#step-file', '#step-details', '#step-review'].forEach((selector, index) => {
      const element = $(selector);
      element.classList.toggle('is-done', index < current);
      if (current === index) element.setAttribute('aria-current', 'step');
      else element.removeAttribute('aria-current');
    });
  }

  function setBusy(busy) {
    state.busy = busy;
    fields.disabled = busy || !publisher;
    form.setAttribute('aria-busy', String(busy));
    $('#upload-publish').textContent = busy ? 'Publishing…' : state.user ? 'Publish' : 'Sign in to publish';
    $('#upload-footer-note').textContent = busy ? 'Keep this page open until publishing finishes.' : 'Your file stays local until you publish.';
  }

  function renderAccount() {
    const name = state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'Your channel';
    $('#upload-account-label').textContent = state.user ? `Publishing as ${name}` : 'Sign in when you’re ready to publish';
    $('#upload-account-hint').textContent = state.user ? `Supabase Auth • ${state.user.email || 'Signed in'}` : 'Supabase handles login. You can prepare your files before signing in.';
    $('#upload-preview-channel').textContent = name;
    $('#upload-avatar').textContent = state.user ? name.slice(0, 1).toUpperCase() : 'A';
    $('#upload-signin-toggle').hidden = Boolean(state.user) || !state.client;
    if (state.user) toggleAuth(false);
    if (!state.busy) $('#upload-publish').textContent = state.user ? 'Publish' : 'Sign in to publish';
  }

  function toggleAuth(open) {
    $('#upload-auth').hidden = !open;
    $('#upload-signin-toggle').setAttribute('aria-expanded', String(open));
    if (open) $('#upload-email').focus();
  }

  async function initAuth() {
    try {
      const config = window.SUPABASE_CONFIG || {};
      const rawUrl = storageValue('tubeclone.supabase.url') || config.url;
      const key = storageValue('tubeclone.supabase.anonKey') || config.anonKey;
      if (!rawUrl || !key || !window.supabase?.createClient) throw new Error('Account connection unavailable. Check supabase-config.js and your internet connection, then reload. Your files have not been uploaded.');
      const url = new URL(rawUrl.trim());
      url.hash = '';
      url.search = '';
      url.pathname = url.pathname.replace(/\/(?:rest\/v1|auth\/v1)\/?$/i, '');
      state.client = window.supabase.createClient(url.toString().replace(/\/$/, ''), key);
      let sessionChanged = false;
      state.client.auth.onAuthStateChange((_event, session) => {
        sessionChanged = true;
        state.user = session?.user || null;
        renderAccount();
      });
      const result = await state.client.auth.getSession();
      if (result.error) throw result.error;
      if (!sessionChanged) state.user = result.data.session?.user || null;
      renderAccount();
    } catch (error) {
      renderAccount();
      $('#upload-account-label').textContent = 'Account connection needs attention';
      $('#upload-account-hint').textContent = error.message || 'Unable to check your account. Reload to try again.';
    } finally {
      state.authReady = true;
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (!state.client || $('#upload-auth-submit').disabled) return;
    const button = $('#upload-auth-submit');
    button.disabled = true;
    $('#upload-auth-mode').disabled = true;
    $('#upload-auth-form').setAttribute('aria-busy', 'true');
    ['#upload-email', '#upload-password', '#upload-confirm-password'].forEach((selector) => { $(selector).disabled = true; });
    $('#upload-auth-message').textContent = 'Checking your account…';
    try {
      const credentials = { email: $('#upload-email').value.trim(), password: $('#upload-password').value };
      const data = state.authMode === 'signin'
        ? await window.TubeAuth.signIn(state.client, credentials.email, credentials.password)
        : await window.TubeAuth.signUp(state.client, credentials.email, credentials.password, $('#upload-confirm-password').value, window.location.href);
      state.user = data.session?.user || null;
      $('#upload-password').value = '';
      $('#upload-confirm-password').value = '';
      $('#upload-auth-message').textContent = state.user ? 'Signed in. Your upload is ready to review.' : 'Check your email to confirm your account, then sign in here.';
      renderAccount();
    } catch (error) {
      $('#upload-auth-message').textContent = window.TubeAuth.errorMessage(error);
    } finally {
      button.disabled = false;
      $('#upload-auth-mode').disabled = false;
      $('#upload-auth-form').setAttribute('aria-busy', 'false');
      $('#upload-email').disabled = false;
      $('#upload-password').disabled = false;
      $('#upload-confirm-password').disabled = state.authMode !== 'signup';
    }
  }

  function inputValues(file = state.file, thumbnail = state.thumbnail) {
    return { title: $('#upload-title').value, description: $('#upload-description').value, category: $('#upload-category').value, videoFile: file, thumbnailFile: thumbnail, durationSeconds: 0 };
  }

  function checkFiles(file, thumbnail) {
    if (!publisher) throw new Error('Upload services could not load. Reload the page to try again.');
    // Reuse the provider's validation; selecting a file should not require a title yet.
    publisher.validateUpload({ ...inputValues(file, thumbnail), title: 'File check', description: '', category: publisher.CATEGORIES[0] });
  }

  function releaseUrl(key) {
    if (state[key]) URL.revokeObjectURL(state[key]);
    state[key] = '';
  }

  function stopPreview() {
    $('#upload-preview').querySelectorAll('video, audio').forEach((media) => {
      media.pause();
      media.removeAttribute('src');
      media.load();
    });
    $('#upload-preview').replaceChildren();
  }

  function renderPreview() {
    stopPreview();
    const file = state.file;
    const type = file?.type || '';
    const note = $('#upload-preview-note');
    let element;
    if (file && /^(video|audio)\//.test(type)) {
      element = document.createElement(type.startsWith('audio/') ? 'audio' : 'video');
      element.controls = true;
      element.preload = 'metadata';
      element.playsInline = true;
      element.src = state.fileUrl;
      if (state.thumbnailUrl && type.startsWith('video/')) element.poster = state.thumbnailUrl;
      element.setAttribute('aria-label', 'Selected media preview');
      element.addEventListener('error', () => { note.textContent = 'This browser cannot preview this format. You can still upload it; provider restrictions apply.'; });
      note.textContent = 'Local preview only. This file has not been uploaded.';
    } else if (state.thumbnailUrl || (file && type.startsWith('image/'))) {
      element = document.createElement('img');
      element.src = state.thumbnailUrl || state.fileUrl;
      element.alt = state.thumbnail ? 'Selected thumbnail preview' : 'Selected image preview';
      element.addEventListener('error', () => { note.textContent = 'Image preview unavailable. Try another image if needed.'; });
      note.textContent = state.thumbnail ? 'Your selected thumbnail. Nothing is uploaded yet.' : 'Your selected image. Nothing is uploaded yet.';
    } else {
      element = document.createElement('span');
      element.textContent = file ? '▤  File ready to upload' : 'No file selected yet';
      note.textContent = file ? 'No inline preview for this file. Viewers will get an open/download link.' : 'Select a file to preview it here.';
    }
    $('#upload-preview').append(element);
    $('#upload-preview-size').textContent = file ? formatSize(file.size) : '—';
  }

  function updateDetails() {
    $('#upload-title-count').textContent = `${$('#upload-title').value.length} / 100`;
    $('#upload-description-count').textContent = `${$('#upload-description').value.length} / 5000`;
    $('#upload-preview-title').textContent = $('#upload-title').value.trim() || 'Your next great upload';
    $('#upload-preview-category').textContent = $('#upload-category').value;
  }

  function selectFile(files) {
    if (state.busy || !files?.length) return;
    if (files.length !== 1) return feedback('Choose one file at a time. Your existing selection has not changed.');
    const file = files[0];
    try { checkFiles(file, state.thumbnail); } catch (error) { feedback(error.message); return; }
    stopPreview();
    releaseUrl('fileUrl');
    state.file = file;
    state.fileUrl = URL.createObjectURL(file);
    state.dirty = true;
    if (!$('#upload-title').value.trim()) $('#upload-title').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').slice(0, 100);
    $('#upload-file-name').textContent = file.name;
    $('#upload-file-meta').textContent = `${formatSize(file.size)} • ${file.type || 'File'} • Not uploaded yet`;
    $('#upload-dropzone').hidden = true;
    $('#upload-selected').hidden = false;
    feedback('');
    setStep();
    renderPreview();
    updateDetails();
  }

  function removeFile() {
    if (state.busy) return;
    stopPreview();
    releaseUrl('fileUrl');
    state.file = null;
    $('#upload-file').value = '';
    $('#upload-selected').hidden = true;
    $('#upload-dropzone').hidden = false;
    setStep();
    renderPreview();
    $('#upload-choose').focus();
  }

  function selectThumbnail(file) {
    if (state.busy || !file) return;
    try {
      // Validate image restrictions even if the main file has not been chosen yet.
      checkFiles(state.file || { name: 'validation.mp4', type: 'video/mp4', size: 1 }, file);
    } catch (error) { feedback(error.message); return; }
    releaseUrl('thumbnailUrl');
    state.thumbnail = file;
    state.thumbnailUrl = URL.createObjectURL(file);
    state.dirty = true;
    const image = document.createElement('img');
    image.src = state.thumbnailUrl;
    image.alt = 'Change thumbnail';
    $('#upload-choose-thumbnail').replaceChildren(image);
    $('#upload-remove-thumbnail').hidden = false;
    feedback('');
    renderPreview();
  }

  function removeThumbnail() {
    if (state.busy) return;
    releaseUrl('thumbnailUrl');
    state.thumbnail = null;
    $('#upload-thumbnail').value = '';
    $('#upload-choose-thumbnail').textContent = '＋ Upload thumbnail';
    $('#upload-remove-thumbnail').hidden = true;
    renderPreview();
  }

  function showReview(review) {
    state.review = review;
    $('#upload-details').hidden = review;
    $('#upload-review').hidden = !review;
    $('#upload-next').hidden = review;
    $('#upload-publish').hidden = !review;
    $('#upload-back').hidden = !review;
    setStep();
    if (review) {
      $('#upload-review-name').textContent = $('#upload-title').value.trim();
      $('#upload-review-description').textContent = $('#upload-description').value.trim() || 'No description added.';
      $('#upload-review-file').textContent = `${state.file.name} • ${formatSize(state.file.size)}`;
      $('#upload-review-category').textContent = $('#upload-category').value;
      $('#upload-review-provider').textContent = `${providerName} + your public channel`;
    }
    $(review ? '#upload-review-title' : '#upload-details-title').focus();
  }

  function reportProgress(stage, percent) {
    const labels = {
      authenticating: 'Checking your account…',
      'ensuring profile': 'Preparing your channel…',
      'uploading video': 'Uploading your file…',
      'uploading thumbnail': 'Uploading your thumbnail…',
      'checking account': 'Confirming your account…',
      publishing: 'Publishing to your channel…',
      published: 'Upload saved. Finishing up…',
    };
    $('#upload-status').textContent = labels[stage] || 'Preparing your upload…';
    // These are provider-reported file percentages, not a fabricated total/ETA.
    const progress = $('#upload-progress');
    const numeric = Number.isFinite(percent) && percent > 0;
    if (numeric) progress.value = Math.min(100, Math.max(0, percent));
    else progress.removeAttribute('value');
    $('#upload-percent').textContent = numeric ? `${Math.round(progress.value)}% of ${stage === 'uploading thumbnail' ? 'thumbnail' : 'file'}` : '';
  }

  function readDuration(file) {
    if (!/^(video|audio)\//.test(file.type || '')) return Promise.resolve(0);
    return new Promise((resolve) => {
      const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
      if (!media.canPlayType(file.type)) { resolve(0); return; }
      const url = URL.createObjectURL(file);
      let settled = false;
      const finish = (duration) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        media.onloadedmetadata = null;
        media.onerror = null;
        media.removeAttribute('src');
        media.load();
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(duration) && duration >= 0 ? duration : 0);
      };
      const timer = setTimeout(() => finish(0), 3000);
      media.onloadedmetadata = () => finish(media.duration);
      media.onerror = () => finish(0);
      media.preload = 'metadata';
      media.src = url;
    });
  }

  async function submitUpload(event) {
    event.preventDefault();
    if (state.busy) return;
    feedback('');
    if (!publisher) return feedback('Upload services could not load. Reload the page.');
    if (!state.file) return feedback('Select a file before reviewing your upload.');
    try { publisher.validateUpload(inputValues()); } catch (error) { feedback(error.message); return; }
    if (!state.review) { showReview(true); return; }
    if (!state.authReady) return feedback('Your account is still being checked. Please try again in a moment.');
    if (!state.client) return feedback('Account connection unavailable. Check the account message above before publishing.');
    if (!state.user) { toggleAuth(true); return; }
    if (!$('#upload-public-confirm').checked) return feedback('Confirm that you have permission to share this file publicly.');

    // Snapshot before awaiting; disable edits and duplicate submissions until finished.
    const input = inputValues();
    setBusy(true);
    const panel = $('#upload-progress-panel');
    panel.hidden = false;
    panel.classList.remove('is-error');
    $('#upload-spinner').hidden = false;
    $('#upload-progress').hidden = false;
    $('#upload-progress-note').textContent = 'Keep this page open. File progress is reported when available; publishing follows the transfer.';
    reportProgress('preparing');
    panel.scrollIntoView({ block: 'nearest' });
    try {
      input.durationSeconds = await readDuration(input.videoFile);
      const row = await publisher.publishVideo(state.client, input, reportProgress, cloudinary ? window.CLOUDINARY_CONFIG : undefined);
      if (!row?.id) throw new Error('The service did not return a published record. Check Creator Studio before trying again.');
      state.dirty = false;
      stopPreview();
      releaseUrl('fileUrl');
      releaseUrl('thumbnailUrl');
      form.hidden = true;
      panel.hidden = true;
      $('#upload-success').hidden = false;
      $('#upload-success-name').textContent = row.title || input.title.trim();
      $('#upload-view').href = `index.html#watch=${encodeURIComponent(row.id)}`;
      document.querySelectorAll('.upload-steps li').forEach((step) => { step.classList.add('is-done'); step.removeAttribute('aria-current'); });
      $('#upload-success-title').focus();
    } catch (error) {
      panel.classList.add('is-error');
      $('#upload-status').textContent = 'Upload not completed';
      $('#upload-spinner').hidden = true;
      $('#upload-progress').hidden = true;
      $('#upload-percent').textContent = '';
      $('#upload-progress-note').textContent = 'Your selection and details are still here. If a transfer completed before the error, check Studio and your media provider before retrying to avoid duplicates.';
      feedback(error.message || 'Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  $('#upload-choose').addEventListener('click', () => $('#upload-file').click());
  $('#upload-replace').addEventListener('click', () => $('#upload-file').click());
  $('#upload-file').addEventListener('change', (event) => { selectFile(event.target.files); event.target.value = ''; });
  $('#upload-remove').addEventListener('click', removeFile);
  $('#upload-choose-thumbnail').addEventListener('click', () => $('#upload-thumbnail').click());
  $('#upload-thumbnail').addEventListener('change', (event) => { selectThumbnail(event.target.files?.[0]); event.target.value = ''; });
  $('#upload-remove-thumbnail').addEventListener('click', removeThumbnail);
  form.addEventListener('input', () => { if (!state.busy) { state.dirty = true; updateDetails(); } });
  form.addEventListener('submit', submitUpload);
  $('#upload-back').addEventListener('click', () => { if (!state.busy) { feedback(''); showReview(false); } });
  $('#upload-another').addEventListener('click', () => {
    state.file = null;
    state.thumbnail = null;
    form.reset();
    $('#upload-category').value = 'Other';
    $('#upload-success').hidden = true;
    $('#upload-progress-panel').hidden = true;
    form.hidden = false;
    removeThumbnail();
    removeFile();
    updateDetails();
    showReview(false);
    state.dirty = false;
  });
  $('#upload-signin-toggle').addEventListener('click', () => toggleAuth($('#upload-auth').hidden));
  $('#upload-auth-form').addEventListener('submit', signIn);
  $('#upload-auth-mode').addEventListener('click', () => {
    state.authMode = state.authMode === 'signin' ? 'signup' : 'signin';
    $('#upload-auth-title').textContent = state.authMode === 'signin' ? 'Sign in to publish' : 'Create your account';
    $('#upload-auth-submit').textContent = state.authMode === 'signin' ? 'Sign in' : 'Create account';
    $('#upload-auth-mode').textContent = state.authMode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in';
    $('#upload-password').autocomplete = state.authMode === 'signin' ? 'current-password' : 'new-password';
    $('#upload-password').minLength = state.authMode === 'signup' ? window.TubeAuth.MIN_PASSWORD_LENGTH : 1;
    $('#upload-password').placeholder = state.authMode === 'signup' ? 'At least 8 characters' : '';
    $('#upload-password').value = '';
    $('#upload-confirm-password').value = '';
    $('#upload-confirm-label').hidden = state.authMode !== 'signup';
    $('#upload-confirm-password').disabled = state.authMode !== 'signup';
    $('#upload-confirm-password').required = state.authMode === 'signup';
    $('#upload-auth-message').textContent = '';
  });

  ['#upload-dropzone', '#upload-selected'].forEach((selector) => {
    const zone = $(selector);
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!state.busy) { zone.classList.add('is-dragging'); event.dataTransfer.dropEffect = 'copy'; }
    });
    zone.addEventListener('dragleave', (event) => { if (!zone.contains(event.relatedTarget)) zone.classList.remove('is-dragging'); });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('is-dragging');
      selectFile(event.dataTransfer.files);
    });
  });
  // Do not let a misplaced file drop navigate away from the form.
  ['dragover', 'drop'].forEach((name) => document.addEventListener(name, (event) => {
    if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
  }));
  window.addEventListener('beforeunload', (event) => {
    if (state.busy || state.dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) { stopPreview(); releaseUrl('fileUrl'); releaseUrl('thumbnailUrl'); }
  });

  if (publisher) {
    publisher.CATEGORIES.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      $('#upload-category').append(option);
    });
    $('#upload-category').value = 'Other';
    $('#upload-provider').textContent = `${providerName} media storage`;
    $('#upload-file-limits').textContent = cloudinary
      ? `Any file type • App limit ${formatSize(publisher.MAX_VIDEO_BYTES)} • Provider restrictions apply`
      : `MP4 or WebM • Up to ${formatSize(publisher.MAX_VIDEO_BYTES)}`;
    $('#upload-thumbnail-limits').textContent = `${cloudinary ? 'Image files' : 'JPG, PNG, or WebP'} up to ${formatSize(publisher.MAX_THUMBNAIL_BYTES)}. A 16:9 image works best.`;
    $('#upload-storage-note').textContent = cloudinary
      ? 'Cloudinary handles file storage. Supabase saves your post. Your account plan and upload preset may have lower limits. Uploaded files are public.'
      : 'Using the existing Supabase Storage fallback. Configure Cloudinary to enable larger files and more formats. Uploaded files are public.';
    if (!cloudinary) {
      $('#upload-file').accept = 'video/mp4,video/webm,.mp4,.webm';
      $('#upload-thumbnail').accept = 'image/jpeg,image/png,image/webp';
    }
  } else {
    $('#upload-provider').textContent = 'Upload service unavailable';
    feedback('The upload service could not load. Reload this page to try again.');
  }
  setBusy(false);
  updateDetails();
  initAuth();
}());
