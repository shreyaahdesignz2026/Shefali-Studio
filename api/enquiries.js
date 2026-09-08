const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { validateSubmission, buildRow } = require('./_lib/formSubmissions');
const { getOptionalMember } = require('./_lib/memberAuth');
const { adminNotificationEmail } = require('./_lib/emailTemplates');
const { sendEmail } = require('./_lib/email');

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'shreyaahdesignz2026@gmail.com';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { form_type: formType, fields } = req.body || {};
  if (!formType || !fields) {
    return res.status(400).json({ error: 'Missing form_type or fields' });
  }

  try {
    validateSubmission(formType, fields);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const member = await getOptionalMember(req.headers.authorization);

  const row = buildRow(formType, fields);
  if (member) row.member_id = member.id;

  const supabase = getSupabaseAdmin();
  const { data: submission, error } = await supabase
    .from('form_submissions')
    .insert(row)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  try {
    const { subject, html } = adminNotificationEmail('enquiry', { submission });
    await sendEmail({ to: ADMIN_NOTIFICATION_EMAIL, subject, html });
  } catch (e) {
    console.error('Admin enquiry notification email failed:', e.message);
  }

  return res.status(200).json({ ok: true });
};
