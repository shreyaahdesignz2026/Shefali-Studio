const { createClient } = require('@supabase/supabase-js');

function makeRequireAdmin(getClient) {
  return async function requireAdmin(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Missing Authorization header');
      err.status = 401;
      throw err;
    }
    const token = authHeader.slice('Bearer '.length);
    const supabase = getClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      const err = new Error('Invalid or expired session');
      err.status = 401;
      throw err;
    }
    if (data.user.email !== process.env.ADMIN_EMAIL) {
      const err = new Error('Not the admin account');
      err.status = 403;
      throw err;
    }
    return data.user;
  };
}

const defaultClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = {
  requireAdmin: makeRequireAdmin(defaultClient),
  makeRequireAdmin,
};
