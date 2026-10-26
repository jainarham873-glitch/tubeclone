(function () {
  'use strict';

  const root = document.createElement('div');
  root.className = 'admin-shell';
  document.body.replaceChildren(root);
  const state = { user: null, client: null, users: [], videos: [], comments: [], search: '' };

  function escape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function isAdmin(user = state.user) {
    return Boolean(user?.email && ['arhamjaindhiraj@gmail.com', 'jainarham873@gmail.com'].includes(user.email.toLowerCase()));
  }

  function toast(message) {
    const element = document.querySelector('#admin-toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('toast--visible');
    window.setTimeout(() => element.classList.remove('toast--visible'), 2600);
  }

  function userName(user) { return user.display_name || user.username || user.email || 'User'; }
  function avatar(user) { return user.avatar_url ? `<img src="${escape(user.avatar_url)}" alt="" />` : escape(userName(user).slice(0, 1).toUpperCase()); }
  function banStatus(user) {
    if (user.is_permanent) return '<span class="admin-status admin-status--banned">Permanent ban</span>';
    const timestamp = new Date(user.banned_until || '').getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return '<span class="admin-status">Active</span>';
    return `<span class="admin-status admin-status--banned">Banned · ${formatRemaining(timestamp)} left</span>`;
  }
  function formatRemaining(timestamp) {
    const totalMinutes = Math.max(0, Math.ceil((timestamp - Date.now()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes}m`;
  }
  function formatRecovery(value) {
    const timestamp = new Date(value || '').getTime();
    return Number.isFinite(timestamp) && timestamp > Date.now() ? `Recovery until ${new Date(timestamp).toLocaleString()}` : 'Recovery expired';
  }

  function renderShell() {
    root.innerHTML = `
      <header class="topbar"><div class="topbar__left"><a class="brand" href="index.html"><span class="brand__mark"><span></span></span><span class="brand__name">TUBECLONE</span></a></div><div class="studio-topbar-label">Admin Dashboard</div><div class="topbar__right"><a class="icon-button" href="index.html" aria-label="Back to Tubeclone">⌂</a><a class="avatar avatar--small" href="account.html" aria-label="Account">A</a></div></header>
      <aside class="sidebar" aria-label="Admin navigation"><nav class="sidebar__nav"><a class="nav-item" href="index.html"><span class="nav-item__icon">⌂</span><span>Home</span></a><a class="nav-item" href="studio.html"><span class="nav-item__icon">✦</span><span>Creator Studio</span></a><a class="nav-item nav-item--active" href="admin.html"><span class="nav-item__icon">◆</span><span>Admin Dashboard</span></a></nav><div class="sidebar__divider"></div><div class="sidebar__section"><p class="sidebar__label">Admin tools</p><a class="nav-item" href="#users"><span class="nav-item__icon">◎</span><span>Users</span></a><a class="nav-item" href="#videos"><span class="nav-item__icon">▤</span><span>Videos</span></a><a class="nav-item" href="#comments"><span class="nav-item__icon">◌</span><span>Comments</span></a><a class="nav-item" href="#requests"><span class="nav-item__icon">⚑</span><span>Requests</span></a></div></aside>
      <main class="main-content admin-main"><div id="admin-root"></div></main><div class="toast" id="admin-toast" role="status"></div>
    `;
  }

  function render() {
    const target = document.querySelector('#admin-root');
    const filtered = state.users.filter((user) => [user.email, user.username, user.display_name].join(' ').toLowerCase().includes(state.search.toLowerCase()));
    const userRows = filtered.length ? filtered.map((user) => `<article class="admin-user-row"><a class="admin-user-row__identity" href="admin-user.html?id=${encodeURIComponent(user.id)}"><span class="admin-user-avatar">${avatar(user)}</span><span><strong>${escape(userName(user))}</strong><small>${escape(user.email)}</small><em>@${escape(user.username || 'creator')}</em></span></a><div class="admin-user-row__stats"><span>${Number(user.video_count || 0)} videos</span><span>${Number(user.comment_count || 0)} comments</span>${banStatus(user)}</div><a class="admin-user-row__open" href="admin-user.html?id=${encodeURIComponent(user.id)}">Open profile →</a><a class="admin-user-row__ban" href="admin-user.html?id=${encodeURIComponent(user.id)}#ban">Ban / manage</a></article>`).join('') : '<div class="playlist-detail__empty"><strong>No matching users</strong><span>Try a different email, username, or display name.</span></div>';
    const videos = state.videos.length ? state.videos.map((video) => `<article class="admin-moderation-row ${video.deleted_at ? 'admin-moderation-row--deleted' : ''}"><div class="admin-moderation-row__copy"><strong>${escape(video.title)}</strong><span>${escape(state.users.find((user) => user.id === video.owner_id)?.email || 'Unknown user')} • ${escape(video.category || 'Video')} • ${(Number(video.views) || 0).toLocaleString()} views${video.deleted_at ? ` • ${escape(formatRecovery(video.delete_expires_at))}` : ''}</span></div>${video.deleted_at ? (new Date(video.delete_expires_at || '').getTime() > Date.now() ? `<button class="admin-action" type="button" data-admin-restore-video="${escape(video.id)}">Recover</button>` : '<span class="admin-expired-label">Expired</span>') : `<button class="studio-danger" type="button" data-admin-delete-video="${escape(video.id)}">Delete video</button>`}</article>`).join('') : '<div class="playlist-detail__empty"><strong>No videos found</strong><span>Videos will appear here after the admin migration is installed.</span></div>';
    const comments = state.comments.length ? state.comments.map((comment) => `<article class="admin-moderation-row"><div class="admin-moderation-row__copy"><strong>${escape(state.users.find((user) => user.id === comment.user_id)?.email || 'Unknown user')}</strong><span>${escape(comment.body)} • on ${escape(state.videos.find((video) => video.id === comment.video_id)?.title || 'video')}</span></div><button class="studio-danger" type="button" data-admin-delete-comment="${escape(comment.id)}">Delete comment</button></article>`).join('') : '<div class="playlist-detail__empty"><strong>No comments found</strong><span>Comments from videos will appear here.</span></div>';
    target.innerHTML = `<div class="admin-header"><div><p class="section-heading__overline">Restricted tools</p><h1>Admin Dashboard</h1><p>Search every account, review moderation status, and manage content.</p></div><span class="admin-badge">Administrator</span></div><div class="studio-permission-card"><span class="avatar">${escape(state.user.email.slice(0, 1).toUpperCase())}</span><div><strong>${escape(state.user.email)}</strong><small>Only approved administrators can see this dashboard.</small></div></div><section class="admin-section" id="users"><div class="admin-section-heading"><div><p class="section-heading__overline">Accounts</p><h2>Every user</h2></div><label class="admin-search"><span>⌕</span><input id="admin-user-search" type="search" placeholder="Search email, username, or name" value="${escape(state.search)}" /></label></div><div class="admin-user-list">${userRows}</div></section><section class="admin-section" id="videos"><div class="section-heading"><div><p class="section-heading__overline">Moderation</p><h2>Videos</h2></div></div><div class="admin-moderation-list">${videos}</div></section><section class="admin-section" id="comments"><div class="section-heading"><div><p class="section-heading__overline">Moderation</p><h2>Comments</h2></div></div><div class="admin-moderation-list">${comments}</div></section><section class="admin-section" id="requests"><div class="section-heading"><div><p class="section-heading__overline">Admin only</p><h2>Requests &amp; reports</h2></div></div><div class="admin-request-card"><span class="admin-request-card__icon">⚑</span><div><strong>Admin request inbox</strong><p>Only approved administrators can review or act on requests. This area is ready for the next moderation workflow.</p></div><span class="admin-request-card__status">No requests yet</span></div></section><p class="studio-security-note">Video deletion is soft deletion with a one-hour recovery window. Admins can recover admin-deleted videos during that window.</p>`;
    document.querySelector('#admin-user-search').addEventListener('input', (event) => { state.search = event.target.value.trim(); render(); document.querySelector('#admin-user-search')?.focus(); });
    target.querySelectorAll('[data-admin-delete-video]').forEach((button) => button.addEventListener('click', () => deleteVideo(button.dataset.adminDeleteVideo)));
    target.querySelectorAll('[data-admin-restore-video]').forEach((button) => button.addEventListener('click', () => restoreVideo(button.dataset.adminRestoreVideo)));
    target.querySelectorAll('[data-admin-delete-comment]').forEach((button) => button.addEventListener('click', () => deleteComment(button.dataset.adminDeleteComment)));
  }

  async function loadData() {
    const users = await state.client.rpc('admin_list_users');
    if (users.error) throw users.error;
    state.users = users.data || [];
    const videos = await state.client.from('videos').select('id, owner_id, title, category, views, deleted_at, deleted_by, delete_expires_at').order('created_at', { ascending: false }).limit(300);
    if (videos.error) throw videos.error;
    state.videos = videos.data || [];
    const comments = await state.client.from('comments').select('id, video_id, user_id, body, created_at').order('created_at', { ascending: false }).limit(500);
    if (!comments.error) state.comments = comments.data || [];
    render();
  }

  async function deleteVideo(id) {
    if (!window.confirm('Delete this video? It can be recovered by an admin for one hour.')) return;
    const result = await state.client.rpc('soft_delete_video', { target_video_id: id });
    if (result.error) return toast(result.error.message || 'Could not delete video');
    await loadData();
    toast('Video moved to the one-hour recovery queue');
  }

  async function restoreVideo(id) {
    const result = await state.client.rpc('restore_video', { target_video_id: id });
    if (result.error) return toast(result.error.message || 'Could not recover video');
    await loadData();
    toast('Video recovered');
  }

  async function deleteComment(id) {
    if (!window.confirm('Delete this comment and its replies?')) return;
    const result = await state.client.from('comments').delete().eq('id', id);
    if (result.error) return toast(result.error.message || 'Could not delete comment');
    await loadData();
    toast('Comment deleted');
  }

  renderShell();
  window.TubeAuthGate.ready.then((user) => {
    state.user = user;
    state.client = window.TubeAuthGate.client;
    if (!isAdmin()) {
      window.location.replace('account.html');
      return;
    }
    loadData().catch((error) => { render(); toast(error.message || 'Run supabase/admin.sql to enable the admin dashboard'); });
  });
}());
