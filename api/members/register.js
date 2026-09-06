const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

// Self-serve registration, silent on Supabase's side just like the OTP
// login flow -- auth.admin.createUser never sends Supabase's own "confirm
// your signup" email regardless of project settings, so Resend stays the
// only thing that ever emails a visitor. Unlike api/admin/members.js
// (a trusted admin enrolling someone), an email that's already registered
// here must be rejected outright rather than silently taken over -- an
// admin acting in good faith re-using an existing email is fine; a stranger
// doing the same to someone else's account would be an account takeover.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, display_name: displayName, phone } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Missing email' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const supabase = getSupabaseAdmin();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (/already been registered|already exists/i.test(createError.message)) {
      return res.status(400).json({ error: 'An account with that email already exists — please log in instead.' });
    }
    return res.status(500).json({ error: `Could not create account: ${createError.message}` });
  }

  const { error: insertError } = await supabase.from('members').insert({
    id: created.user.id,
    email: normalizedEmail,
    display_name: displayName || null,
    phone: phone || null,
    plan: 'free_tier',
  });
  if (insertError) {
    // Don't leave an orphaned auth user with no profile behind.
    await supabase.auth.admin.deleteUser(created.user.id);
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({ ok: true });
};
