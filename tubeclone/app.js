(function () {
  'use strict';

  // Older reset emails may use the Site URL instead of the dedicated callback.
  if (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
    window.location.replace('reset-password.html' + window.location.hash);
    return;
  }

  const categories = ['All', 'Music', 'Movies & TV', 'Mixes', 'Live', 'Gaming', 'News', 'Sports', 'Learning', 'Podcasts', 'Travel', 'Design', 'Fashion & Beauty', 'Recently uploaded'];
  const editorEmails = new Set(['arhamjaindhiraj@gmail.com', 'jainarham873@gmail.com']);
  const heroSpots = {
    Music: { eyebrow: 'Music spotlight', title: 'Find your next', emphasis: 'favorite sound.', description: 'Fresh tracks, live sessions, and mixes picked for your mood.', action: 'Explore Music' },
    'Movies & TV': { eyebrow: 'Movies & TV', title: 'Press play on', emphasis: 'your next story.', description: 'Trailers, scenes, reviews, and unforgettable moments.', action: 'Explore Movies & TV' },
    Mixes: { eyebrow: 'Mixes for you', title: 'Set the mood with', emphasis: 'a better mix.', description: 'Long-form mixes for focus, calm, movement, and late nights.', action: 'Explore Mixes' },
    Live: { eyebrow: 'Live now', title: 'See what is', emphasis: 'happening live.', description: 'Drop into live conversations, performances, and community moments.', action: 'Explore Live' },
    Gaming: { eyebrow: 'Gaming spotlight', title: 'Your next', emphasis: 'level starts here.', description: 'Walkthroughs, cozy sessions, competitive plays, and creator tips.', action: 'Explore Gaming' },
    News: { eyebrow: 'News & ideas', title: 'Catch up on', emphasis: 'what matters.', description: 'Smart explainers, conversations, and stories from around the world.', action: 'Explore News' },
    Sports: { eyebrow: 'Sports spotlight', title: 'Every play has', emphasis: 'a story.', description: 'Highlights, analysis, reactions, and the moments fans remember.', action: 'Explore Sports' },
    Learning: { eyebrow: 'Learning spotlight', title: 'Make time for', emphasis: 'a new idea.', description: 'Practical lessons, clear explainers, and skills worth keeping.', action: 'Explore Learning' },
    Podcasts: { eyebrow: 'Podcast spotlight', title: 'Stay curious with', emphasis: 'a fresh conversation.', description: 'Thoughtful interviews, stories, and ideas for the long way home.', action: 'Explore Podcasts' },
    Travel: { eyebrow: 'Travel spotlight', title: 'Take the scenic route', emphasis: 'from anywhere.', description: 'Fresh stories, deep dives, and ideas worth sharing.', action: 'Explore Travel' },
    Design: { eyebrow: 'Design spotlight', title: 'Make something', emphasis: 'worth seeing.', description: 'Creative process, practical tips, and visual inspiration.', action: 'Explore Design' },
    'Fashion & Beauty': { eyebrow: 'Fashion & Beauty', title: 'Find your', emphasis: 'next look.', description: 'Style, beauty, routines, and creators with a point of view.', action: 'Explore Fashion & Beauty' },
    'Recently uploaded': { eyebrow: 'Fresh from creators', title: 'See what is', emphasis: 'new today.', description: 'The latest uploads from the Tubeclone community, all in one place.', action: 'Explore recent uploads' },
  };
  const notificationItems = [
    { id: 'welcome', title: 'Welcome to Tubeclone', text: 'Your personalized feed is ready to explore.', time: 'Just now', avatar: 'T', avatarClass: 'avatar--remote' },
    { id: 'creator', title: 'Creator Studio is ready', text: 'Upload a video and start building your channel.', time: 'Today', avatar: '✦', avatarClass: 'avatar--soft' },
    { id: 'playlist', title: 'Organize your favorites', text: 'Create a playlist from any watch page.', time: 'Today', avatar: 'P', avatarClass: 'avatar--parallel' },
  ];

  const videos = [
    { id: 'v1', title: 'A quiet morning in the city that never sleeps', channel: 'Mina Park', subscribers: '1.2M subscribers', views: '2.4M views', age: '2 days ago', duration: '12:48', category: 'Travel', avatar: 'M', avatarClass: 'avatar--mina', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=85' },
    { id: 'v2', title: 'Late night coding playlist — focus & flow', channel: 'Lofi Junction', subscribers: '842K subscribers', views: '894K views', age: '1 week ago', duration: '1:02:24', category: 'Music', avatar: 'L', avatarClass: 'avatar--lofi', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85' },
    { id: 'v3', title: 'The 10 minute desk reset that changed my workday', channel: 'Kara Makes', subscribers: '356K subscribers', views: '476K views', age: '4 days ago', duration: '10:16', category: 'Design', avatar: 'K', avatarClass: 'avatar--kara', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85' },
    { id: 'v4', title: 'Building a tiny cabin in the Pacific Northwest', channel: 'Northbound', subscribers: '2.1M subscribers', views: '3.8M views', age: '3 weeks ago', duration: '28:06', category: 'Travel', avatar: 'N', avatarClass: 'avatar--north', image: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=85' },
    { id: 'v5', title: 'Why every great song starts with one strange sound', channel: 'Studio Notes', subscribers: '675K subscribers', views: '1.1M views', age: '5 days ago', duration: '18:32', category: 'Music', avatar: 'S', avatarClass: 'avatar--studio', image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=85' },
    { id: 'v6', title: 'A practical guide to a slower, better weekend', channel: 'Soft Focus', subscribers: '924K subscribers', views: '1.7M views', age: '1 month ago', duration: '14:05', category: 'Podcasts', avatar: 'S', avatarClass: 'avatar--soft', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=85' },
    { id: 'v7', title: 'The cozy game night: 5 games worth playing', channel: 'Pixel Pantry', subscribers: '218K subscribers', views: '302K views', age: '2 days ago', duration: '22:41', category: 'Gaming', avatar: 'P', avatarClass: 'avatar--pixel', image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=85' },
    { id: 'v8', title: 'Live from the rooftop: an evening jazz session', channel: 'The Blue Hour', subscribers: '1.6M subscribers', views: 'Live now', age: '', duration: 'LIVE', category: 'Live', avatar: 'B', avatarClass: 'avatar--blue', image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=900&q=85' },
    { id: 'v9', title: 'What the future of cities could look like', channel: 'Tomorrow, Today', subscribers: '547K subscribers', views: '732K views', age: '6 days ago', duration: '24:19', category: 'News', avatar: 'T', avatarClass: 'avatar--tomorrow', image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=85' },
    { id: 'v10', title: 'A cinematic train ride through the Swiss Alps', channel: 'Wander Films', subscribers: '3.4M subscribers', views: '4.5M views', age: '2 weeks ago', duration: '19:47', category: 'Travel', avatar: 'W', avatarClass: 'avatar--wander', image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85' },
    { id: 'v11', title: 'Ambient mix for deep work — volume 04', channel: 'Parallel Radio', subscribers: '1.1M subscribers', views: '2M views', age: '3 days ago', duration: '58:06', category: 'Mixes', avatar: 'P', avatarClass: 'avatar--parallel', image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=85' },
    { id: 'v12', title: 'Make your own visual identity from scratch', channel: 'Field Guide', subscribers: '98K subscribers', views: '186K views', age: '5 days ago', duration: '16:53', category: 'Design', avatar: 'F', avatarClass: 'avatar--field', image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=85' },
  ];

  function readStoredArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_error) {
      localStorage.removeItem(key);
      return [];
    }
  }

  function readStoredObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_error) {
      localStorage.removeItem(key);
      return {};
    }
  }

  const state = {
    page: 'Home',
    activeCategory: 'All',
    search: '',
    saved: new Set(readStoredArray('tubeclone.saved')),
    history: readStoredArray('tubeclone.history'),
    liked: new Set(readStoredArray('tubeclone.liked')),
    subscribed: new Set(readStoredArray('tubeclone.subscribed')),
    comments: readStoredObject('tubeclone.comments'),
    commentLikes: readStoredObject('tubeclone.commentLikes'),
    hiddenComments: readStoredObject('tubeclone.hiddenComments'),
    remoteComments: {},
    remoteCommentLikes: {},
    remoteCommentRepliesAvailable: {},
    replyingTo: null,
    playlists: readStoredObject('tubeclone.playlists'),
    profile: readStoredObject('tubeclone.account'),
    notificationsRead: new Set(readStoredArray('tubeclone.notificationsRead')),
    activeVideo: null,
    activeChannel: null,
    activePlaylist: null,
    channelTab: 'Videos',
    supabase: null,
    user: null,
  };

  const initialParams = new URLSearchParams(window.location.search);
  state.search = initialParams.get('search') || '';
  state.activeCategory = categories.includes(initialParams.get('category')) ? initialParams.get('category') : 'All';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    categoryRow: $('#category-row'),
    grid: $('#video-grid'),
    empty: $('#empty-state'),
    searchForm: $('#search-form'),
    searchInput: $('#search-input'),
    sidebar: $('#sidebar'),
    toast: $('#toast'),
    watchModal: $('#watch-modal'),
    watchPage: $('#watch-page'),
    channelPage: $('#channel-page'),
    playlistsPage: $('#playlists-page'),
    studioPage: $('#studio-page'),
    notificationsPanel: $('#notifications-panel'),
    notificationsList: $('#notifications-list'),
    accountDrawer: $('#account-drawer'),
    accountDrawerBackdrop: $('#account-drawer-backdrop'),
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : videos[0].image;
    } catch (_error) {
      return videos[0].image;
    }
  }

  function safeMediaUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_error) {
      return '';
    }
  }

  function normalizeSupabaseUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value).trim());
      url.hash = '';
      url.search = '';
      // Users sometimes paste the REST endpoint from Supabase instead of the
      // project URL. The JS client adds /rest/v1 and /auth/v1 itself.
      url.pathname = url.pathname.replace(/\/(?:rest\/v1|auth\/v1)\/?$/i, '');
      return url.toString().replace(/\/$/, '');
    } catch (_error) {
      return String(value).trim().replace(/\/(?:rest\/v1|auth\/v1)\/?$/i, '').replace(/\/$/, '');
    }
  }

  function saveState() {
    localStorage.setItem('tubeclone.saved', JSON.stringify([...state.saved]));
    localStorage.setItem('tubeclone.history', JSON.stringify(state.history.slice(0, 20)));
    localStorage.setItem('tubeclone.liked', JSON.stringify([...state.liked]));
    localStorage.setItem('tubeclone.subscribed', JSON.stringify([...state.subscribed]));
    localStorage.setItem('tubeclone.comments', JSON.stringify(state.comments));
    localStorage.setItem('tubeclone.commentLikes', JSON.stringify(state.commentLikes));
    localStorage.setItem('tubeclone.hiddenComments', JSON.stringify(state.hiddenComments));
    localStorage.setItem('tubeclone.playlists', JSON.stringify(state.playlists));
    localStorage.setItem('tubeclone.notificationsRead', JSON.stringify([...state.notificationsRead]));
  }

  function isSubscribed(video) {
    return state.subscribed.has(video.channel) || Boolean(video.ownerId && state.subscribed.has(video.ownerId));
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = Math.floor(total % 60).toString().padStart(2, '0');
    return hours ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds}` : `${minutes}:${remainingSeconds}`;
  }

  function formatViews(views) {
    return `${Number(views || 0).toLocaleString()} views`;
  }

  function formatAge(dateString) {
    if (!dateString) return '';
    const timestamp = new Date(dateString).getTime();
    if (Number.isNaN(timestamp)) return '';
    const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
    if (days < 1) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }

  function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
  }

  async function syncSaved(videoId) {
    if (!state.supabase || !state.user || !videoId || !videoId.match(/^[0-9a-f-]{20,}$/i)) return;
    const query = state.supabase.from('saved_videos');
    const result = state.saved.has(videoId)
      ? await query.upsert({ user_id: state.user.id, video_id: videoId })
      : await query.delete().eq('user_id', state.user.id).eq('video_id', videoId);
    if (result.error) console.warn('Could not sync saved video:', result.error.message);
  }

  async function syncLike(videoId) {
    if (!state.supabase || !state.user || !videoId || !videoId.match(/^[0-9a-f-]{20,}$/i)) return;
    const query = state.supabase.from('video_likes');
    const result = state.liked.has(videoId)
      ? await query.upsert({ user_id: state.user.id, video_id: videoId })
      : await query.delete().eq('user_id', state.user.id).eq('video_id', videoId);
    if (result.error) console.warn('Could not sync like:', result.error.message);
  }

  async function syncHistory(videoId) {
    if (!state.supabase || !state.user || !videoId || !videoId.match(/^[0-9a-f-]{20,}$/i)) return;
    const result = await state.supabase.from('watch_history').upsert({ user_id: state.user.id, video_id: videoId, watched_at: new Date().toISOString() });
    if (result.error) console.warn('Could not sync watch history:', result.error.message);
  }

  async function syncSubscription(video, subscribed) {
    if (!state.supabase || !state.user || !video?.ownerId || video.ownerId === state.user.id) return;
    const query = state.supabase.from('subscriptions');
    const result = subscribed
      ? await query.upsert({ subscriber_id: state.user.id, channel_id: video.ownerId })
      : await query.delete().eq('subscriber_id', state.user.id).eq('channel_id', video.ownerId);
    if (result.error) console.warn('Could not sync subscription:', result.error.message);
  }

  async function loadUserState() {
    if (!state.supabase || !state.user) return;
    const [savedResult, likedResult, subscriptionsResult, historyResult] = await Promise.all([
      state.supabase.from('saved_videos').select('video_id').eq('user_id', state.user.id),
      state.supabase.from('video_likes').select('video_id').eq('user_id', state.user.id),
      state.supabase.from('subscriptions').select('channel_id').eq('subscriber_id', state.user.id),
      state.supabase.from('watch_history').select('video_id, watched_at').eq('user_id', state.user.id).order('watched_at', { ascending: false }).limit(20),
    ]);
    if (!savedResult.error) savedResult.data.forEach((row) => state.saved.add(row.video_id));
    if (!likedResult.error) likedResult.data.forEach((row) => state.liked.add(row.video_id));
    if (!subscriptionsResult.error) subscriptionsResult.data.forEach((row) => state.subscribed.add(row.channel_id));
    if (!historyResult.error) state.history = historyResult.data.map((row) => row.video_id);
    saveState();
    renderCards();
  }

  async function loadSupabaseFeed() {
    if (!state.supabase) return;
    const { data, error } = await state.supabase
      .from('videos')
      // The optional media_type column may not exist in older projects.
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(48);
    if (error) {
      console.warn('Could not load Supabase videos; keeping the demo feed:', error.message);
      return;
    }
    if (!data?.length) return;

    const ownerIds = [...new Set(data.map((row) => row.owner_id).filter(Boolean))];
    let profiles = [];
    if (ownerIds.length) {
      const profileResult = await state.supabase.from('profiles').select('id, display_name, avatar_url').in('id', ownerIds);
      if (!profileResult.error) profiles = profileResult.data || [];
    }
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const remoteVideos = data.map((row) => {
      const profile = profileMap.get(row.owner_id);
      const channel = profile?.display_name || 'Creator';
      return {
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        description: row.description || '',
        channel,
        subscribers: 'Supabase channel',
        views: formatViews(row.views),
        age: formatAge(row.created_at),
        duration: formatDuration(row.duration_seconds),
        category: categories.includes(row.category) ? row.category : 'All',
        avatar: channel.slice(0, 1).toUpperCase(),
        avatarClass: 'avatar--remote',
        image: safeImageUrl(row.thumbnail_url || videos[0].image),
        videoUrl: safeMediaUrl(row.video_url),
        mediaType: window.TubeVideoRecords.mediaTypeFor(row),
      };
    });
    videos.splice(0, videos.length, ...remoteVideos);
    renderCards();
    openLocationRoute();
    showToast('Loaded videos from Supabase');
  }

  function openLocationRoute() {
    if (window.location.hash === '#upload') {
      window.location.replace('upload.html');
      return;
    }
    const match = window.location.hash.match(/^#watch=(.+)$/);
    if (!match) return;
    const videoId = decodeURIComponent(match[1]);
    if (videos.some((video) => video.id === videoId)) openWatch(videoId);
  }

  let toastTimer;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('toast--visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('toast--visible'), 2800);
  }

  function renderNotifications() {
    if (!els.notificationsList) return;
    const unread = notificationItems.filter((item) => !state.notificationsRead.has(item.id));
    const dot = $('#notification-dot');
    if (dot) dot.hidden = unread.length === 0;
    els.notificationsList.innerHTML = notificationItems.length
      ? notificationItems.map((item) => `<button class="notification-item ${state.notificationsRead.has(item.id) ? '' : 'notification-item--unread'}" type="button" data-notification-id="${escapeHtml(item.id)}"><span class="avatar ${item.avatarClass}">${escapeHtml(item.avatar)}</span><span class="notification-item__copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span><small>${escapeHtml(item.time)}</small></span></button>`).join('')
      : '<p class="notifications-empty">You are all caught up.</p>';
  }

  function toggleNotifications() {
    const open = els.notificationsPanel.hidden;
    els.notificationsPanel.hidden = !open;
    $('[data-action="toggle-notifications"]')?.setAttribute('aria-expanded', String(open));
    if (open) renderNotifications();
  }

  function closeNotifications() {
    if (!els.notificationsPanel) return;
    els.notificationsPanel.hidden = true;
    $('[data-action="toggle-notifications"]')?.setAttribute('aria-expanded', 'false');
  }

  function updateAccountDrawer() {
    if (!els.accountDrawer) return;
    const displayName = state.profile.displayName || state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'A';
    const avatar = $('#drawer-avatar');
    avatar.textContent = state.profile.avatarUrl ? '' : displayName.slice(0, 1).toUpperCase();
    avatar.style.backgroundImage = state.profile.avatarUrl ? `url("${state.profile.avatarUrl.replace(/"/g, '%22')}")` : '';
    avatar.style.backgroundSize = state.profile.avatarUrl ? 'cover' : '';
    avatar.style.backgroundPosition = state.profile.avatarUrl ? 'center' : '';
    $('#drawer-name').textContent = state.profile.displayName || state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'Welcome';
    $('#drawer-email').textContent = state.user?.email || 'Sign in to customize your account';
    $('#drawer-auth-button').textContent = state.user ? 'Sign out' : 'Sign in';
    const adminItem = $('#admin-drawer-item');
    if (adminItem) adminItem.hidden = !isAdminUser();
  }

  function isAdminUser(user = state.user) {
    return Boolean(user?.email && editorEmails.has(user.email.toLowerCase()));
  }

  function openAccountDrawer() {
    updateAccountDrawer();
    els.accountDrawer.classList.add('account-drawer--open');
    els.accountDrawer.setAttribute('aria-hidden', 'false');
    els.accountDrawerBackdrop.hidden = false;
  }

  function closeAccountDrawer() {
    els.accountDrawer.classList.remove('account-drawer--open');
    els.accountDrawer.setAttribute('aria-hidden', 'true');
    els.accountDrawerBackdrop.hidden = true;
  }

  function initSupabase() {
    const config = window.SUPABASE_CONFIG || {};
    const rawUrl = localStorage.getItem('tubeclone.supabase.url') || config.url;
    const url = normalizeSupabaseUrl(rawUrl);
    const anonKey = localStorage.getItem('tubeclone.supabase.anonKey') || config.anonKey;
    if (!url || !anonKey || !window.supabase?.createClient) return;
    try {
      if (rawUrl !== url) localStorage.setItem('tubeclone.supabase.url', url);
      state.supabase = window.supabase.createClient(url, anonKey);
      let sessionChanged = false;
      state.supabase.auth.onAuthStateChange((_event, session) => {
        sessionChanged = true;
        state.user = session?.user || null;
        updateAccountButton();
        updateAccountDrawer();
        // Run database requests outside the SDK's auth callback lock.
        setTimeout(() => loadUserState().catch(() => showToast('Could not sync your library')), 0);
      });
      state.supabase.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        if (sessionChanged) return;
        state.user = data.session?.user || null;
        updateAccountButton();
        updateAccountDrawer();
        return loadUserState();
      }).catch(() => showToast('Could not restore your session. Please sign in again.'));
      loadSupabaseFeed();
    } catch (error) {
      console.warn('Supabase could not initialize:', error);
    }
  }

  function updateAccountButton() {
    const button = $('.avatar--small');
    if (!button) return;
    const displayName = state.profile.displayName || state.user?.email?.split('@')[0] || 'A';
    button.textContent = state.profile.avatarUrl ? '' : displayName.slice(0, 1).toUpperCase();
    button.style.backgroundImage = state.profile.avatarUrl ? `url("${state.profile.avatarUrl.replace(/"/g, '%22')}")` : '';
    button.style.backgroundSize = state.profile.avatarUrl ? 'cover' : '';
    button.style.backgroundPosition = state.profile.avatarUrl ? 'center' : '';
    button.title = state.user ? `Signed in as ${state.user.email}` : 'Open account';
  }

  function renderCategories() {
    els.categoryRow.innerHTML = categories.map((category) => `<button class="category-button ${state.activeCategory === category ? 'category-button--active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
  }

  function renderHero() {
    const banner = $('#hero-banner');
    if (!banner) return;
    const category = state.activeCategory !== 'All' && heroSpots[state.activeCategory] ? state.activeCategory : 'Music';
    const spot = heroSpots[category];
    banner.dataset.heroCategory = category;
    $('#hero-eyebrow').textContent = spot.eyebrow;
    $('#hero-title').textContent = spot.title;
    $('#hero-emphasis').textContent = spot.emphasis;
    $('#hero-description').textContent = spot.description;
    $('#hero-action-label').textContent = spot.action;
  }

  const pageCopy = {
    Home: { overline: 'Recommended for you', title: 'Fresh picks', emptyTitle: 'No videos found', emptyCopy: 'Try a different search term or category.' },
    History: { overline: 'Your activity', title: 'Watch history', emptyTitle: 'Your watch history is empty', emptyCopy: 'Open a video and it will appear here.' },
    'Watch later': { overline: 'Saved for another time', title: 'Watch later', emptyTitle: 'Nothing saved yet', emptyCopy: 'Use the bookmark button on a video to save it here.' },
    'Liked videos': { overline: 'Your favorites', title: 'Liked videos', emptyTitle: 'No liked videos yet', emptyCopy: 'Like a video and it will appear here.' },
    Subscriptions: { overline: 'From channels you follow', title: 'Subscriptions', emptyTitle: 'No subscription videos yet', emptyCopy: 'Subscribe to a channel while watching a video.' },
    Playlists: { overline: 'Your library', title: 'Playlists', emptyTitle: 'No playlists yet', emptyCopy: 'Create a playlist to organize your favorite videos.' },
    'Creator Studio': { overline: 'Creator tools', title: 'Creator Studio', emptyTitle: 'No uploaded videos yet', emptyCopy: 'Upload your first video to start your channel.' },
  };

  function setActiveNav(page) {
    $$('.nav-item').forEach((item) => item.classList.toggle('nav-item--active', item.dataset.nav === page));
  }

  function setActiveMobileNav(page) {
    const mobilePage = page === 'History' || page === 'Playlists' || page === 'Watch later' || page === 'Liked videos' ? 'Playlists' : page;
    $$('[data-mobile-nav]').forEach((item) => item.classList.toggle('mobile-bottom-nav__item--active', item.dataset.mobileNav === mobilePage));
  }

  function setPage(page) {
    state.page = pageCopy[page] ? page : 'Home';
    state.search = '';
    state.activeCategory = 'All';
    if (state.page === 'Playlists') state.activePlaylist = null;
    els.searchInput.value = '';
    setActiveNav(state.page);
    setActiveMobileNav(state.page);
    renderCategories();
    renderCards();
    if (state.page !== 'Watch') window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth <= 540) els.sidebar.classList.remove('sidebar--open');
  }

  function visibleVideos() {
    const query = state.search.trim().toLowerCase();
    let pageVideos = videos;
    if (state.page === 'History') {
      pageVideos = state.history.map((id) => videos.find((video) => video.id === id)).filter(Boolean);
    } else if (state.page === 'Watch later') {
      pageVideos = videos.filter((video) => state.saved.has(video.id));
    } else if (state.page === 'Liked videos') {
      pageVideos = videos.filter((video) => state.liked.has(video.id));
    } else if (state.page === 'Subscriptions') {
      pageVideos = videos.filter((video) => isSubscribed(video));
    }
    return pageVideos.filter((video) => {
      const categoryMatch = state.activeCategory === 'All' || video.category === state.activeCategory;
      const searchMatch = !query || [video.title, video.channel, video.category].join(' ').toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }

  function videoCardMarkup(video, index) {
    return `
      <article class="video-card" style="animation-delay:${Math.min(index * 35, 240)}ms" data-video-id="${escapeHtml(video.id)}">
        <div class="video-card__thumbnail">
          <img src="${escapeHtml(safeImageUrl(video.image))}" alt="" loading="lazy" />
          <span class="video-card__duration">${escapeHtml(video.duration)}</span>
          <button class="video-card__bookmark ${state.saved.has(video.id) ? 'video-card__bookmark--saved' : ''}" type="button" data-action="save" data-video-id="${escapeHtml(video.id)}" aria-label="${state.saved.has(video.id) ? 'Remove from Watch later' : 'Save to Watch later'}">${state.saved.has(video.id) ? '✓' : '▱'}</button>
        </div>
        <div class="video-card__details">
          <span class="avatar ${video.avatarClass}">${escapeHtml(video.avatar)}</span>
          <div class="video-card__info">
            <h3 class="video-card__title">${escapeHtml(video.title)}</h3>
            <span class="video-card__channel">${escapeHtml(video.channel)}</span>
            <span class="video-card__meta">${escapeHtml(video.views)}${video.age ? ` • ${escapeHtml(video.age)}` : ''}</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderCards() {
    const visible = visibleVideos();
    const copy = pageCopy[state.page] || pageCopy.Home;
    const isHome = state.page === 'Home';
    if (state.page !== 'Watch') {
      const pageMedia = $('#watch-page-player')?.querySelector('video');
      if (pageMedia) pageMedia.pause();
      $('#watch-page-player')?.replaceChildren();
      $('#watch-page-player')?.classList.remove('watch-player--video');
    }
    $('#hero-banner')?.toggleAttribute('hidden', !isHome || Boolean(state.search));
    renderHero();
    $('#feed-section')?.toggleAttribute('hidden', ['Watch', 'Channel', 'Playlists', 'Creator Studio'].includes(state.page));
    els.watchPage.hidden = state.page !== 'Watch';
    els.channelPage.hidden = state.page !== 'Channel';
    els.playlistsPage.hidden = state.page !== 'Playlists';
    els.studioPage.hidden = state.page !== 'Creator Studio';
    els.categoryRow.hidden = !isHome;
    $('#feed-title').textContent = state.search ? `Results for “${state.search}”` : state.activeCategory === 'All' ? copy.title : state.activeCategory;
    $('#feed-overline').textContent = state.search ? `${visible.length} ${visible.length === 1 ? 'video' : 'videos'} found` : state.activeCategory === 'All' ? copy.overline : 'Curated for you';
    els.empty.hidden = visible.length > 0;
    $('#empty-state h3').textContent = state.search ? 'No videos found' : copy.emptyTitle;
    $('#empty-state p').textContent = state.search ? 'Try a different search term or category.' : copy.emptyCopy;
    els.grid.innerHTML = visible.map(videoCardMarkup).join('');
    if (state.page === 'Watch' && state.activeVideo) renderWatchPage(state.activeVideo);
    if (state.page === 'Channel' && state.activeChannel) renderChannelPage(state.activeChannel);
    if (state.page === 'Playlists') renderPlaylistsPage();
    if (state.page === 'Creator Studio') renderStudioPage();
  }

  function renderPlayer(player, video) {
    player.replaceChildren();
    player.style.backgroundImage = '';
    const mediaType = String(video.mediaType || 'video/mp4').toLowerCase();
    player.classList.toggle('watch-player--video', Boolean(video.videoUrl && (mediaType.startsWith('video/') || mediaType.startsWith('audio/'))));
    if (video.videoUrl && (mediaType.startsWith('video/') || mediaType.startsWith('audio/'))) {
      const media = document.createElement('video');
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.poster = safeImageUrl(video.image);
      media.src = safeMediaUrl(video.videoUrl);
      player.append(media);
      return;
    }
    if (video.videoUrl && mediaType.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = safeImageUrl(video.videoUrl);
      image.alt = video.title || 'Uploaded image';
      player.append(image);
      return;
    }
    if (video.videoUrl) {
      const download = document.createElement('a');
      download.className = 'watch-player__download';
      download.href = safeMediaUrl(video.videoUrl);
      download.target = '_blank';
      download.rel = 'noreferrer';
      download.download = '';
      download.textContent = `Open or download ${video.title || 'this file'}`;
      player.append(download);
      return;
    }
    player.style.backgroundImage = `linear-gradient(120deg, rgba(11, 19, 22, .15), rgba(24, 11, 21, .32)), url("${safeImageUrl(video.image).replace(/"/g, '%22')}")`;
  }

  function renderWatchPlayer(video) {
    renderPlayer($('#watch-player'), video);
  }

  function relativeCommentTime(timestamp) {
    const elapsed = Math.max(0, Date.now() - new Date(timestamp).getTime());
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function commentsFor(videoId) {
    return Array.isArray(state.comments[videoId]) ? state.comments[videoId] : [];
  }

  async function loadRemoteComments(video) {
    if (!state.supabase || !video || !isUuid(video.id)) return false;
    let result = await state.supabase.from('comments').select('id, video_id, user_id, parent_id, body, pinned, created_at').eq('video_id', video.id).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    let repliesAvailable = true;
    if (result.error && /parent_id|column|schema cache/i.test(result.error.message || '')) {
      repliesAvailable = false;
      result = await state.supabase.from('comments').select('id, video_id, user_id, body, pinned, created_at').eq('video_id', video.id).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    }
    if (result.error) return false;
    state.remoteCommentRepliesAvailable[video.id] = repliesAvailable;
    const rows = result.data || [];
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    let profiles = [];
    if (userIds.length) {
      const profileResult = await state.supabase.from('profiles').select('id, display_name, username').in('id', userIds);
      if (!profileResult.error) profiles = profileResult.data || [];
    }
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const likeResult = rows.length ? await state.supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', rows.map((row) => row.id)) : { data: [], error: null };
    const likeRows = likeResult.error ? [] : (likeResult.data || []);
    state.remoteCommentLikes[video.id] = likeRows;
    state.remoteComments[video.id] = rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      const likes = likeRows.filter((like) => like.comment_id === row.id);
      return { id: row.id, text: row.body, author: profile?.display_name || profile?.username || 'Viewer', createdAt: row.created_at, pinned: row.pinned, parentId: row.parent_id || null, userId: row.user_id, likes: likes.length, liked: likes.some((like) => like.user_id === state.user?.id), remote: true };
    });
    return true;
  }

  function activeCommentsFor(video) {
    return Array.isArray(state.remoteComments[video.id]) ? state.remoteComments[video.id] : commentsFor(video.id);
  }

  function hiddenCommentsKey(videoId) {
    return `${state.user?.id || 'viewer'}:${videoId}`;
  }

  function commentsAreHidden(videoId) {
    return Boolean(state.hiddenComments[hiddenCommentsKey(videoId)]);
  }

  function canManageCurrentVideo() {
    const email = state.user?.email?.toLowerCase();
    return Boolean(state.user && state.activeVideo && (state.activeVideo.ownerId === state.user.id || editorEmails.has(email)));
  }

  function canDeleteComment(comment) {
    return Boolean(state.user && comment && (comment.userId === state.user.id || canManageCurrentVideo()));
  }

  function commentTree(comments) {
    const children = new Map();
    comments.forEach((comment) => {
      const parentId = comment.parentId || null;
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId).push(comment);
    });
    const build = (comment, depth = 0, seen = new Set()) => {
      if (depth >= 4 || seen.has(comment.id)) return { ...comment, replies: [] };
      const nextSeen = new Set(seen).add(comment.id);
      return { ...comment, replies: (children.get(comment.id) || []).map((child) => build(child, depth + 1, nextSeen)) };
    };
    return (children.get(null) || comments.filter((comment) => !comment.parentId)).map((comment) => build(comment));
  }

  function renderReplyState() {
    const banner = $('#comment-replying');
    if (!banner) return;
    const commentsHidden = Boolean(state.activeVideo && commentsAreHidden(state.activeVideo.id));
    banner.hidden = commentsHidden || !state.replyingTo;
    if (state.replyingTo) $('#comment-replying-text').textContent = `Replying to ${state.replyingTo.author || 'this comment'}`;
    $('#comment-input').placeholder = state.replyingTo ? 'Write a reply...' : 'Add a comment...';
    $('#comment-form').hidden = commentsHidden;
    $('#comments-list').hidden = commentsHidden;
    const toggle = $('#comments-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!commentsHidden));
      toggle.innerHTML = `<span>${commentsHidden ? 'Show comments' : 'Hide comments'}</span><b aria-hidden="true">${commentsHidden ? '⌄' : '⌃'}</b>`;
    }
  }

  function renderComments(video) {
    const comments = activeCommentsFor(video);
    $('#comments-count').textContent = comments.length;
    const localLikeIds = Array.isArray(state.commentLikes[video.id]) ? state.commentLikes[video.id] : [];
    const nestedComments = commentTree(comments);
    const renderComment = (comment, depth = 0) => `
      <article class="comment-item ${depth ? 'comment-item--reply' : ''}">
        <span class="avatar avatar--comment">${escapeHtml(comment.author?.slice(0, 1).toUpperCase() || 'A')}</span>
        <div class="comment-item__body">
          <div class="comment-item__meta"><strong>${escapeHtml(comment.author || 'Viewer')}</strong><span>${escapeHtml(relativeCommentTime(comment.createdAt))}</span></div>
          <p>${escapeHtml(comment.text)}</p>
          <div class="comment-item__tools"><button type="button" data-action="reply-comment" data-comment-id="${escapeHtml(comment.id)}">↩ Reply</button><button type="button" data-action="like-comment" data-comment-id="${escapeHtml(comment.id)}">♡ ${comment.liked || localLikeIds.includes(comment.id) ? 'Liked' : 'Like'} ${comment.likes ?? (localLikeIds.includes(comment.id) ? '1' : '0')}</button>${comment.pinned ? '<span class="comment-pin">📌 Pinned</span>' : ''}${canManageCurrentVideo() ? `<button type="button" data-action="pin-comment" data-comment-id="${escapeHtml(comment.id)}">${comment.pinned ? 'Unpin' : 'Pin'}</button>` : ''}${canDeleteComment(comment) ? '<button class="comment-delete" type="button" data-action="delete-comment" data-comment-id="' + escapeHtml(comment.id) + '">Delete</button>' : ''}</div>
          ${comment.replies?.length ? `<div class="comment-replies">${comment.replies.map((reply) => renderComment(reply, depth + 1)).join('')}</div>` : ''}
        </div>
      </article>`;
    $('#comments-list').innerHTML = comments.length
      ? nestedComments.map((comment) => renderComment(comment)).join('')
      : '<p class="comments-empty">Be the first to comment.</p>';
    renderReplyState();
  }

  function renderWatchPage(video) {
    if (!video || !els.watchPage) return;
    renderPlayer($('#watch-page-player'), video);
    $('#watch-page-category').textContent = video.category;
    $('#watch-page-title').textContent = video.title;
    $('#watch-page-meta').textContent = `${video.views}${video.age ? ` • ${video.age}` : ''} • ${video.duration}`;
    $('#watch-page-description').textContent = video.description || '';
    $('#watch-page-description').hidden = !video.description;
    $('#watch-page-avatar').textContent = video.avatar;
    $('#watch-page-avatar').className = `avatar ${video.avatarClass}`;
    $('#watch-page-channel-name').textContent = video.channel;
    $('#watch-page-subs').textContent = video.subscribers;
    $('#watch-page-like-label').textContent = state.liked.has(video.id) ? 'Liked' : 'Like';
    $('#watch-page-like-button')?.classList.toggle('pill-button--active', state.liked.has(video.id));
    $('#watch-modal-like-button')?.classList.toggle('pill-button--active', state.liked.has(video.id));
    $('#watch-page-save-label').textContent = state.saved.has(video.id) ? 'Saved' : 'Save';
    $('#watch-page-save-button')?.classList.toggle('pill-button--active', state.saved.has(video.id));
    $('#watch-modal-save-label').textContent = state.saved.has(video.id) ? 'Saved' : 'Save';
    $('#watch-modal-save-button')?.classList.toggle('pill-button--active', state.saved.has(video.id));
    $('#watch-page-subscribe-button').textContent = isSubscribed(video) ? 'Subscribed' : 'Subscribe';
    $('#watch-page-subscribe-button').classList.toggle('subscribe-button--subscribed', isSubscribed(video));
    renderPlaylistOptions();
    const management = $('#watch-page-management');
    const isOwner = Boolean(state.user && video.ownerId === state.user.id);
    const isAdmin = isAdminUser();
    if (management) {
      management.hidden = !(isOwner || isAdmin);
      management.innerHTML = isAdmin
        ? `<a class="watch-management__link" href="admin.html?video=${encodeURIComponent(video.id)}#videos">◆ Delete / manage in Admin Dashboard</a>`
        : `<a class="watch-management__link" href="studio.html?video=${encodeURIComponent(video.id)}">✦ Delete / manage in Creator Studio</a>`;
    }
    renderComments(video);
    const recommendations = videos.filter((item) => item.id !== video.id).slice(0, 5);
    $('#watch-recommendations').innerHTML = recommendations.map((item) => `
      <button class="recommendation-card" type="button" data-video-id="${escapeHtml(item.id)}">
        <span class="recommendation-card__thumb"><img src="${escapeHtml(safeImageUrl(item.image))}" alt="" loading="lazy" /><b>${escapeHtml(item.duration)}</b></span>
        <span class="recommendation-card__copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.channel)} • ${escapeHtml(item.views)}</small></span>
      </button>
    `).join('');
  }

  function renderChannelPage(channel) {
    if (!channel || !els.channelPage) return;
    const channelVideos = videos.filter((video) => video.channel === channel.channel || (channel.ownerId && video.ownerId === channel.ownerId));
    const channelName = channel.channel || 'Creator';
    $('#channel-page-avatar').textContent = channel.avatar || channelName.slice(0, 1).toUpperCase();
    $('#channel-page-avatar').className = `avatar channel-header__avatar ${channel.avatarClass || ''}`;
    $('#channel-page-name').textContent = channelName;
    $('#channel-page-meta').textContent = `${channel.subscribers || 'Creator channel'} • ${channelVideos.length} ${channelVideos.length === 1 ? 'video' : 'videos'}`;
    const subscribed = isSubscribed(channel);
    $('#channel-page-subscribe').textContent = subscribed ? 'Subscribed' : 'Subscribe';
    $('#channel-page-subscribe').classList.toggle('subscribe-button--subscribed', subscribed);
    const content = $('#channel-content');
    if (state.channelTab === 'About') {
      content.innerHTML = `<div class="channel-about"><p class="section-heading__overline">About this channel</p><h2>${escapeHtml(channelName)}</h2><p>Discover videos from ${escapeHtml(channelName)}. This channel page is ready to connect to your Supabase profile and creator metadata.</p></div>`;
      return;
    }
    content.innerHTML = channelVideos.length
      ? `<div class="video-grid">${channelVideos.map(videoCardMarkup).join('')}</div>`
      : '<div class="empty-state"><div class="empty-state__icon">◉</div><h3>No public videos yet</h3><p>This creator has not published a video.</p></div>';
  }

  function playlistEntries() {
    return Object.values(state.playlists).filter((playlist) => playlist && playlist.id && playlist.name);
  }

  function renderPlaylistOptions() {
    const select = $('#watch-playlist-select');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Add to playlist</option>' + playlistEntries().map((playlist) => `<option value="${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)}</option>`).join('');
    if (playlistEntries().some((playlist) => playlist.id === current)) select.value = current;
  }

  function renderPlaylistsPage() {
    const content = $('#playlist-content');
    if (!content) return;
    const playlists = playlistEntries();
    if (state.activePlaylist) {
      const playlist = state.playlists[state.activePlaylist];
      if (!playlist) { state.activePlaylist = null; return renderPlaylistsPage(); }
      const playlistVideos = (playlist.videoIds || []).map((id) => videos.find((video) => video.id === id)).filter(Boolean);
      content.innerHTML = `
        <div class="playlist-detail__header">
          <button class="text-button" type="button" data-action="back-playlists">← All playlists</button>
          <h2>${escapeHtml(playlist.name)}</h2><span>${playlistVideos.length} videos • ${escapeHtml(playlist.privacy || 'private')}</span>
        </div>
        ${playlistVideos.length ? `<div class="video-grid">${playlistVideos.map(videoCardMarkup).join('')}</div>` : '<div class="playlist-detail__empty"><strong>This playlist is empty</strong><span>Open a video and use “Add to playlist” to put it here.</span></div>'}
      `;
      return;
    }
    if (!playlists.length) {
      content.innerHTML = '<div class="playlist-detail__empty"><strong>Create your first playlist</strong><span>Use the form above, then add videos from the watch page.</span></div>';
      return;
    }
    content.innerHTML = `<div class="playlist-grid">${playlists.map((playlist) => {
      const playlistVideos = (playlist.videoIds || []).map((id) => videos.find((video) => video.id === id)).filter(Boolean).slice(0, 4);
      const images = playlistVideos.length ? playlistVideos : videos.slice(0, 2);
      return `<button class="playlist-card" type="button" data-playlist-id="${escapeHtml(playlist.id)}"><span class="playlist-card__thumb">${images.slice(0, 4).map((video) => `<img src="${escapeHtml(safeImageUrl(video.image))}" alt="" loading="lazy" />`).join('')}</span><span class="playlist-card__copy"><strong>${escapeHtml(playlist.name)}</strong><span>${(playlist.videoIds || []).length} videos • ${escapeHtml(playlist.privacy || 'private')}</span></span></button>`;
    }).join('')}</div>`;
  }

  function renderStudioPage() {
    const ownedVideos = state.user ? videos.filter((video) => video.ownerId === state.user.id) : [];
    const totalViews = ownedVideos.reduce((sum, video) => sum + (Number.parseInt(String(video.views).replace(/[^0-9]/g, ''), 10) || 0), 0);
    $('#studio-stats').innerHTML = `<div class="studio-stat"><span>Videos</span><strong>${ownedVideos.length}</strong></div><div class="studio-stat"><span>Total views</span><strong>${totalViews.toLocaleString()}</strong></div><div class="studio-stat"><span>Status</span><strong>${state.user ? 'Ready' : 'Sign in'}</strong></div>`;
    const list = $('#studio-video-list');
    if (!state.user) {
      list.innerHTML = '<div class="playlist-detail__empty"><strong>Sign in to manage your channel</strong><span>Your uploaded videos and stats will appear here.</span></div>';
      return;
    }
    if (!ownedVideos.length) {
      list.innerHTML = '<div class="playlist-detail__empty"><strong>No uploaded videos yet</strong><span>Use “Upload video” to publish your first public video.</span></div>';
      return;
    }
    list.innerHTML = ownedVideos.map((video) => `<div class="studio-video-row"><span class="studio-video-row__thumb"><img src="${escapeHtml(safeImageUrl(video.image))}" alt="" loading="lazy" /></span><span class="studio-video-row__copy"><strong>${escapeHtml(video.title)}</strong><span>${escapeHtml(video.views)} • ${escapeHtml(video.age || 'recently uploaded')}</span></span><button class="studio-video-row__action" type="button" data-video-id="${escapeHtml(video.id)}">Open</button></div>`).join('');
  }

  function openChannel(videoOrChannel) {
    const channel = typeof videoOrChannel === 'string'
      ? videos.find((video) => video.channel === videoOrChannel)
      : videoOrChannel;
    if (!channel) return;
    state.page = 'Channel';
    state.activeChannel = channel;
    state.channelTab = 'Videos';
    setActiveNav(null);
    setActiveMobileNav(null);
    $$('.channel-tab').forEach((tab) => tab.classList.toggle('channel-tab--active', tab.dataset.channelTab === 'Videos'));
    renderCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openWatch(videoId) {
    const video = videos.find((item) => item.id === videoId);
    if (!video) return;
    state.activeVideo = video;
    state.replyingTo = null;
    state.history = [video.id, ...state.history.filter((id) => id !== video.id)].slice(0, 20);
    saveState();
    state.page = 'Watch';
    setActiveNav(null);
    setActiveMobileNav(null);
    renderCards();
    window.history.replaceState(null, '', `#watch=${encodeURIComponent(video.id)}`);
    loadRemoteComments(video).then((loaded) => { if (loaded && state.activeVideo?.id === video.id) renderComments(video); });
    syncHistory(video.id);
  }

  function closeModal(element) {
    if (element === els.watchModal) {
      const media = $('#watch-player')?.querySelector('video');
      if (media) media.pause();
      $('#watch-player')?.replaceChildren();
      $('#watch-player')?.classList.remove('watch-player--video');
    }
    element.hidden = true;
    if (els.watchModal.hidden) document.body.style.overflow = '';
  }

  function toggleSaved(videoId) {
    if (state.saved.has(videoId)) {
      state.saved.delete(videoId);
      showToast('Removed from Watch later');
    } else {
      state.saved.add(videoId);
      showToast('Saved to Watch later');
    }
    saveState();
    renderCards();
    syncSaved(videoId);
  }

  function setCategory(category) {
    state.page = 'Home';
    state.activeCategory = category;
    state.search = '';
    els.searchInput.value = '';
    setActiveNav('Home');
    setActiveMobileNav('Home');
    renderCategories();
    renderCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shuffleFeed() {
    for (let index = videos.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [videos[index], videos[randomIndex]] = [videos[randomIndex], videos[index]];
    }
    renderCards();
    showToast('Your recommendations were refreshed');
  }

  function openAuth() {
    const next = window.TubeAuth.safeNext(window.location.href, window.location.href);
    window.location.assign('login.html?next=' + encodeURIComponent(next));
  }

  async function handleAccount() {
    openAccountDrawer();
  }

  async function handleAction(action, videoId) {
    const active = state.activeVideo;
    if (action === 'save') toggleSaved(videoId);
    if (action === 'close-watch') closeModal(els.watchModal);
    if (action === 'account') handleAccount();
    if (action === 'close-account') closeAccountDrawer();
    if (action === 'drawer-auth') {
      if (state.user && state.supabase) {
        const button = $('#drawer-auth-button');
        if (button.disabled) return;
        button.disabled = true;
        try {
          const result = await state.supabase.auth.signOut();
          if (result.error) throw result.error;
          state.user = null;
          updateAccountButton();
          updateAccountDrawer();
          closeAccountDrawer();
          showToast('You’re signed out');
        } catch (error) { showToast(window.TubeAuth.errorMessage(error)); }
        finally { button.disabled = false; }
      } else {
        closeAccountDrawer();
        openAuth();
      }
    }
    if (action === 'home') setCategory('All');
    if (action === 'back-feed') setPage('Home');
    if (action === 'back-playlists') { state.activePlaylist = null; renderPlaylistsPage(); }
    if (action === 'channel' && active) openChannel(active);
    if (action === 'toggle-sidebar') els.sidebar.classList.toggle('sidebar--open');
    if (action === 'toggle-comments' && active) {
      const key = hiddenCommentsKey(active.id);
      state.hiddenComments[key] = !state.hiddenComments[key];
      if (state.hiddenComments[key]) state.replyingTo = null;
      saveState();
      renderComments(active);
      return;
    }
    if (action === 'reply-comment' && active && videoId) {
      const target = activeCommentsFor(active).find((comment) => comment.id === videoId);
      if (!target) return;
      if (!state.user) { openAuth(); return; }
      if (target.remote && state.remoteCommentRepliesAvailable[active.id] === false) {
        showToast('Run supabase/replies.sql to enable comment replies');
        return;
      }
      state.replyingTo = { id: target.id, author: target.author, remote: target.remote };
      renderReplyState();
      $('#comment-input').focus();
      return;
    }
    if (action === 'cancel-reply') {
      state.replyingTo = null;
      renderReplyState();
      $('#comment-input').focus();
      return;
    }
    if (action === 'refresh') shuffleFeed();
    if (action === 'dismiss-banner') document.querySelector('.hero-banner')?.remove();
    if (action === 'clear-search') { state.search = ''; els.searchInput.value = ''; renderCards(); }
    if (action === 'explore') {
      const category = state.activeCategory !== 'All' && heroSpots[state.activeCategory] ? state.activeCategory : 'Music';
      setCategory(category);
      showToast(`Showing ${category} recommendations`);
    }
    if (action === 'voice-search') showToast('Voice search is ready for the next step');
    if (action === 'create') window.location.href = 'upload.html';
    if (action === 'toggle-notifications') toggleNotifications();
    if (action === 'mark-notifications-read') {
      notificationItems.forEach((item) => state.notificationsRead.add(item.id));
      saveState();
      renderNotifications();
      showToast('Notifications marked as read');
    }
    if (action === 'like-active' && active) {
      state.liked.has(active.id) ? state.liked.delete(active.id) : state.liked.add(active.id);
      $('#like-label').textContent = state.liked.has(active.id) ? 'Liked' : 'Like';
      $('#watch-page-like-label').textContent = state.liked.has(active.id) ? 'Liked' : 'Like';
      $('#watch-modal-like-button')?.classList.toggle('pill-button--active', state.liked.has(active.id));
      $('#watch-page-like-button')?.classList.toggle('pill-button--active', state.liked.has(active.id));
      saveState();
      syncLike(active.id);
      showToast(state.liked.has(active.id) ? 'Added to Liked videos' : 'Removed from Liked videos');
    }
    if (action === 'save-active' && active) toggleSaved(active.id);
    if (action === 'share-active' && active) {
      const shareUrl = window.location.href.split('#')[0] + `#watch=${active.id}`;
      if (!navigator.clipboard?.writeText) {
        showToast('Copy this video link: ' + shareUrl);
      } else {
        navigator.clipboard.writeText(shareUrl).then(() => showToast('Video link copied')).catch(() => showToast('Copy this video link: ' + shareUrl));
      }
    }
    if (action === 'subscribe-active' && active) {
      const subscriptionKey = active.ownerId || active.channel;
      state.subscribed.has(subscriptionKey) ? state.subscribed.delete(subscriptionKey) : state.subscribed.add(subscriptionKey);
      const subscribed = isSubscribed(active);
      $('#subscribe-button').textContent = subscribed ? 'Subscribed' : 'Subscribe';
      $('#subscribe-button').classList.toggle('subscribe-button--subscribed', subscribed);
      $('#watch-page-subscribe-button').textContent = subscribed ? 'Subscribed' : 'Subscribe';
      $('#watch-page-subscribe-button').classList.toggle('subscribe-button--subscribed', subscribed);
      saveState();
      syncSubscription(active, subscribed);
      showToast(subscribed ? `Subscribed to ${active.channel}` : `Unsubscribed from ${active.channel}`);
    }
    if (action === 'subscribe-channel' && state.activeChannel) {
      const channel = state.activeChannel;
      const subscriptionKey = channel.ownerId || channel.channel;
      state.subscribed.has(subscriptionKey) ? state.subscribed.delete(subscriptionKey) : state.subscribed.add(subscriptionKey);
      const subscribed = isSubscribed(channel);
      $('#channel-page-subscribe').textContent = subscribed ? 'Subscribed' : 'Subscribe';
      $('#channel-page-subscribe').classList.toggle('subscribe-button--subscribed', subscribed);
      saveState();
      syncSubscription(channel, subscribed);
      showToast(subscribed ? `Subscribed to ${channel.channel}` : `Unsubscribed from ${channel.channel}`);
    }
    if (action === 'add-playlist-active' && active) {
      const playlistId = $('#watch-playlist-select').value;
      if (!playlistId || !state.playlists[playlistId]) {
        showToast('Create or choose a playlist first');
        return;
      }
      const playlist = state.playlists[playlistId];
      playlist.videoIds = Array.isArray(playlist.videoIds) ? playlist.videoIds : [];
      if (!playlist.videoIds.includes(active.id)) playlist.videoIds.push(active.id);
      saveState();
      renderPlaylistOptions();
      $('#watch-playlist-select').value = playlistId;
      showToast(`Added to ${playlist.name}`);
    }
    if (action === 'like-comment' && active && videoId) {
      const remoteComment = activeCommentsFor(active).find((comment) => comment.id === videoId && comment.remote);
      if (remoteComment && state.supabase && state.user) {
        const result = remoteComment.liked
          ? await state.supabase.from('comment_likes').delete().eq('comment_id', videoId).eq('user_id', state.user.id)
          : await state.supabase.from('comment_likes').insert({ comment_id: videoId, user_id: state.user.id });
        if (result.error) showToast(result.error.message || 'Could not update comment like');
        else { await loadRemoteComments(active); renderComments(active); }
        return;
      }
      const commentId = videoId;
      const likedComments = Array.isArray(state.commentLikes[active.id]) ? state.commentLikes[active.id] : [];
      state.commentLikes[active.id] = likedComments.includes(commentId) ? likedComments.filter((id) => id !== commentId) : [...likedComments, commentId];
      saveState();
      renderComments(active);
    }
    if (action === 'pin-comment' && active && videoId && canManageCurrentVideo()) {
      const remoteComment = activeCommentsFor(active).find((entry) => entry.id === videoId && entry.remote);
      if (remoteComment && state.supabase) {
        const result = await state.supabase.from('comments').update({ pinned: !remoteComment.pinned }).eq('id', videoId);
        if (result.error) showToast(result.error.message || 'Could not update pinned comment');
        else { await loadRemoteComments(active); renderComments(active); showToast(remoteComment.pinned ? 'Comment unpinned' : 'Comment pinned'); }
        return;
      }
      const comment = commentsFor(active.id).find((entry) => entry.id === videoId);
      if (comment) comment.pinned = !comment.pinned;
      saveState();
      renderComments(active);
      showToast(comment?.pinned ? 'Comment pinned' : 'Comment unpinned');
    }
    if (action === 'delete-comment' && active && videoId) {
      const comment = activeCommentsFor(active).find((entry) => entry.id === videoId);
      if (!comment || !canDeleteComment(comment)) {
        showToast('You do not have permission to delete this comment.');
        return;
      }
      if (!window.confirm('Delete this comment and its replies?')) return;
      if (comment.remote && state.supabase) {
        const result = await state.supabase.from('comments').delete().eq('id', videoId);
        if (result.error) {
          showToast(result.error.message || 'Could not delete comment');
          return;
        }
        await loadRemoteComments(active);
        renderComments(active);
        showToast('Comment deleted');
        return;
      }
      const localComments = commentsFor(active.id);
      const removed = new Set([videoId]);
      let changed = true;
      while (changed) {
        changed = false;
        localComments.forEach((entry) => {
          if (entry.parentId && removed.has(entry.parentId) && !removed.has(entry.id)) {
            removed.add(entry.id);
            changed = true;
          }
        });
      }
      state.comments[active.id] = localComments.filter((entry) => !removed.has(entry.id));
      if (state.replyingTo && removed.has(state.replyingTo.id)) state.replyingTo = null;
      saveState();
      renderComments(active);
      showToast('Comment deleted');
    }
  }

  els.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.search = els.searchInput.value;
    state.page = 'Home';
    state.activeCategory = 'All';
    setActiveNav('Home');
    setActiveMobileNav('Home');
    renderCategories();
    renderCards();
  });

  document.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      event.preventDefault();
      handleAction(actionTarget.dataset.action, actionTarget.dataset.videoId || actionTarget.dataset.commentId);
      return;
    }
    const categoryTarget = event.target.closest('[data-category]');
    if (categoryTarget) { setCategory(categoryTarget.dataset.category); return; }
    const channelTab = event.target.closest('[data-channel-tab]');
    if (channelTab && state.page === 'Channel') {
      state.channelTab = channelTab.dataset.channelTab;
      $$('.channel-tab').forEach((tab) => tab.classList.toggle('channel-tab--active', tab === channelTab));
      renderChannelPage(state.activeChannel);
      return;
    }
    const playlistTarget = event.target.closest('[data-playlist-id]');
    if (playlistTarget) {
      state.activePlaylist = playlistTarget.dataset.playlistId;
      renderPlaylistsPage();
      return;
    }
    const notificationTarget = event.target.closest('[data-notification-id]');
    if (notificationTarget) {
      state.notificationsRead.add(notificationTarget.dataset.notificationId);
      saveState();
      renderNotifications();
      showToast('Notification opened');
      return;
    }
    const mobileNavTarget = event.target.closest('[data-mobile-nav]');
    if (mobileNavTarget) {
      const nav = mobileNavTarget.dataset.mobileNav;
      if (nav === 'Shorts') {
        setActiveMobileNav('Shorts');
        showToast('Shorts is ready for the next UI pass');
      } else if (nav === 'Home') setPage('Home');
      else if (nav === 'Subscriptions') setPage('Subscriptions');
      else if (nav === 'Playlists') setPage('Playlists');
      else if (nav === 'Creator Studio') setPage('Creator Studio');
      return;
    }
    const navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      const nav = navTarget.dataset.nav;
      if (nav === 'Home') setPage('Home');
      else if (['History', 'Playlists', 'Creator Studio', 'Watch later', 'Liked videos', 'Subscriptions'].includes(nav)) setPage(nav);
      else if (categories.includes(nav)) setCategory(nav);
      else showToast(`${nav} is ready for the next UI pass`);
      return;
    }
    const card = event.target.closest('[data-video-id]');
    if (card) openWatch(card.dataset.videoId);
  });

  els.watchModal.addEventListener('click', (event) => { if (event.target === els.watchModal) closeModal(els.watchModal); });
  els.accountDrawerBackdrop.addEventListener('click', closeAccountDrawer);
  $('#playlist-create-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#playlist-name').value.trim();
    if (!name) return;
    const id = `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.playlists[id] = { id, name, privacy: $('#playlist-privacy').value, videoIds: [] };
    saveState();
    event.currentTarget.reset();
    renderPlaylistsPage();
    showToast(`Created ${name}`);
  });
  $('#comment-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = $('#comment-input').value.trim();
    if (!text || !state.activeVideo) return;
    if (!state.user) {
      showToast('Sign in to comment');
      openAuth();
      return;
    }
    const reply = state.replyingTo;
    const useRemote = state.supabase && isUuid(state.activeVideo.id) && (!reply || reply.remote);
    if (useRemote) {
      const payload = { video_id: state.activeVideo.id, user_id: state.user.id, body: text };
      if (reply?.id) payload.parent_id = reply.id;
      const result = await state.supabase.from('comments').insert(payload).select('id').single();
      if (!result.error) {
        $('#comment-input').value = '';
        state.replyingTo = null;
        await loadRemoteComments(state.activeVideo);
        renderComments(state.activeVideo);
        showToast(reply ? 'Reply added' : 'Comment added');
        return;
      }
      if (reply && /parent_id|column|schema cache/i.test(result.error.message || '')) {
        showToast('Run supabase/replies.sql to enable comment replies');
        return;
      }
      if (!/relation|table|comments/i.test(result.error.message || '')) {
        showToast(result.error.message || 'Could not add comment');
        return;
      }
    }
    const videoComments = commentsFor(state.activeVideo.id);
    videoComments.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: state.user.id,
      author: state.user.email?.split('@')[0] || 'You',
      text,
      parentId: reply?.id || null,
      createdAt: new Date().toISOString(),
    });
      state.comments[state.activeVideo.id] = videoComments.slice(0, 100);
    saveState();
    state.replyingTo = null;
    $('#comment-input').value = '';
    renderComments(state.activeVideo);
    showToast(reply ? 'Reply added' : 'Comment added');
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeModal(els.watchModal); closeAccountDrawer(); } });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.notifications-wrap')) closeNotifications();
  });

  renderCategories();
  els.searchInput.value = state.search;
  renderCards();
  renderNotifications();
  updateAccountDrawer();
  initSupabase();
  openLocationRoute();
  window.addEventListener('hashchange', openLocationRoute);
})();
