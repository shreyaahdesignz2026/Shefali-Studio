const { getAuthenticatedUser } = require('../_lib/memberAuth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

module.exports = async (req, res) => {
  let user;
  try {
    user = await getAuthenticatedUser(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    let { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });

    if (!member) {
      const { data: created, error: createError } = await supabase
        .from('members')
        .insert({ id: user.id, email: user.email })
        .select()
        .single();
      if (createError) return res.status(500).json({ error: createError.message });
      member = created;
    }

    return res.status(200).json({ member });
  }

  if (req.method === 'POST' && req.query.action === 'redeem-gift-card') {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Missing gift card code' });
    }
    const normalized = code.trim().toUpperCase();
    const { data, error: rpcError } = await supabase.rpc('redeem_gift_card', {
      p_code: normalized,
      p_member_id: user.id,
    });
    if (rpcError) return res.status(400).json({ error: rpcError.message });
    const row = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ ok: true, amount: row.amount, wallet_balance: row.new_balance });
  }

  if (req.method === 'PATCH') {
    const { display_name, phone, note } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (display_name !== undefined) updates.display_name = display_name;
    if (phone !== undefined) updates.phone = phone;
    if (note !== undefined) updates.note = note;

    const { data: updated, error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ member: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
