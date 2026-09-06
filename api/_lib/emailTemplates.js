// Pure HTML-builders for every transactional email Resend sends. No I/O
// here on purpose -- api/_lib/email.js does the actual sending, these
// functions just turn plain data into {subject, html}.

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

function orderItemLines(items) {
  return (items || [])
    .map((li) => `<p style="margin:4px 0;">${escapeHtml(li.name)} &times; ${li.qty} &mdash; ${money(li.line_total)}</p>`)
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
  otpEmail,
  emailChangeCodeEmail,
  adminNotificationEmail,
};
