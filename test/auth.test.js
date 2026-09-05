const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRequireAdmin } = require('../api/_lib/auth');

function fakeClient(getUserResult) {
  return () => ({
    auth: {
      getUser: async () => getUserResult,
    },
  });
}

test('rejects a missing Authorization header', async () => {
  const requireAdmin = makeRequireAdmin(fakeClient({ data: null, error: null }));
  await assert.rejects(() => requireAdmin(undefined), /Missing Authorization header/);
});

test('rejects an invalid token', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeClient({ data: null, error: new Error('bad token') })
  );
  await assert.rejects(
    () => requireAdmin('Bearer not-a-real-token'),
    /Invalid or expired session/
  );
});

test('rejects a valid session that is not the admin email', async () => {
  process.env.ADMIN_EMAIL = 'shreyaahdesignz2026@gmail.com';
  const requireAdmin = makeRequireAdmin(
    fakeClient({ data: { user: { email: 'someone-else@example.com' } }, error: null })
  );
  await assert.rejects(() => requireAdmin('Bearer some-token'), /Not the admin account/);
});

test('accepts a valid admin session', async () => {
  process.env.ADMIN_EMAIL = 'shreyaahdesignz2026@gmail.com';
  const requireAdmin = makeRequireAdmin(
    fakeClient({
      data: { user: { email: 'shreyaahdesignz2026@gmail.com', id: 'abc' } },
      error: null,
    })
  );
  const user = await requireAdmin('Bearer some-token');
  assert.equal(user.email, 'shreyaahdesignz2026@gmail.com');
});
