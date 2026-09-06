const { requireMember } = require('../_lib/memberAuth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { generateCode, hashCode } = require('../_lib/emailChangeOtp');
const { emailChangeCodeEmail } = require('../_lib/emailTemplates');
const { sendEmail } = require('../_lib/email');

const CODE_TTL_MS = 15 * 60 * 1000;

// Changing the email on an already-authenticated account needs a genuinely
// custom OTP -- generateLink/verifyOtp don't cleanly cover proving
// ownership of a *new* inbox without relying on Supabase's own "confirm new
// email" mailer, which this project avoids everywhere in favour of Resend.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let member;
  try {
    member = await requireMember(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { new_email: newEmail } = req.body || {};
  if (!newEmail || !String(newEmail).trim()) {
    return res.status(400).json({ error: 'Missing new_email' });
  }
  const normalizedEmail = String(newEmail).trim().toLowerCase();
  if (normalizedEmail === String(member.email).toLowerCase()) {
    return res.status(400).json({ error: 'That is already your email address' });
  }

  const supabase = getSupabaseAdmin();

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
};
