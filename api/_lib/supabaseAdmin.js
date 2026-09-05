const { createClient } = require('@supabase/supabase-js');

let cached = null;

function getSupabaseAdmin() {
  if (!cached) {
    cached = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return cached;
}

module.exports = { getSupabaseAdmin };
