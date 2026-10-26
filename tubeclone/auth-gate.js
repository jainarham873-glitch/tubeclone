(function () {
  'use strict';
  const root = document.documentElement;
  const login = 'login.html';
  const current = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search}${window.location.hash}`;
  const redirect = () => {
    const next = window.TubeAuth?.safeNext(current, window.location.href) || 'index.html';
    window.location.replace(`${login}?next=${encodeURIComponent(next)}&reason=auth_required`);
  };
  const redirectBanned = () => window.location.replace('banned.html');
  async function activeBan(client, user) {
    try {
      const result = await client.from('user_bans').select('banned_until, is_permanent').eq('user_id', user.id).maybeSingle();
      if (result.error) {
        // Existing projects can keep working until supabase/admin.sql is applied.
        if (/relation|table|column|schema cache/i.test(result.error.message || '')) return null;
        return null;
      }
      const row = result.data;
      if (!row) return null;
      return row.is_permanent || (row.banned_until && new Date(row.banned_until).getTime() > Date.now()) ? row : null;
    } catch (_error) { return null; }
  }
  root.classList.add('auth-gate-pending');
  window.TubeAuthGate = window.TubeAuthGate || {};
  window.TubeAuthGate.ready = (async () => {
    try {
      if (!window.TubeAuth) throw new Error('Authentication service unavailable.');
      const client = window.TubeAuth.createClient({ detectSessionInUrl: false });
      const result = await client.auth.getUser();
       if (result.error || !result.data?.user?.id) { redirect(); return null; }
       if (await activeBan(client, result.data.user)) { redirectBanned(); return null; }
      window.TubeAuthGate.client = client;
      window.TubeAuthGate.user = result.data.user;
      client.auth.onAuthStateChange((_event, session) => {
         if (!session?.user?.id) redirect();
         else activeBan(client, session.user).then((ban) => { if (ban) redirectBanned(); else window.TubeAuthGate.user = session.user; });
      });
      root.classList.remove('auth-gate-pending');
      root.classList.add('auth-gate-ready');
      return result.data.user;
    } catch (_error) {
      redirect();
      return null;
    }
  })();
}());
