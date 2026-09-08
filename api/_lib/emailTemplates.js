

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function withLineBreaks(s) {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function humanize(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(n) {
  return `₹${Number(n).toFixed(2)}`;
}

const FORM_TYPE_LABELS = {
  service_booking: 'Service Booking',
  contact_individual: 'Individual Enquiry',
  contact_corporate: 'Corporate Enquiry',
  event_registration: 'Event Registration',
  artisoul_tribe: 'Artisoul Tribe Interest',
};

function wrapEmail(title, bodyHtml) {
  return (
    '<!doctype html><html><body style="font-family: Georgia, \'Times New Roman\', serif; color:#2c2c2c; max-width:560px; margin:0 auto; padding:24px;">' +
    `<h2 style="color:#20323f; margin-top:0;">${title}</h2>` +
    bodyHtml +
    '<p style="color:#8a8a8a; font-size:12px; margin-top:32px;">Shreyaah\'s Bliss Trails</p>' +
    '</body></html>'
  );
}

function giftCardLineDetails(gc) {
  if (!gc) return '';
  return (
    '<div style="margin:4px 0 10px;padding:8px 12px;background:#F6F1E6;border-radius:6px;font-size:14px;">' +
    `<strong>Recipient:</strong> ${escapeHtml(gc.recipient_name)} &mdash; ${escapeHtml(gc.recipient_email)}<br>` +
    `<strong>Sender:</strong> ${escapeHtml(gc.sender_name)}` +
    (gc.sender_phone ? ` &mdash; ${escapeHtml(gc.sender_phone)}` : '') +
    (gc.sender_email ? ` &mdash; ${escapeHtml(gc.sender_email)}` : '') +
    (gc.message ? `<br><strong>Message:</strong> ${withLineBreaks(gc.message)}` : '') +
    '</div>'
  );
}

function orderItemLines(items) {
  return (items || [])
    .map((li) => (
      `<p style="margin:4px 0;">${escapeHtml(li.name)} &times; ${li.qty} &mdash; ${money(li.line_total)}</p>` +
      (li.item_type === 'gift_card' ? giftCardLineDetails(li.gift_card) : '')
    ))
    .join('');
}

function orderTotalsBlock(order) {
  return (
    `<p style="margin:4px 0;"><strong>Subtotal:</strong> ${money(order.subtotal)}</p>` +
    `<p style="margin:4px 0;"><strong>Shipping:</strong> ${money(order.shipping_fee)}</p>` +
    `<p style="margin:4px 0;"><strong>Grand total:</strong> ${money(order.grand_total)}</p>`
  );
}

function orderAddressBlock(customer) {
  return withLineBreaks(
    [customer.address_line, customer.city, customer.state, customer.pincode].filter(Boolean).join('\n')
  );
}

function orderConfirmationEmail(order) {
  const body =
    `<p>Hi ${escapeHtml(order.customer.name)},</p>` +
    '<p>Thank you for your order! Here is a summary:</p>' +
    orderItemLines(order.items) +
    orderTotalsBlock(order) +
    `<p><strong>Delivering to:</strong><br>${orderAddressBlock(order.customer)}</p>` +
    '<p>We will be in touch if we need anything else.</p>';
  return {
    subject: `Order confirmed — ${order.order_number || order.id}`,
    html: wrapEmail('Order Confirmed', body),
  };
}

function giftCardEmail(giftCard) {
  const orderedOn = new Date(giftCard.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const cardVisual =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">' +
    '<tr><td align="center">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:420px;background:linear-gradient(135deg,#3F5B54,#20323F);border-radius:14px;">' +
    '<tr><td style="padding:28px 30px;color:#F3ECDD;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.75;">Shreyaah\'s Bliss Trails</p>' +
    '<p style="margin:14px 0 2px;font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85;">E-Bliss Card</p>' +
    `<p style="margin:0 0 20px;font-size:34px;font-weight:bold;">${money(giftCard.amount)}</p>` +
    '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;">Your code</p>' +
    `<p style="margin:4px 0 0;font-size:24px;font-weight:bold;letter-spacing:3px;font-family:'Courier New',monospace;">${escapeHtml(giftCard.code)}</p>` +
    '</td></tr></table>' +
    '</td></tr></table>';

  const body =
    `<p>Hi ${escapeHtml(giftCard.recipient_name)},</p>` +
    `<p><strong>${escapeHtml(giftCard.sender_name)}</strong> sent you an E-Bliss Card worth ${money(giftCard.amount)}, ordered on ${orderedOn}.</p>` +
    (giftCard.message
      ? `<p style="margin:16px 0;padding:14px 18px;background:#F6F1E6;border-left:3px solid #DA8A67;font-style:italic;">${withLineBreaks(giftCard.message)}</p>`
      : '') +
    cardVisual +
    '<p><strong>Please don\'t share this code with anyone else.</strong></p>' +
    '<p><strong>How to use it:</strong></p>' +
    '<ol style="padding-left:20px;margin:8px 0;">' +
    '<li>Don\'t share this code with anyone.</li>' +
    '<li>Create an account at a4.snumcaj.com if you don\'t already have one.</li>' +
    '<li>Go to the E-Bliss Gift Card page.</li>' +
    '<li>Enter the code above in the "Redeem a gift card" section.</li>' +
    '<li>The amount is added to your E-Bliss Wallet, ready to use at checkout on any product or session.</li>' +
    '</ol>';

  return {
    subject: `${giftCard.sender_name} sent you an E-Bliss Card worth ${money(giftCard.amount)}`,
    html: wrapEmail('You\'ve Received an E-Bliss Card', body),
  };
}

function otpEmail(code) {
  const body =
    '<p>Your one-time login code is:</p>' +
    `<p style="font-size:28px; font-weight:bold; letter-spacing:4px;">${escapeHtml(code)}</p>` +
    '<p>This code expires shortly. If you did not request this, you can ignore this email.</p>';
  return { subject: 'Your login code', html: wrapEmail('Your Login Code', body) };
}

function emailChangeCodeEmail(code) {
  const body =
    '<p>Use this code to confirm your new email address:</p>' +
    `<p style="font-size:28px; font-weight:bold; letter-spacing:4px;">${escapeHtml(code)}</p>` +
    '<p>This code expires shortly. If you did not request this, you can ignore this email.</p>';
  return { subject: 'Confirm your new email', html: wrapEmail('Confirm Your Email', body) };
}

function enquiryAdminEmail(submission) {
  const label = FORM_TYPE_LABELS[submission.form_type] || submission.form_type;
  const detailLines = Object.keys(submission.details || {})
    .map((k) => `<p style="margin:4px 0;"><strong>${humanize(k)}:</strong> ${withLineBreaks(submission.details[k])}</p>`)
    .join('');
  const body =
    `<p style="margin:4px 0;"><strong>Type:</strong> ${escapeHtml(label)}</p>` +
    `<p style="margin:4px 0;"><strong>Name:</strong> ${escapeHtml(submission.name)}</p>` +
    (submission.phone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${escapeHtml(submission.phone)}</p>` : '') +
    (submission.email ? `<p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(submission.email)}</p>` : '') +
    detailLines +
    (submission.message
      ? `<p style="margin:4px 0;"><strong>Message:</strong><br>${withLineBreaks(submission.message)}</p>`
      : '');
  return {
    subject: `New ${label} — ${submission.name}`,
    html: wrapEmail('New Enquiry', body),
  };
}

function orderAdminEmail(order) {
  const body =
    `<p style="margin:4px 0;"><strong>Order:</strong> ${escapeHtml(order.order_number || order.id)}</p>` +
    `<p style="margin:4px 0;"><strong>Customer:</strong> ${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.phone)})</p>` +
    (order.customer.email
      ? `<p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(order.customer.email)}</p>`
      : '') +
    `<p style="margin:4px 0;"><strong>Address:</strong><br>${orderAddressBlock(order.customer)}</p>` +
    orderItemLines(order.items) +
    orderTotalsBlock(order);
  return {
    subject: `New order — ${order.order_number || order.id}`,
    html: wrapEmail('New Order', body),
  };
}

function adminNotificationEmail(kind, data) {
  if (kind === 'enquiry') return enquiryAdminEmail(data.submission);
  if (kind === 'order') return orderAdminEmail(data.order);
  throw new Error(`Unknown admin notification kind: ${kind}`);
}

module.exports = {
  escapeHtml,
  withLineBreaks,
  orderConfirmationEmail,
  giftCardEmail,
  otpEmail,
  emailChangeCodeEmail,
  adminNotificationEmail,
};
