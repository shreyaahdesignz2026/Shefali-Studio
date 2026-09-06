const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { canRequestOtp } = require('../_lib/otpThrottle');
const { otpEmail } = require('../_lib/emailTemplates');
const { sendEmail } = require('../_lib/email');

// Supabase's own admin API is the bridge: generateLink with
// shouldCreateUser silently creates the auth.users row if needed (no email
// sent by Supabase) and returns a real 6-digit email_otp that GoTrue has
// already stored, hashed, with its own expiry -- we just deliver it
// ourselves via Resend instead of Supabase's mailer. The browser then calls
// the ordinary public client.auth.verifyOtp(), which mints a real session.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Missing email' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const supabase = getSupabaseAdmin();

  const { data: recent, error: recentError } = await supabase
    .from('member_otp_requests')
    .select('created_at')
    .eq('email', normalizedEmail)
    .order('created_at', { ascending: false })
    .limit(10);
  if (recentError) return res.status(500).json({ error: recentError.message });

  const throttle = canRequestOtp((recent || []).map((r) => r.created_at), Date.now());
  if (!throttle.allowed) {
    return res.status(429).json({ error: 'Too many requests, please try again shortly' });
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { shouldCreateUser: true },
  });
  if (linkError) return res.status(500).json({ error: linkError.message });

  const code = linkData && linkData.properties && linkData.properties.email_otp;
  if (!code) return res.status(500).json({ error: 'Could not generate a login code' });

  await supabase.from('member_otp_requests').insert({ email: normalizedEmail });

  try {
    const { subject, html } = otpEmail(code);
    await sendEmail({ to: normalizedEmail, subject, html });
  } catch (e) {
    return res.status(502).json({ error: `Could not send the login code: ${e.message}` });
  }

  return res.status(200).json({ ok: true });
};
