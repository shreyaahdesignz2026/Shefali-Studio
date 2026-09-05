const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { validateSubmission, buildRow } = require('./_lib/formSubmissions');

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

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('form_submissions').insert(buildRow(formType, fields));
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
};
