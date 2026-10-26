(function () {
  'use strict';

  const countdown = document.querySelector('#banned-countdown');
  const expiry = document.querySelector('#banned-expiry');
  const reason = document.querySelector('#banned-reason');
  const signout = document.querySelector('#banned-signout');
  let timer;

  function formatRemaining(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`, `${seconds}s`);
    return parts.join(' ');
  }

  function showPermanent(reasonText) {
    document.querySelector('#banned-title').textContent = 'Your account is permanently banned.';
    document.querySelector('#banned-copy').textContent = 'An approved administrator placed a permanent restriction on this account.';
    countdown.textContent = 'Permanent ban';
    expiry.textContent = 'There is no automatic unban time.';
    if (reasonText) reason.textContent = `Reason: ${reasonText}`;
  }

  function showTemporary(until, reasonText) {
    const timestamp = new Date(until).getTime();
    expiry.textContent = `Unban time: ${new Date(timestamp).toLocaleString()}`;
    if (reasonText) reason.textContent = `Reason: ${reasonText}`;
    const tick = () => {
      const remaining = timestamp - Date.now();
      if (remaining <= 0) {
        window.clearInterval(timer);
        countdown.textContent = 'Your ban period has ended. You can sign in again.';
        return;
      }
      countdown.textContent = `${formatRemaining(remaining)} remaining`;
    };
    tick();
    timer = window.setInterval(tick, 1000);
  }

  async function signOut() {
    try {
      const client = window.TubeAuth.createClient({ detectSessionInUrl: false });
      await client.auth.signOut({ scope: 'global' });
    } finally {
      window.location.assign('login.html');
    }
  }

  signout?.addEventListener('click', signOut);
  (async function loadBan() {
    try {
      const client = window.TubeAuth.createClient({ detectSessionInUrl: false });
      const userResult = await client.auth.getUser();
      const user = userResult.data?.user;
      if (userResult.error || !user?.id) return window.location.replace('login.html');
      const result = await client.from('user_bans').select('banned_until, is_permanent, reason').eq('user_id', user.id).maybeSingle();
      if (result.error || !result.data) return window.location.replace('login.html');
      const ban = result.data;
      if (ban.is_permanent) return showPermanent(ban.reason);
      if (!ban.banned_until || new Date(ban.banned_until).getTime() <= Date.now()) return window.location.replace('login.html');
      showTemporary(ban.banned_until, ban.reason);
    } catch (_error) {
      countdown.textContent = 'Ban details are temporarily unavailable.';
    }
  }());
}());
