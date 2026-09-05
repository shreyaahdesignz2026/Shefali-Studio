const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRequireAdmin } = require('../api/_lib/auth');

function fakeAuthClient(getUserResult) {
  return () => ({
    auth: {
      getUser: async () => getUserResult,
    },
  });
}

function fakeAdminUsersClient(roleRowResult) {
  return () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => roleRowResult,
        }),
      }),
    }),
  });
}

test('rejects a missing Authorization header', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeAuthClient({ data: null, error: null }),
    fakeAdminUsersClient({ data: null, error: null })
  );
  await assert.rejects(() => requireAdmin(undefined), /Missing Authorization header/);
});

test('rejects an invalid token', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeAuthClient({ data: null, error: new Error('bad token') }),
    fakeAdminUsersClient({ data: null, error: null })
  );
  await assert.rejects(
    () => requireAdmin('Bearer not-a-real-token'),
    /Invalid or expired session/
  );
});

test('rejects a valid session with no admin_users row', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeAuthClient({
      data: { user: { id: 'u1', email: 'someone-else@example.com' } },
      error: null,
    }),
    fakeAdminUsersClient({ data: null, error: null })
  );
  await assert.rejects(() => requireAdmin('Bearer some-token'), /Not an admin account/);
});

test('accepts a valid admin session and attaches its role', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeAuthClient({ data: { user: { id: 'u1', email: 'admin@example.com' } }, error: null }),
    fakeAdminUsersClient({ data: { role: 'admin' }, error: null })
  );
  const user = await requireAdmin('Bearer some-token');
  assert.equal(user.email, 'admin@example.com');
  assert.equal(user.role, 'admin');
});

test('accepts a valid superadmin session and attaches its role', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeAuthClient({ data: { user: { id: 'u2', email: 'super@example.com' } }, error: null }),
    fakeAdminUsersClient({ data: { role: 'superadmin' }, error: null })
  );
  const user = await requireAdmin('Bearer some-token');
  assert.equal(user.role, 'superadmin');
});
