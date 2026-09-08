const test = require('node:test');
const assert = require('node:assert/strict');
const {
  makeGetAuthenticatedUser,
  makeRequireMember,
  makeGetOptionalMember,
} = require('../api/_lib/memberAuth');

function fakeAuthClient(getUserResult) {
  return () => ({ auth: { getUser: async () => getUserResult } });
}

function fakeMembersClient(rowResult) {
  return () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => rowResult,
        }),
      }),
    }),
  });
}

test('getAuthenticatedUser rejects a missing Authorization header', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(fakeAuthClient({ data: null, error: null }));
  await assert.rejects(() => getAuthenticatedUser(undefined), /Missing Authorization header/);
});

test('getAuthenticatedUser rejects an invalid token', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(
    fakeAuthClient({ data: null, error: new Error('bad token') })
  );
  await assert.rejects(() => getAuthenticatedUser('Bearer nope'), /Invalid or expired session/);
});

test('getAuthenticatedUser resolves the user on a valid token', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(
    fakeAuthClient({ data: { user: { id: 'u1', email: 'guest@example.com' } }, error: null })
  );
  const user = await getAuthenticatedUser('Bearer good-token');
  assert.equal(user.id, 'u1');
});

test('requireMember rejects a valid session with no members row (not yet a member)', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(
    fakeAuthClient({ data: { user: { id: 'u1', email: 'someone@example.com' } }, error: null })
  );
  const requireMember = makeRequireMember(getAuthenticatedUser, fakeMembersClient({ data: null, error: null }));
  await assert.rejects(() => requireMember('Bearer some-token'), /Not a member account/);
});

test('requireMember accepts a valid member session and attaches their row', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(
    fakeAuthClient({ data: { user: { id: 'u1', email: 'member@example.com' } }, error: null })
  );
  const requireMember = makeRequireMember(
    getAuthenticatedUser,
    fakeMembersClient({ data: { id: 'u1', plan: 'free_tier', display_name: 'M' }, error: null })
  );
  const member = await requireMember('Bearer some-token');
  assert.equal(member.email, 'member@example.com');
  assert.equal(member.plan, 'free_tier');
});

test('getOptionalMember returns null instead of throwing when no header is present', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(fakeAuthClient({ data: null, error: null }));
  const getOptionalMember = makeGetOptionalMember(getAuthenticatedUser);
  assert.equal(await getOptionalMember(undefined), null);
});

test('getOptionalMember returns null when the session is invalid rather than throwing', async () => {
  const getAuthenticatedUser = makeGetAuthenticatedUser(
    fakeAuthClient({ data: null, error: new Error('bad token') })
  );
  const getOptionalMember = makeGetOptionalMember(getAuthenticatedUser);
  assert.equal(await getOptionalMember('Bearer bad-token'), null);
});

test('getOptionalMember returns the authenticated user even with no members row yet', async () => {

  const getAuthenticatedUser = makeGetAuthenticatedUser(
    fakeAuthClient({ data: { user: { id: 'u2', email: 'x@example.com' } }, error: null })
  );
  const getOptionalMember = makeGetOptionalMember(getAuthenticatedUser);
  const user = await getOptionalMember('Bearer good-token');
  assert.equal(user.id, 'u2');
});
