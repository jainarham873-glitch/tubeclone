(function () {
  'use strict';

  const root = document.createElement('div');
  root.className = 'admin-shell';
  document.body.replaceChildren(root);
  const state = { user: null, client: null, profile: null, videos: [], comments: [] };
  const targetId = new URLSearchParams(window.location.search).get('id');

  function escape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }
  function isAdmin(user = state.user) { return Boolean(user?.email && ['arhamjaindhiraj@gmail.com', 'jainarham873@gmail.com'].includes(user.email.toLowerCase())); }
  function toast(message) { const element = document.querySelector('#admin-user-toast'); if (!element) return; element.textContent = message; element.classList.add('toast--visible'); window.setTimeout(() => element.classList.remove('toast--visible'), 2600); }
  function avatar(profile) { return profile?.avatar_url ? `<img src="${escape(profile.avatar_url)}" alt="Profile photo" />` : escape((profile?.display_name || profile?.username || profile?.email || 'U').slice(0, 1).toUpperCase()); }
  function formatRemaining(timestamp) { const totalMinutes = Math.max(0, Math.ceil((timestamp - Date.now()) / 60000)); const hours = Math.floor(totalMinutes / 60); return hours ? `${hours}h ${(totalMinutes % 60).toString().padStart(2, '0')}m` : `${totalMinutes}m`; }
  function banLabel(profile) { if (profile.is_permanent) return '<span class="admin-status admin-status--banned">Permanent ban</span>'; const timestamp = new Date(profile.banned_until || '').getTime(); return Number.isFinite(timestamp) && timestamp > Date.now() ? `<span class="admin-status admin-status--banned">Banned · ${formatRemaining(timestamp)} left</span>` : '<span class="admin-status">Not banned</span>'; }
  function parseDuration(value) {
    const text = String(value || '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Use hours.minutes, for example 0.30 for 30 minutes.');
    const [hourText, minuteText = ''] = text.split('.');
    const hours = Number(hourText);
    const minutes = minuteText ? Number(minuteText.padEnd(2, '0')) : 0;
    if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || (hours === 0 && minutes === 0)) throw new Error('Minutes must be 00-59 and the duration must be greater than zero.');
    return { hours, minutes, totalMinutes: hours * 60 + minutes };
  }
  function formatRecovery(value) { const timestamp = new Date(value || '').getTime(); return Number.isFinite(timestamp) && timestamp > Date.now() ? `Recovery until ${new Date(timestamp).toLocaleString()}` : 'Recovery expired'; }

  function renderShell() {
    root.innerHTML = `<header class="topbar"><div class="topbar__left"><a class="brand" href="index.html"><span class="brand__mark"><span></span></span><span class="brand__name">TUBECLONE</span></a></div><div class="studio-topbar-label">User moderation</div><div class="topbar__right"><a class="icon-button" href="admin.html" aria-label="Back to admin dashboard">◆</a><a class="avatar avatar--small" href="account.html" aria-label="Account">A</a></div></header><aside class="sidebar" aria-label="Admin navigation"><nav class="sidebar__nav"><a class="nav-item" href="index.html"><span class="nav-item__icon">⌂</span><span>Home</span></a><a class="nav-item" href="admin.html"><span class="nav-item__icon">◆</span><span>Admin Dashboard</span></a><a class="nav-item nav-item--active" href="admin-user.html?id=${encodeURIComponent(targetId || '')}"><span class="nav-item__icon">◎</span><span>User profile</span></a></nav></aside><main class="main-content admin-main"><div id="admin-user-root"></div></main><div class="toast" id="admin-user-toast" role="status"></div>`;
  }

  function render() {
    const target = document.querySelector('#admin-user-root');
    if (!state.profile) { target.innerHTML = '<div class="playlist-detail__empty"><strong>User not found</strong><span>Return to the admin dashboard and choose an account.</span><a class="primary-button" href="admin.html">Back to dashboard</a></div>'; return; }
    const activeVideos = state.videos.filter((video) => !video.deleted_at);
    const videoRows = state.videos.length ? state.videos.map((video) => `<article class="admin-moderation-row ${video.deleted_at ? 'admin-moderation-row--deleted' : ''}"><div class="admin-moderation-row__copy"><strong>${escape(video.title)}</strong><span>${escape(video.category || 'Video')} • ${(Number(video.views) || 0).toLocaleString()} views${video.deleted_at ? ` • ${escape(formatRecovery(video.delete_expires_at))}` : ''}</span></div>${video.deleted_at ? (new Date(video.delete_expires_at || '').getTime() > Date.now() ? `<button class="admin-action" type="button" data-restore-video="${escape(video.id)}">Recover</button>` : '<span class="admin-expired-label">Expired</span>') : `<button class="studio-danger" type="button" data-delete-video="${escape(video.id)}">Delete</button>`}</article>`).join('') : '<div class="playlist-detail__empty"><strong>No videos uploaded</strong><span>This account has not uploaded a video.</span></div>';
    const commentRows = state.comments.length ? state.comments.map((comment) => `<article class="admin-moderation-row"><div class="admin-moderation-row__copy"><strong>${escape(comment.body)}</strong><span>${escape(new Date(comment.created_at).toLocaleString())}</span></div><button class="studio-danger" type="button" data-delete-comment="${escape(comment.id)}">Delete</button></article>`).join('') : '<div class="playlist-detail__empty"><strong>No comments</strong><span>This account has not posted a comment.</span></div>';
    target.innerHTML = `<a class="back-button" href="admin.html">← Back to admin dashboard</a><section class="admin-profile-card"><span class="admin-profile-card__avatar">${avatar(state.profile)}</span><div class="admin-profile-card__copy"><p class="section-heading__overline">Account profile</p><h1>${escape(state.profile.display_name || state.profile.username || 'User')}</h1><strong>${escape(state.profile.email)}</strong><span>@${escape(state.profile.username || 'creator')}</span><div class="admin-profile-card__status">${banLabel(state.profile)}</div></div><div class="admin-profile-card__actions"><a class="secondary-button" href="mailto:${escape(state.profile.email)}">Email user</a></div></section><div class="studio-stats"><div class="studio-stat"><span>Videos uploaded</span><strong>${activeVideos.length}</strong></div><div class="studio-stat"><span>Comments</span><strong>${state.comments.length}</strong></div><div class="studio-stat"><span>Joined</span><strong>${new Date(state.profile.created_at).toLocaleDateString()}</strong></div></div><section class="admin-section" id="ban"><div class="section-heading"><div><p class="section-heading__overline">Account controls</p><h2>Ban controls</h2></div></div><div class="admin-ban-panel"><div><strong>Temporary ban</strong><p>Enter <b>0.30</b> for 30 minutes. Minutes can be 00-59.</p></div><div class="admin-ban-form"><input id="ban-duration" type="text" inputmode="decimal" placeholder="0.30" aria-label="Ban duration hours and minutes" /><button class="admin-action" type="button" data-ban-temporary>Ban for time</button></div><div class="admin-ban-actions"><button class="secondary-button" type="button" data-ban-add>Add time</button><button class="secondary-button" type="button" data-ban-remove>Minus time</button><button class="secondary-button" type="button" data-ban-unban>Unban</button><button class="studio-danger" type="button" data-ban-permanent>Permanent ban</button></div></div></section><section class="admin-section"><div class="section-heading"><div><p class="section-heading__overline">User content</p><h2>Videos</h2></div></div><div class="admin-moderation-list">${videoRows}</div></section><section class="admin-section"><div class="section-heading"><div><p class="section-heading__overline">User activity</p><h2>Comments</h2></div></div><div class="admin-moderation-list">${commentRows}</div></section>`;
    target.querySelector('[data-ban-temporary]').addEventListener('click', banTemporary);
    target.querySelector('[data-ban-add]').addEventListener('click', () => adjustBan(1));
    target.querySelector('[data-ban-remove]').addEventListener('click', () => adjustBan(-1));
    target.querySelector('[data-ban-unban]').addEventListener('click', unban);
    target.querySelector('[data-ban-permanent]').addEventListener('click', permanentBan);
    target.querySelectorAll('[data-delete-video]').forEach((button) => button.addEventListener('click', () => deleteVideo(button.dataset.deleteVideo)));
    target.querySelectorAll('[data-restore-video]').forEach((button) => button.addEventListener('click', () => restoreVideo(button.dataset.restoreVideo)));
    target.querySelectorAll('[data-delete-comment]').forEach((button) => button.addEventListener('click', () => deleteComment(button.dataset.deleteComment)));
  }

  async function loadData() {
    const users = await state.client.rpc('admin_list_users');
    if (users.error) throw users.error;
    state.profile = (users.data || []).find((profile) => profile.id === targetId) || null;
    const videos = await state.client.from('videos').select('id, owner_id, title, category, views, deleted_at, deleted_by, delete_expires_at').eq('owner_id', targetId).order('created_at', { ascending: false });
    if (videos.error) throw videos.error;
    state.videos = videos.data || [];
    const comments = await state.client.from('comments').select('id, video_id, user_id, body, created_at').eq('user_id', targetId).order('created_at', { ascending: false });
    if (!comments.error) state.comments = comments.data || [];
    render();
  }

  function durationInput() { try { return parseDuration(document.querySelector('#ban-duration').value); } catch (error) { toast(error.message); return null; } }
  async function banTemporary() { const duration = durationInput(); if (!duration || !window.confirm(`Ban ${state.profile.email} for ${duration.hours}h ${duration.minutes}m?`)) return; const result = await state.client.rpc('admin_set_user_ban', { target_user_id: targetId, duration_hours: duration.hours, duration_minutes: duration.minutes, permanent: false, ban_reason: 'Admin dashboard action' }); if (result.error) return toast(result.error.message); await loadData(); toast('Temporary ban applied'); }
  async function adjustBan(direction) { const duration = durationInput(); const action = direction > 0 ? 'Add' : 'Remove'; if (!duration || !window.confirm(`${action} ${duration.hours}h ${duration.minutes}m ${direction > 0 ? 'to' : 'from'} this ban?`)) return; const result = await state.client.rpc('admin_adjust_user_ban', { target_user_id: targetId, delta_minutes: direction * duration.totalMinutes }); if (result.error) return toast(result.error.message); await loadData(); toast(direction > 0 ? 'Ban time added' : 'Ban time removed'); }
  async function unban() { if (!window.confirm(`Unban ${state.profile.email}?`)) return; const result = await state.client.rpc('admin_unban_user', { target_user_id: targetId }); if (result.error) return toast(result.error.message); await loadData(); toast('User unbanned'); }
  async function permanentBan() { if (!window.confirm(`Do you really want to permanently ban ${state.profile.email}?`)) return; const result = await state.client.rpc('admin_set_user_ban', { target_user_id: targetId, duration_hours: 0, duration_minutes: 0, permanent: true, ban_reason: 'Permanent admin ban' }); if (result.error) return toast(result.error.message); await loadData(); toast('Permanent ban applied'); }
  async function deleteVideo(id) { if (!window.confirm('Delete this video? An admin can recover it for one hour.')) return; const result = await state.client.rpc('soft_delete_video', { target_video_id: id }); if (result.error) return toast(result.error.message); await loadData(); toast('Video moved to the recovery queue'); }
  async function restoreVideo(id) { const result = await state.client.rpc('restore_video', { target_video_id: id }); if (result.error) return toast(result.error.message); await loadData(); toast('Video recovered'); }
  async function deleteComment(id) { if (!window.confirm('Delete this comment and its replies?')) return; const result = await state.client.from('comments').delete().eq('id', id); if (result.error) return toast(result.error.message); await loadData(); toast('Comment deleted'); }

  renderShell();
  window.TubeAuthGate.ready.then((user) => { state.user = user; state.client = window.TubeAuthGate.client; if (!isAdmin()) { window.location.replace('account.html'); return; } if (!targetId) { window.location.replace('admin.html'); return; } loadData().catch((error) => { render(); toast(error.message || 'Run supabase/admin.sql to enable user moderation'); }); });
}());
