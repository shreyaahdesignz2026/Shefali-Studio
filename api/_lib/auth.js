const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin } = require('./supabaseAdmin');

function makeRequireAdmin(getAuthClient, getAdminUsersClient) {
  return async function requireAdmin(authHeader) {
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

    const adminUsersClient = getAdminUsersClient();
    const { data: row, error: roleError } = await adminUsersClient
      .from('admin_users')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    if (roleError || !row) {
      const err = new Error('Not an admin account');
      err.status = 403;
      throw err;
    }

    return Object.assign({}, data.user, { role: row.role });
  };
}

const defaultAuthClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = {
  requireAdmin: makeRequireAdmin(defaultAuthClient, getSupabaseAdmin),
  makeRequireAdmin,
};
