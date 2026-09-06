const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin } = require('./supabaseAdmin');

// Verifies the bearer token against Supabase Auth and returns the raw
// auth.users record -- no members-table lookup. Used by routes that need
// to know *which* authenticated visitor this is before a `members` row
// necessarily exists yet (api/members/me.js creates it on first GET, which
// is how a brand-new OTP login gets its row).
function makeGetAuthenticatedUser(getAuthClient) {
  return async function getAuthenticatedUser(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Missing Authorization header');
      err.status = 401;
      throw err;
    }
    const token = authHeader.slice('Bearer '.length);
    const supabase = getAuthClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      const err = new Error('Invalid or expired session');
      err.status = 401;
      throw err;
    }
    return data.user;
  };
}

function makeRequireMember(getAuthenticatedUser, getMembersClient) {
  return async function requireMember(authHeader) {
    const user = await getAuthenticatedUser(authHeader);

    const membersClient = getMembersClient();
    const { data: row, error } = await membersClient
      .from('members')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !row) {
      const err = new Error('Not a member account');
      err.status = 403;
      throw err;
    }

    return Object.assign({}, user, row);
  };
}

// Never throws -- checkout and enquiries must work identically whether or
// not the visitor is logged in, so callers just get null back for a
// missing/invalid session instead of having to catch. Deliberately built on
// getAuthenticatedUser rather than requireMember: an order or enquiry must
// still link to a brand-new OTP login's account even before that visitor
// has ever hit /api/members/me (which is what lazily creates their
// `members` row) -- callers here only ever need `.id` to set member_id.
function makeGetOptionalMember(getAuthenticatedUser) {
  return async function getOptionalMember(authHeader) {
    if (!authHeader) return null;
    try {
      return await getAuthenticatedUser(authHeader);
    } catch (e) {
      return null;
    }
  };
}

const defaultAuthClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const getAuthenticatedUser = makeGetAuthenticatedUser(defaultAuthClient);
const requireMember = makeRequireMember(getAuthenticatedUser, getSupabaseAdmin);
const getOptionalMember = makeGetOptionalMember(getAuthenticatedUser);

module.exports = {
  getAuthenticatedUser,
  requireMember,
  getOptionalMember,
  makeGetAuthenticatedUser,
  makeRequireMember,
  makeGetOptionalMember,
};
