const { requireMember } = require('../_lib/memberAuth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { matches, isExpired } = require('../_lib/emailChangeOtp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let member;
  try {
    member = await requireMember(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const supabase = getSupabaseAdmin();
  const { data: request, error } = await supabase
    .from('member_email_change_requests')
    .select('*')
    .eq('member_id', member.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!request) return res.status(400).json({ error: 'No pending email change request' });
  if (isExpired(request.expires_at)) {
    return res.status(400).json({ error: 'This code has expired, please request a new one' });
  }
  if (!matches(code, request.code_hash)) {
    return res.status(400).json({ error: 'Incorrect code' });
  }

  const { error: updateAuthError } = await supabase.auth.admin.updateUserById(member.id, {
    email: request.new_email,
    email_confirm: true,
  });
  if (updateAuthError) return res.status(500).json({ error: updateAuthError.message });

  const { error: updateMemberError } = await supabase
    .from('members')
    .update({ email: request.new_email, updated_at: new Date().toISOString() })
    .eq('id', member.id);
  if (updateMemberError) return res.status(500).json({ error: updateMemberError.message });

  await supabase
    .from('member_email_change_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', request.id);

  return res.status(200).json({ ok: true, email: request.new_email });
};
