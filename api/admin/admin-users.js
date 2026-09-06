const crypto = require('node:crypto');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { canGrantRole, canChangeRole, canKick, canChangePassword, ROLES } = require('../_lib/adminRoles');

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

async function countSuperadmins(supabase) {
  const { count, error } = await supabase
    .from('admin_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'superadmin');
  if (error) throw new Error(error.message);
  return count;
}

module.exports = async (req, res) => {
  let actingUser;
  try {
    actingUser = await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res
      .status(200)
      .json({ admins: data, self: { id: actingUser.id, role: actingUser.role } });
  }

  if (req.method === 'POST') {
    const { email, role } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: 'Missing email or role' });
    if (!canGrantRole(actingUser.role, role)) {
      return res
        .status(403)
        .json({ error: `An ${actingUser.role} cannot grant the ${role} role` });
    }

    let authUser;
    let temporaryPassword = generatePassword();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError) {
      if (!/already been registered|already exists/i.test(createError.message)) {
        return res.status(500).json({ error: `Could not create account: ${createError.message}` });
      }
      temporaryPassword = null;
      try {
        authUser = await findAuthUserByEmail(supabase, email);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
      if (!authUser) {
        return res.status(500).json({ error: 'Account exists but could not be found' });
      }
    } else {
      authUser = created.user;
    }

    const { error: upsertError } = await supabase
      .from('admin_users')
      .upsert({ id: authUser.id, email: authUser.email, role, updated_at: new Date().toISOString() });
    if (upsertError) return res.status(500).json({ error: upsertError.message });

    return res.status(200).json({
      ok: true,
      id: authUser.id,
      email: authUser.email,
      role,
      temporary_password: temporaryPassword,
    });
  }

  if (req.method === 'PATCH') {
    const targetId = req.query.id;
    if (!targetId) return res.status(400).json({ error: 'Missing id' });

    if (req.query.action === 'reset-login' || req.query.action === 'set-password') {
      if (!canChangePassword(actingUser.role)) {
        return res.status(403).json({ error: 'Only a superadmin can change another account\'s password' });
      }

      let newPassword;
      if (req.query.action === 'set-password') {
        const { password } = req.body || {};
        if (!password || String(password).length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        newPassword = password;
      } else {
        newPassword = generatePassword();
      }

      const { error: pwError } = await supabase.auth.admin.updateUserById(targetId, { password: newPassword });
      if (pwError) return res.status(500).json({ error: pwError.message });
      return res.status(200).json({ ok: true, temporary_password: newPassword });
    }

    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: 'Missing role' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: `Invalid role: ${role}` });
    if (!canChangeRole(actingUser.role)) {
      return res.status(403).json({ error: 'Only a superadmin can change roles' });
    }
    if (targetId === actingUser.id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    if (role !== 'superadmin') {
      const { data: target, error: targetError } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', targetId)
        .maybeSingle();
      if (targetError) return res.status(500).json({ error: targetError.message });
      if (target && target.role === 'superadmin') {
        let superadminCount;
        try {
          superadminCount = await countSuperadmins(supabase);
        } catch (e) {
          return res.status(500).json({ error: e.message });
        }
        if (superadminCount <= 1) {
          return res.status(400).json({ error: 'At least one superadmin must remain' });
        }
      }
    }

    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', targetId);
    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const targetId = req.query.id;
    if (!targetId) return res.status(400).json({ error: 'Missing id' });
    if (!canKick(actingUser.role)) {
      return res.status(403).json({ error: 'Only a superadmin can remove an admin' });
    }
    if (targetId === actingUser.id) {
      return res.status(400).json({ error: 'You cannot remove your own account' });
    }

    const { data: target, error: targetError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', targetId)
      .maybeSingle();
    if (targetError) return res.status(500).json({ error: targetError.message });
    if (target && target.role === 'superadmin') {
      let superadminCount;
      try {
        superadminCount = await countSuperadmins(supabase);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'At least one superadmin must remain' });
      }
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetId);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    // The admin_users row is removed automatically via ON DELETE CASCADE from auth.users.

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
