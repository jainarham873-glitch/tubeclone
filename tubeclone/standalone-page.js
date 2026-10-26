(function () {
  'use strict';

  const videos = [
    { id: 'v1', title: 'A quiet morning in the city that never sleeps', channel: 'Mina Park', views: '2.4M views', age: '2 days ago', duration: '12:48', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=85' },
    { id: 'v2', title: 'Late night coding playlist — focus & flow', channel: 'Lofi Junction', views: '894K views', age: '1 week ago', duration: '1:02:24', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85' },
    { id: 'v3', title: 'The 10 minute desk reset that changed my workday', channel: 'Kara Makes', views: '476K views', age: '4 days ago', duration: '10:16', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85' },
    { id: 'v4', title: 'Building a tiny cabin in the Pacific Northwest', channel: 'Northbound', views: '3.8M views', age: '3 weeks ago', duration: '28:06', image: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=85' },
    { id: 'v5', title: 'Why every great song starts with one strange sound', channel: 'Studio Notes', views: '1.1M views', age: '5 days ago', duration: '18:32', image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=85' },
    { id: 'v6', title: 'A practical guide to a slower, better weekend', channel: 'Soft Focus', views: '1.7M views', age: '1 month ago', duration: '14:05', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=85' },
  ];

  const page = document.body.dataset.page || 'History';
  const root = document.createElement('div');
  root.className = 'standalone-shell';
  document.body.replaceChildren(root);

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_error) { return fallback; }
  };
  const saved = new Set(read('tubeclone.saved', []));
  const liked = new Set(read('tubeclone.liked', []));
  const history = read('tubeclone.history', []);
  const playlists = read('tubeclone.playlists', {});
  const account = read('tubeclone.account', { displayName: '' });

  function escape(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function navLink(label, href, icon) {
    return `<a class="nav-item ${page === label ? 'nav-item--active' : ''}" href="${href}"><span class="nav-item__icon">${icon}</span><span>${label}</span></a>`;
  }

  function card(video) {
    return `<article class="video-card" data-video-id="${escape(video.id)}"><a href="index.html#watch=${encodeURIComponent(video.id)}" class="video-card__thumbnail"><img src="${escape(video.image)}" alt="" loading="lazy" /><span class="video-card__duration">${escape(video.duration)}</span></a><div class="video-card__details"><span class="avatar">${escape(video.channel.slice(0, 1))}</span><div class="video-card__info"><h3 class="video-card__title">${escape(video.title)}</h3><span class="video-card__channel">${escape(video.channel)}</span><span class="video-card__meta">${escape(video.views)} • ${escape(video.age)}</span></div></div></article>`;
  }

  const pageInfo = {
    History: ['History', 'Videos you watched recently'],
    'Watch later': ['Watch later', 'Saved videos waiting for you'],
    'Liked videos': ['Liked videos', 'Your favorite videos'],
    Subscriptions: ['Subscriptions', 'Latest videos from channels you follow'],
    Playlists: ['Playlists', 'Organize videos into collections'],
    Account: ['Your account', 'Customize your profile and preferences'],
    Shorts: ['Shorts', 'Quick videos picked for you'],
  };

   root.innerHTML = `
    <header class="topbar"><div class="topbar__left"><a class="brand" href="index.html"><span class="brand__mark"><span></span></span><span class="brand__name">YouTube</span></a></div><form class="searchbar" id="standalone-search"><input id="standalone-search-input" type="search" placeholder="Search" aria-label="Search videos" /><button class="searchbar__button" type="submit" aria-label="Search">⌕</button></form><div class="topbar__right"><button class="avatar avatar--small" type="button" data-action="account">${escape((account.displayName || 'A').slice(0, 1).toUpperCase())}</button></div></header>
    <aside class="sidebar"><nav class="sidebar__nav">${navLink('Home', 'index.html', '⌂')}${navLink('Shorts', 'shorts.html', '▹')}${navLink('Subscriptions', 'subscriptions.html', '▣')}</nav><div class="sidebar__divider"></div><div class="sidebar__section"><p class="sidebar__label">You</p>${navLink('History', 'history.html', '◷')}${navLink('Playlists', 'playlists.html', '☷')}${navLink('Watch later', 'watch-later.html', '◴')}${navLink('Liked videos', 'liked.html', '♡')}</div><div class="sidebar__divider"></div><div class="sidebar__section"><p class="sidebar__label">Explore</p>${navLink('Music', 'index.html?category=Music', '♫')}${navLink('Live', 'index.html?category=Live', '◉')}${navLink('Gaming', 'index.html?category=Gaming', '⌘')}</div></aside>
    <main class="main-content standalone-main"><div class="standalone-page-header"><p class="section-heading__overline">${escape(pageInfo[page]?.[1] || 'Tubeclone')}</p><h1>${escape(pageInfo[page]?.[0] || page)}</h1></div><section id="standalone-content"></section></main>
    <div class="toast" id="standalone-toast" role="status"></div>
     <div class="account-drawer-backdrop" id="standalone-backdrop" hidden></div><aside class="account-drawer" id="standalone-drawer" aria-hidden="true"><div class="account-drawer__header"><div><p class="section-heading__overline">Your account</p><h2>Account menu</h2></div><button class="modal-close" type="button" data-action="close-account">×</button></div><div class="account-drawer__profile"><span class="avatar avatar--drawer">${escape((account.displayName || 'A').slice(0, 1).toUpperCase())}</span><div><strong>${escape(account.displayName || 'Welcome')}</strong><span>Customize your account and creator tools</span></div></div><div class="account-drawer__actions"><a class="account-drawer__item" href="account.html"><span>◎</span><div><strong>Your account</strong><small>Profile, avatar, and preferences</small></div><b>›</b></a><a class="account-drawer__item" href="studio.html"><span>✦</span><div><strong>Creator Studio</strong><small>Edit, delete, pin, and manage videos</small></div><b>›</b></a><a class="account-drawer__item" id="standalone-admin-drawer-item" href="admin.html" hidden><span>◆</span><div><strong>Admin Console</strong><small>Moderate videos, comments, and requests</small></div><b>›</b></a><a class="account-drawer__item" href="history.html"><span>◷</span><div><strong>History</strong><small>Videos you watched</small></div><b>›</b></a></div></aside>
  `;

  const toast = (message) => { const element = document.querySelector('#standalone-toast'); element.textContent = message; element.classList.add('toast--visible'); setTimeout(() => element.classList.remove('toast--visible'), 2400); };

  function renderAccount() {
    const avatarMarkup = account.avatarUrl ? `<img class="account-page-card__avatar account-page-card__avatar-image" src="${escape(account.avatarUrl)}" alt="Profile photo" />` : `<span class="avatar account-page-card__avatar">${escape((account.displayName || 'A').slice(0, 1).toUpperCase())}</span>`;
    document.querySelector('#standalone-content').innerHTML = `<section class="account-page-card">${avatarMarkup}<p class="section-heading__overline">Profile settings</p><h2>Make this account yours</h2><form id="account-form" class="account-form"><label>Profile photo<input id="account-avatar" type="file" accept="image/png,image/jpeg,image/webp" /><small>JPG, PNG, or WebP up to 2 MiB</small></label><label>Display name<input id="account-display-name" maxlength="60" value="${escape(account.displayName || '')}" placeholder="Your name" /></label><label>Bio<textarea id="account-bio" maxlength="300" rows="4" placeholder="Tell viewers a little about you">${escape(account.bio || '')}</textarea></label><button class="primary-button" type="submit">Save profile</button></form><p class="account-page-card__note">Your profile photo is saved locally for now. We can move it to Cloudinary later.</p></section>`;
    document.querySelector('#standalone-content').insertAdjacentHTML('beforeend', '<section class="account-page-card"><p class="section-heading__overline">Supabase Auth</p><h2>Sign-in &amp; security</h2><p class="account-page-card__note">Manage your sign-in or request an email to reset your password. Your local profile settings above are separate from your login credentials.</p><p><a class="primary-button" href="login.html?next=account.html">Manage sign-in</a></p><p><a class="secondary-button" href="forgot-password.html">Reset password</a></p></section>');
    const avatarInput = document.querySelector('#account-avatar');
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        avatarInput.value = '';
        toast('Choose a JPG, PNG, or WebP image up to 2 MiB');
        return;
      }
      const preview = document.querySelector('.account-page-card__avatar-image') || document.querySelector('.account-page-card__avatar');
      preview.src ? preview.src = URL.createObjectURL(file) : preview.style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      if (!preview.src) preview.textContent = '';
    });
    document.querySelector('#account-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const file = avatarInput.files?.[0];
      const finish = (avatarUrl) => { account.displayName = document.querySelector('#account-display-name').value.trim(); account.bio = document.querySelector('#account-bio').value.trim(); if (avatarUrl) account.avatarUrl = avatarUrl; localStorage.setItem('tubeclone.account', JSON.stringify(account)); toast('Profile saved'); renderAccount(); };
      if (!file) return finish(account.avatarUrl);
      const reader = new FileReader();
      reader.onload = () => finish(String(reader.result));
      reader.onerror = () => toast('Could not read that image');
      reader.readAsDataURL(file);
    });
  }

  function renderPlaylists() {
    const items = Object.values(playlists);
    document.querySelector('#standalone-content').innerHTML = items.length ? `<div class="playlist-grid">${items.map((item) => `<article class="playlist-card"><span class="playlist-card__thumb">${(item.videoIds || []).slice(0, 4).map((id) => { const video = videos.find((entry) => entry.id === id) || videos[0]; return `<img src="${escape(video.image)}" alt="" />`; }).join('')}</span><span class="playlist-card__copy"><strong>${escape(item.name)}</strong><span>${(item.videoIds || []).length} videos • ${escape(item.privacy || 'private')}</span></span></article>`).join('')}</div>` : '<div class="playlist-detail__empty"><strong>No playlists yet</strong><span>Go back to the home page and create one from a watch page.</span></div>';
  }

  function renderVideos() {
    let list = videos;
    if (page === 'History') list = history.map((id) => videos.find((video) => video.id === id)).filter(Boolean);
    if (page === 'Watch later') list = videos.filter((video) => saved.has(video.id));
    if (page === 'Liked videos') list = videos.filter((video) => liked.has(video.id));
    if (page === 'Subscriptions') list = videos.filter((video) => ['Mina Park', 'Lofi Junction'].includes(video.channel));
    document.querySelector('#standalone-content').innerHTML = list.length ? `<div class="video-grid">${list.map(card).join('')}</div>` : '<div class="playlist-detail__empty"><strong>Nothing here yet</strong><span>Watch, like, save, or subscribe to fill this page.</span></div>';
  }

  function persistLibraryState() {
    localStorage.setItem('tubeclone.saved', JSON.stringify([...saved]));
    localStorage.setItem('tubeclone.liked', JSON.stringify([...liked]));
  }

  function renderShorts() {
    document.querySelector('#standalone-content').innerHTML = `
      <section class="shorts-page" aria-labelledby="shorts-title">
        <div class="shorts-page__intro">
          <div><p class="section-heading__overline">Vertical video feed</p><h2 id="shorts-title">Shorts</h2><p>Scroll through quick ideas, scenes, and sounds from the Tubeclone community.</p></div>
          <span class="shorts-page__hint">Swipe or scroll</span>
        </div>
        <div class="shorts-feed">
          ${videos.map((video, index) => `
            <article class="short-card" data-short-id="${escape(video.id)}" style="--short-delay:${Math.min(index * 45, 260)}ms">
              <div class="short-card__stage">
                <img src="${escape(video.image)}" alt="" loading="lazy" />
                <div class="short-card__shade"></div>
                <button class="short-card__play" type="button" data-action="open-short" data-video-id="${escape(video.id)}" aria-label="Open ${escape(video.title)}">▶</button>
                <div class="short-card__copy">
                  <span class="short-card__tag">${escape(video.category || 'Short')}</span>
                  <h3>${escape(video.title)}</h3>
                  <p>@${escape(video.channel.replace(/\s+/g, '').toLowerCase())} · ${escape(video.views)}</p>
                </div>
                <span class="short-card__duration">${escape(video.duration)}</span>
              </div>
              <div class="short-card__rail" aria-label="Short actions">
                <button class="short-action ${liked.has(video.id) ? 'short-action--active' : ''}" type="button" data-action="short-like" data-video-id="${escape(video.id)}"><span>♡</span><small>${liked.has(video.id) ? 'Liked' : 'Like'}</small></button>
                <button class="short-action ${saved.has(video.id) ? 'short-action--active' : ''}" type="button" data-action="short-save" data-video-id="${escape(video.id)}"><span>▱</span><small>${saved.has(video.id) ? 'Saved' : 'Save'}</small></button>
                <button class="short-action" type="button" data-action="short-share" data-video-id="${escape(video.id)}"><span>↗</span><small>Share</small></button>
                <button class="short-action short-action--channel" type="button" data-action="open-short" data-video-id="${escape(video.id)}" aria-label="Watch full video"><span class="avatar">${escape(video.channel.slice(0, 1))}</span><small>Watch</small></button>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function render() {
    if (page === 'Account') renderAccount();
    else if (page === 'Playlists') renderPlaylists();
    else if (page === 'Shorts') renderShorts();
    else renderVideos();
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const videoId = event.target.closest('[data-video-id]')?.dataset.videoId;
    const video = videos.find((entry) => entry.id === videoId);
    if (page === 'Shorts' && video && action === 'short-like') {
      if (liked.has(video.id)) liked.delete(video.id); else liked.add(video.id);
      persistLibraryState();
      renderShorts();
      return;
    }
    if (page === 'Shorts' && video && action === 'short-save') {
      if (saved.has(video.id)) saved.delete(video.id); else saved.add(video.id);
      persistLibraryState();
      renderShorts();
      return;
    }
    if (page === 'Shorts' && video && action === 'short-share') {
      const shareUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, '')}index.html#watch=${encodeURIComponent(video.id)}`;
      const share = navigator.clipboard?.writeText ? navigator.clipboard.writeText(shareUrl) : Promise.reject(new Error('Clipboard unavailable'));
      share.then(() => toast('Short link copied')).catch(() => toast('Open the full video to share it'));
      return;
    }
    if (page === 'Shorts' && video && action === 'open-short') {
      window.location.href = `index.html#watch=${encodeURIComponent(video.id)}`;
      return;
    }
    if (action === 'account') { document.querySelector('#standalone-drawer').classList.add('account-drawer--open'); document.querySelector('#standalone-drawer').setAttribute('aria-hidden', 'false'); document.querySelector('#standalone-backdrop').hidden = false; }
    if (action === 'close-account' || event.target.id === 'standalone-backdrop') { document.querySelector('#standalone-drawer').classList.remove('account-drawer--open'); document.querySelector('#standalone-drawer').setAttribute('aria-hidden', 'true'); document.querySelector('#standalone-backdrop').hidden = true; }
  });
  document.querySelector('#standalone-search').addEventListener('submit', (event) => { event.preventDefault(); const query = document.querySelector('#standalone-search-input').value.trim(); window.location.href = `index.html?search=${encodeURIComponent(query)}`; });
   render();
   window.TubeAuthGate?.ready?.then((user) => {
     const admins = new Set(['arhamjaindhiraj@gmail.com', 'jainarham873@gmail.com']);
     const item = document.querySelector('#standalone-admin-drawer-item');
     if (item) item.hidden = !admins.has(user?.email?.toLowerCase());
   });
 }());
