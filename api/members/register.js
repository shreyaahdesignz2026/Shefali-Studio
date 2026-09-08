const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

async function findAuthUserByEmail(supabase, email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`Could not list auth users: ${error.message}`);
  return data.users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase()) || null;
}

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

  let userId;
  let createdFresh = false;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (!/already been registered|already exists/i.test(createError.message)) {
      return res.status(500).json({ error: `Could not create account: ${createError.message}` });
    }

    let existingUser;
    try {
      existingUser = await findAuthUserByEmail(supabase, normalizedEmail);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    if (!existingUser) return res.status(500).json({ error: 'Account exists but could not be found' });

    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .eq('id', existingUser.id)
      .maybeSingle();
    if (existingMember) {
      return res.status(400).json({ error: 'An account with that email already exists — please log in instead.' });
    }

    const { error: claimError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
    });
    if (claimError) return res.status(500).json({ error: `Could not set password: ${claimError.message}` });

    userId = existingUser.id;
  } else {
    userId = created.user.id;
    createdFresh = true;
  }

  const { error: insertError } = await supabase.from('members').insert({
    id: userId,
    email: normalizedEmail,
    display_name: displayName || null,
    phone: phone || null,
    plan: 'free_tier',
  });
  if (insertError) {

    if (createdFresh) await supabase.auth.admin.deleteUser(userId);
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({ ok: true });
};
