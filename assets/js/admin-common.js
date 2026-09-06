(function () {
  'use strict';

  var SUPABASE_URL = 'https://lektufytmhaumsltyfxf.supabase.co';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3R1Znl0bWhhdW1zbHR5ZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDU4ODcsImV4cCI6MjEwNDE4MTg4N30.NjFKO-hgk5PrdM-di5lOGbFYVXLWJtKpl24ye3GKAmk';

  // A distinct storageKey keeps an admin session separate from a member
  // session in the same browser (member-common.js already does the same
  // for its own client) -- belt-and-braces isolation on top of the actual
  // fix below, which is that admin status is now verified server-side
  // right after login instead of just checking "is there any session".
  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: 'sbt-admin-auth' },
  });

  // A valid Supabase login only proves the email/password is correct for
  // *some* account -- it says nothing about whether that account is an
  // admin (members authenticate against the exact same user pool). This
  // calls a route that's already gated by requireAdmin() server-side and
  // treats any error response as "not an admin", regardless of what the
  // error actually says.
  function checkIsAdmin(session) {
    return fetch('/api/admin/admin-users', {
      headers: { Authorization: 'Bearer ' + session.access_token },
    })
      .then(function (r) { return r.json(); })
      .then(function (json) { return !json.error; })
      .catch(function () { return false; });
  }

  window.SBTAdmin = {
    client: client,
    checkIsAdmin: checkIsAdmin,
    requireSession: function (callback) {
      client.auth.getSession().then(function (res) {
        var session = res.data && res.data.session;
        if (!session) {
          window.location.href = '/admin/';
          return;
        }
        checkIsAdmin(session).then(function (isAdmin) {
          if (!isAdmin) {
            client.auth.signOut().then(function () {
              window.location.href = '/admin/?error=not-admin';
            });
            return;
          }
          callback(session);
        });
      });
    },
    logout: function () {
      client.auth.signOut().then(function () {
        window.location.href = '/admin/';
      });
    },
  };
})();
