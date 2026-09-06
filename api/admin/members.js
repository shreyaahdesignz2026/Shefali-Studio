const crypto = require('node:crypto');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

const PLANS = ['free_tier', 'artisoul_member'];

function generatePassword() {
  return crypto.randomBytes(18).toString('base64url');
}

async function findAuthUserByEmail(supabase, email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`Could not list auth users: ${error.message}`);
  return (
    data.users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase()) || null
  );
}

module.exports = async (req, res) => {
  try {
    await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ members: data });
  }

  if (req.method === 'POST') {
    const { email, display_name, phone, note, plan, password } = req.body || {};
    if (!email || !String(email).trim()) return res.status(400).json({ error: 'Missing email' });
    if (password && String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPlan = PLANS.includes(plan) ? plan : 'free_tier';

    let authUser;
    let temporaryPassword = password || generatePassword();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError) {
      if (!/already been registered|already exists/i.test(createError.message)) {
        return res.status(500).json({ error: `Could not create account: ${createError.message}` });
      }
      // Account already exists (e.g. they logged in via OTP before an admin
      // ever set them up) -- enroll/update the existing account instead of
      // failing, same fallback admin-users.js uses for admins.
      temporaryPassword = null;
      try {
        authUser = await findAuthUserByEmail(supabase, normalizedEmail);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
      if (!authUser) return res.status(500).json({ error: 'Account exists but could not be found' });
    } else {
      authUser = created.user;
    }

    const { data: member, error: upsertError } = await supabase
      .from('members')
      .upsert({
        id: authUser.id,
        email: authUser.email,
        display_name: display_name || null,
        phone: phone || null,
        note: note || null,
        plan: normalizedPlan,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (upsertError) return res.status(500).json({ error: upsertError.message });

    return res.status(200).json({ ok: true, member, temporary_password: temporaryPassword });
  }

  if (req.method === 'PATCH') {
    const targetId = req.query.id;
    if (!targetId) return res.status(400).json({ error: 'Missing id' });

    if (req.query.action === 'reset-login') {
      const newPassword = generatePassword();
      const { error: resetError } = await supabase.auth.admin.updateUserById(targetId, {
        password: newPassword,
      });
      if (resetError) return res.status(500).json({ error: resetError.message });
      return res.status(200).json({ ok: true, temporary_password: newPassword });
    }

    if (req.query.action === 'set-password') {
      const { password } = req.body || {};
      if (!password || String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const { error: setError } = await supabase.auth.admin.updateUserById(targetId, { password });
      if (setError) return res.status(500).json({ error: setError.message });
      return res.status(200).json({ ok: true });
    }

    const { display_name, phone, note, plan } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (display_name !== undefined) updates.display_name = display_name;
    if (phone !== undefined) updates.phone = phone;
    if (note !== undefined) updates.note = note;
    if (plan !== undefined) {
      if (!PLANS.includes(plan)) return res.status(400).json({ error: `Invalid plan: ${plan}` });
      updates.plan = plan;
    }

    const { data: updated, error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', targetId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, member: updated });
  }

  if (req.method === 'DELETE') {
    const targetId = req.query.id;
    if (!targetId) return res.status(400).json({ error: 'Missing id' });

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetId);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    // The members row is removed automatically via ON DELETE CASCADE from auth.users.

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
