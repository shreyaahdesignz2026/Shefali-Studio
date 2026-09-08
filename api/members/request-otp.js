const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { canRequestOtp } = require('../_lib/otpThrottle');
const { generateCode, hashCode, matches, isExpired } = require('../_lib/otpCode');
const { otpEmail } = require('../_lib/emailTemplates');
const { sendEmail } = require('../_lib/email');

const CODE_TTL_MS = 10 * 60 * 1000;

async function handleRequest(req, res, supabase) {
  const { email } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Missing email' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

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

  const { error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { shouldCreateUser: true },
  });
  if (linkError) return res.status(500).json({ error: linkError.message });

  const code = generateCode();
  const { error: insertError } = await supabase.from('member_otp_requests').insert({
    email: normalizedEmail,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (insertError) return res.status(500).json({ error: insertError.message });

  try {
    const { subject, html } = otpEmail(code);
    await sendEmail({ to: normalizedEmail, subject, html });
  } catch (e) {
    return res.status(502).json({ error: `Could not send the login code: ${e.message}` });
  }

  return res.status(200).json({ ok: true });
}

async function handleVerify(req, res, supabase) {
  const { email, code } = req.body || {};
  if (!email || !String(email).trim()) return res.status(400).json({ error: 'Missing email' });
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: candidates, error: candidatesError } = await supabase
    .from('member_otp_requests')
    .select('id, code_hash, expires_at')
    .eq('email', normalizedEmail)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (candidatesError) return res.status(500).json({ error: candidatesError.message });

  const match = (candidates || []).find((row) => matches(code, row.code_hash) && !isExpired(row.expires_at));
  if (!match) {
    return res.status(400).json({ error: 'Invalid or expired code. Please request a new one.' });
  }

  const { data: consumed, error: consumeError } = await supabase
    .from('member_otp_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', match.id)
    .is('consumed_at', null)
    .select();
  if (consumeError) return res.status(500).json({ error: consumeError.message });
  if (!consumed || consumed.length === 0) {
    return res.status(400).json({ error: 'This code has already been used. Please request a new one.' });
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
  });
  if (linkError) return res.status(500).json({ error: linkError.message });

  const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError) return res.status(500).json({ error: verifyError.message });

  return res.status(200).json({ ok: true, session: verifyData.session });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  const action = req.query.action || 'request';

  if (action === 'request') return handleRequest(req, res, supabase);
  if (action === 'verify') return handleVerify(req, res, supabase);
  return res.status(400).json({ error: `Unknown action: ${action}` });
};
