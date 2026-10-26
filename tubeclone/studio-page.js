(function () {
  'use strict';

  const editorEmails = new Set(['arhamjaindhiraj@gmail.com', 'jainarham873@gmail.com']);
  const config = window.SUPABASE_CONFIG || {};
  const rawUrl = localStorage.getItem('tubeclone.supabase.url') || config.url || '';
  const url = rawUrl.replace(/\/(?:rest\/v1|auth\/v1)\/?$/, '').replace(/\/$/, '');
  const anonKey = localStorage.getItem('tubeclone.supabase.anonKey') || config.anonKey || '';
  const client = url && anonKey && window.supabase?.createClient ? window.supabase.createClient(url, anonKey) : null;
  const state = { user: null, videos: [], comments: [], editing: null, hasPinnedColumn: true, hasDeletedColumns: true };
  const root = document.createElement('div');
  root.className = 'studio-shell';
  document.body.replaceChildren(root);

  function escape(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
  function age(value) { const time = new Date(value).getTime(); if (!Number.isFinite(time)) return 'recently'; const days = Math.max(0, Math.floor((Date.now() - time) / 86400000)); return days ? `${days}d ago` : 'today'; }
  function isApprovedEditor() { return editorEmails.has(state.user?.email?.toLowerCase()); }
  function canManage(video) { return Boolean(state.user && (video.owner_id === state.user.id || isApprovedEditor())); }
  function toast(message) { const element = document.querySelector('#studio-toast'); element.textContent = message; element.classList.add('toast--visible'); setTimeout(() => element.classList.remove('toast--visible'), 2600); }

  root.innerHTML = `<header class="topbar"><div class="topbar__left"><a class="brand" href="index.html"><span class="brand__mark"><span></span></span><span class="brand__name">YouTube</span></a></div><div class="studio-topbar-label">Creator Studio</div><div class="topbar__right"><a class="icon-button" href="index.html" aria-label="Back to YouTube">⌂</a><a class="avatar avatar--small" href="account.html" aria-label="Account">A</a></div></header><aside class="sidebar"><nav class="sidebar__nav"><a class="nav-item" href="index.html"><span class="nav-item__icon">⌂</span><span>Home</span></a><a class="nav-item nav-item--active" href="studio.html"><span class="nav-item__icon">✦</span><span>Creator Studio</span></a></nav><div class="sidebar__divider"></div><div class="sidebar__section"><p class="sidebar__label">Manage</p><a class="nav-item" href="studio.html#content"><span class="nav-item__icon">▤</span><span>Content</span></a><a class="nav-item" href="studio.html#analytics"><span class="nav-item__icon">⌁</span><span>Analytics</span></a><a class="nav-item" href="studio.html#comments"><span class="nav-item__icon">◌</span><span>Comments</span></a></div></aside><main class="main-content studio-main"><div id="studio-root"></div></main><div class="toast" id="studio-toast" role="status"></div>`;

  async function getUser() {
    if (!client) return null;
    const result = await client.auth.getUser();
    if (result.error) throw result.error;
    return result.data.user || null;
  }

  async function loadVideos() {
    if (!client || !state.user) { state.videos = []; state.comments = []; render(); return; }
    let result = await client.from('videos').select('id, owner_id, title, description, category, thumbnail_url, video_url, views, created_at, pinned, deleted_at, deleted_by, delete_expires_at').order('created_at', { ascending: false });
    if (result.error && /deleted_at|delete_expires_at|column|schema cache/i.test(result.error.message || '')) {
      state.hasDeletedColumns = false;
      result = await client.from('videos').select('id, owner_id, title, description, category, thumbnail_url, video_url, views, created_at, pinned').order('created_at', { ascending: false });
    }
    if (result.error && /pinned|column/i.test(result.error.message || '')) {
      state.hasPinnedColumn = false;
      result = await client.from('videos').select('id, owner_id, title, description, category, thumbnail_url, video_url, views, created_at').order('created_at', { ascending: false });
    }
    if (result.error) throw result.error;
    state.videos = result.data || [];
    const manageableIds = state.videos.filter(canManage).map((video) => video.id);
    state.comments = [];
    if (manageableIds.length) {
      const comments = await client.from('comments').select('id, video_id, user_id, body, pinned, created_at').in('video_id', manageableIds).order('created_at', { ascending: false }).limit(300);
      if (!comments.error) state.comments = comments.data || [];
    }
    render();
  }

  function render() {
    const rootElement = document.querySelector('#studio-root');
    const email = state.user?.email || '';
    const manageable = state.videos.filter(canManage);
    const activeVideos = manageable.filter((video) => !video.deleted_at);
    const totalViews = activeVideos.reduce((sum, video) => sum + (Number(video.views) || 0), 0);
    const topVideos = activeVideos.slice().sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 5);
    const maxViews = Math.max(1, ...topVideos.map((video) => Number(video.views) || 0));
    rootElement.innerHTML = `<div class="studio-header"><div><p class="section-heading__overline">Creator tools</p><h1>Creator Studio</h1><p>Manage content, review performance, and respond to comments.</p></div><a class="primary-button" href="upload.html" data-studio-upload>＋ Upload</a></div><div class="studio-permission-card"><span class="avatar">${escape(email.slice(0, 1).toUpperCase() || 'A')}</span><div><strong>${escape(email || 'Not signed in')}</strong><small>${state.user ? (isApprovedEditor() ? 'Approved admin access — manage visible videos and comments' : 'Creator access enabled for your own videos') : 'Sign in from YouTube to manage content'}</small></div></div><div class="studio-stats"><div class="studio-stat"><span>Active videos</span><strong>${activeVideos.length}</strong></div><div class="studio-stat"><span>Total views</span><strong>${totalViews.toLocaleString()}</strong></div><div class="studio-stat"><span>Comments</span><strong>${state.comments.length}</strong></div><div class="studio-stat"><span>Recovery window</span><strong>1 hour</strong></div></div><section class="studio-section" id="content"><div class="section-heading studio-list-heading"><div><p class="section-heading__overline">Content</p><h2>Manage videos</h2></div></div><div class="studio-content-list">${state.user ? (manageable.length ? manageable.map(videoRow).join('') : '<div class="playlist-detail__empty"><strong>No videos to manage</strong><span>Use Upload to publish your first file.</span></div>') : '<div class="playlist-detail__empty"><strong>Sign in to open Creator Studio</strong><span>Your videos, analytics, and comments will appear here.</span></div>'}</div></section><section class="studio-section" id="analytics"><div class="section-heading studio-list-heading"><div><p class="section-heading__overline">Analytics</p><h2>Real performance</h2></div></div><div class="studio-analytics-list">${topVideos.length ? topVideos.map((video) => `<article class="studio-analytics-row"><div class="studio-analytics-row__copy"><strong>${escape(video.title)}</strong><span>${(Number(video.views) || 0).toLocaleString()} views • ${escape(video.category || 'Video')}</span></div><div class="studio-analytics-row__bar"><i style="width:${Math.max(4, Math.round(((Number(video.views) || 0) / maxViews) * 100))}%"></i></div></article>`).join('') : '<div class="playlist-detail__empty"><strong>No analytics yet</strong><span>Publish a video to start measuring views.</span></div>'}</div></section><section class="studio-section" id="comments"><div class="section-heading studio-list-heading"><div><p class="section-heading__overline">Community</p><h2>Comments on your videos</h2></div></div><div class="studio-comments-list">${state.comments.length ? state.comments.map(commentRow).join('') : '<div class="playlist-detail__empty"><strong>No comments yet</strong><span>Comments from your managed videos will appear here.</span></div>'}</div></section><p class="studio-security-note">Delete moves a video to a one-hour recovery queue. Permissions and comment moderation are enforced again by Supabase RLS.</p>${state.editing ? editorModal(state.editing) : ''}`;
    if (!state.user) rootElement.querySelector('.studio-content-list .playlist-detail__empty').insertAdjacentHTML('beforeend', '<a class="primary-button" href="login.html?next=studio.html">Sign in to Studio</a>');
    rootElement.querySelectorAll('[data-edit-video]').forEach((button) => button.addEventListener('click', () => { state.editing = state.videos.find((video) => video.id === button.dataset.editVideo); render(); }));
    rootElement.querySelectorAll('[data-delete-video]').forEach((button) => button.addEventListener('click', () => deleteVideo(button.dataset.deleteVideo)));
    rootElement.querySelectorAll('[data-restore-video]').forEach((button) => button.addEventListener('click', () => restoreVideo(button.dataset.restoreVideo)));
    rootElement.querySelectorAll('[data-pin-video]').forEach((button) => button.addEventListener('click', () => pinVideo(button.dataset.pinVideo, button.dataset.pinned !== 'true')));
    rootElement.querySelectorAll('[data-delete-comment]').forEach((button) => button.addEventListener('click', () => deleteComment(button.dataset.deleteComment)));
    rootElement.querySelector('#studio-edit-form')?.addEventListener('submit', saveEdit);
    rootElement.querySelector('[data-close-editor]')?.addEventListener('click', () => { state.editing = null; render(); });
  }

  function videoRow(video) {
    const image = video.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=700&q=80';
    if (video.deleted_at) return `<article class="studio-content-row studio-content-row--deleted"><img src="${escape(image)}" alt="" /><div class="studio-content-row__copy"><strong>${escape(video.title)}</strong><span>Deleted • recovery until ${escape(formatRecoveryTime(video.delete_expires_at))}</span></div><div class="studio-content-row__actions">${canRecover(video) ? `<button type="button" data-restore-video="${escape(video.id)}">Recover</button>` : '<span class="studio-expired-label">Recovery unavailable</span>'}</div></article>`;
    return `<article class="studio-content-row"><img src="${escape(image)}" alt="" /><div class="studio-content-row__copy"><strong>${escape(video.title)}</strong><span>${escape(video.category || 'Video')} • ${(Number(video.views) || 0).toLocaleString()} views • ${escape(age(video.created_at))}</span></div><div class="studio-content-row__actions"><button type="button" data-edit-video="${escape(video.id)}">Edit</button><button type="button" data-pin-video="${escape(video.id)}" data-pinned="${video.pinned === true}">${video.pinned ? 'Unpin' : 'Pin'}</button><button class="studio-danger" type="button" data-delete-video="${escape(video.id)}">Delete</button></div></article>`;
  }

  function commentRow(comment) {
    const video = state.videos.find((entry) => entry.id === comment.video_id);
    return `<article class="studio-comment-row"><div><strong>${escape(comment.body)}</strong><span>${escape(video?.title || 'Video')} • ${escape(age(comment.created_at))}</span></div><button class="studio-danger" type="button" data-delete-comment="${escape(comment.id)}">Delete</button></article>`;
  }

  function canRecover(video) { return Boolean(state.user && video.delete_expires_at && new Date(video.delete_expires_at).getTime() > Date.now() && (isApprovedEditor() || video.deleted_by === state.user.id)); }
  function formatRecoveryTime(value) { const timestamp = new Date(value).getTime(); return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'expired'; }
  function editorModal(video) { return `<div class="studio-editor-backdrop"><form class="studio-editor" id="studio-edit-form"><button class="modal-close" type="button" data-close-editor>×</button><p class="section-heading__overline">Edit video</p><h2>${escape(video.title)}</h2><label>Title<input id="studio-edit-title" maxlength="100" required value="${escape(video.title)}" /></label><label>Description<textarea id="studio-edit-description" maxlength="5000" rows="5">${escape(video.description || '')}</textarea></label><div class="studio-editor__actions"><button class="secondary-button" type="button" data-close-editor>Cancel</button><button class="primary-button" type="submit">Save changes</button></div></form></div>`; }

  async function saveEdit(event) {
    event.preventDefault();
    if (!client || !state.editing || !canManage(state.editing)) return toast('You do not have permission to edit this video.');
    const title = document.querySelector('#studio-edit-title').value.trim();
    const description = document.querySelector('#studio-edit-description').value;
    if (!title) return toast('Title is required.');
    const result = await client.from('videos').update({ title, description }).eq('id', state.editing.id);
    if (result.error) return toast(result.error.message);
    state.editing = null;
    await loadVideos();
    toast('Video updated');
  }

  async function deleteVideo(id) {
    const video = state.videos.find((entry) => entry.id === id);
    if (!video || !canManage(video) || !client || !window.confirm(`Delete “${video.title}”?`)) return;
    if (!state.hasDeletedColumns) return toast('Run supabase/admin.sql to enable the one-hour recovery window.');
    const result = await client.rpc('soft_delete_video', { target_video_id: id });
    if (result.error) return toast(result.error.message);
    await loadVideos();
    toast('Video moved to the one-hour recovery queue');
  }

  async function restoreVideo(id) {
    if (!client || !state.hasDeletedColumns) return toast('Run supabase/admin.sql to enable video recovery.');
    const result = await client.rpc('restore_video', { target_video_id: id });
    if (result.error) return toast(result.error.message || 'Could not recover video');
    await loadVideos();
    toast('Video recovered');
  }

  async function pinVideo(id, pinned) {
    const video = state.videos.find((entry) => entry.id === id);
    if (!video || !canManage(video) || !client) return toast('You do not have permission to pin this video.');
    if (!state.hasPinnedColumn) return toast('Run supabase/creator.sql first to enable pinning.');
    const result = await client.from('videos').update({ pinned }).eq('id', id);
    if (result.error) return toast(result.error.message);
    await loadVideos();
    toast(pinned ? 'Video pinned' : 'Video unpinned');
  }

  async function deleteComment(id) {
    if (!client || !window.confirm('Delete this comment and its replies?')) return;
    const result = await client.from('comments').delete().eq('id', id);
    if (result.error) return toast(result.error.message || 'Could not delete comment');
    await loadVideos();
    toast('Comment deleted');
  }

  if (!client) render();
  else getUser().then((user) => { state.user = user; return loadVideos(); }).catch((error) => { toast(error.message || 'Could not load Creator Studio'); render(); });
}());
