const { requireMember } = require('../_lib/memberAuth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { generateCode, hashCode, matches, isExpired } = require('../_lib/emailChangeOtp');
const { emailChangeCodeEmail } = require('../_lib/emailTemplates');
const { sendEmail } = require('../_lib/email');

const CODE_TTL_MS = 15 * 60 * 1000;

// Two steps of one flow, kept in one file (dispatched by ?action=) rather
// than two separate serverless functions -- Vercel's Hobby plan caps a
// deployment at 12 functions total, same reason api/admin/members.js
// dispatches its own reset-login action by query param instead of a
// separate route.
async function handleRequest(req, res, member, supabase) {
  const { new_email: newEmail } = req.body || {};
  if (!newEmail || !String(newEmail).trim()) {
    return res.status(400).json({ error: 'Missing new_email' });
  }
  const normalizedEmail = String(newEmail).trim().toLowerCase();
  if (normalizedEmail === String(member.email).toLowerCase()) {
    return res.status(400).json({ error: 'That is already your email address' });
  }

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) return res.status(500).json({ error: listError.message });
  if (existing.users.some((u) => u.email && u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ error: 'That email is already in use' });
  }

  const code = generateCode();
  const { error: insertError } = await supabase.from('member_email_change_requests').insert({
    member_id: member.id,
    new_email: normalizedEmail,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (insertError) return res.status(500).json({ error: insertError.message });

  try {
    const { subject, html } = emailChangeCodeEmail(code);
    await sendEmail({ to: normalizedEmail, subject, html });
  } catch (e) {
    return res.status(502).json({ error: `Could not send the confirmation code: ${e.message}` });
  }

  return res.status(200).json({ ok: true });
}

async function handleConfirm(req, res, member, supabase) {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

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
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let member;
  try {
    member = await requireMember(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();
  const action = req.query.action || 'request';

  if (action === 'request') return handleRequest(req, res, member, supabase);
  if (action === 'confirm') return handleConfirm(req, res, member, supabase);
  return res.status(400).json({ error: `Unknown action: ${action}` });
};
