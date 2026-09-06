// Plain fetch() to Resend's HTTP API -- no `resend` npm package, since this
// is a ~10-line POST and pulling in a dependency for it would repeat the
// sharp-native-binary class of deploy risk for no real benefit. Node 24's
// runtime has global fetch.
async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@shreyaahsbllissfultrails.com';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Shreyaah's Bliss Trails <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${text}`);
  }

  return res.json();
}

module.exports = { sendEmail };
