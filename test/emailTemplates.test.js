const test = require('node:test');
const assert = require('node:assert/strict');
const {
  orderConfirmationEmail,
  giftCardEmail,
  otpEmail,
  emailChangeCodeEmail,
  adminNotificationEmail,
} = require('../api/_lib/emailTemplates');

const sampleOrder = {
  id: 'ord-1',
  order_number: 'SBT-0001',
  customer: {
    name: 'Priya Sharma',
    phone: '9999999999',
    email: 'priya@example.com',
    address_line: '12 Lake View Road',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700001',
  },
  items: [{ name: 'Rose Quartz Bracelet', qty: 2, line_total: 900 }],
  subtotal: 900,
  shipping_fee: 300,
  grand_total: 1200,
};

test('orderConfirmationEmail includes the order number, items, and totals', () => {
  const { subject, html } = orderConfirmationEmail(sampleOrder);
  assert.match(subject, /SBT-0001/);
  assert.match(html, /Priya Sharma/);
  assert.match(html, /Rose Quartz Bracelet/);
  assert.match(html, /1200\.00/);
  assert.match(html, /Kolkata/);
});

test('orderConfirmationEmail escapes HTML in customer-supplied fields', () => {
  const order = {
    ...sampleOrder,
    customer: { ...sampleOrder.customer, name: '<script>alert(1)</script>' },
  };
  const { html } = orderConfirmationEmail(order);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

const sampleGiftCard = {
  code: 'AB12CD34EF56GH78',
  amount: 500,
  sender_name: 'Ravi Kapoor',
  recipient_name: 'Asha Sen',
  message: 'Happy birthday!',
  created_at: '2026-01-15T10:00:00.000Z',
};

test('giftCardEmail includes the code, amount, sender, message, and redemption steps', () => {
  const { subject, html } = giftCardEmail(sampleGiftCard);
  assert.match(subject, /Ravi Kapoor/);
  assert.match(subject, /500\.00/);
  assert.match(html, /AB12CD34EF56GH78/);
  assert.match(html, /Asha Sen/);
  assert.match(html, /Ravi Kapoor/);
  assert.match(html, /Happy birthday!/);
  assert.match(html, /Don't share this code/i);
  assert.match(html, /E-Bliss Wallet/i);
});

test('giftCardEmail escapes HTML in sender-supplied fields', () => {
  const giftCard = { ...sampleGiftCard, message: '<script>alert(1)</script>' };
  const { html } = giftCardEmail(giftCard);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('otpEmail includes the exact code', () => {
  const { subject, html } = otpEmail('042817');
  assert.match(subject, /login code/i);
  assert.match(html, /042817/);
});

test('emailChangeCodeEmail includes the exact code', () => {
  const { html } = emailChangeCodeEmail('998877');
  assert.match(html, /998877/);
});

test('adminNotificationEmail for an enquiry includes type, contact fields, details, and message', () => {
  const submission = {
    form_type: 'service_booking',
    name: 'Rahul',
    phone: '8888888888',
    email: 'rahul@example.com',
    message: 'First time visitor',
    details: { service: 'Oracle Card Reading', date: '2026-10-01' },
  };
  const { subject, html } = adminNotificationEmail('enquiry', { submission });
  assert.match(subject, /Service Booking/);
  assert.match(subject, /Rahul/);
  assert.match(html, /Oracle Card Reading/);
  assert.match(html, /First time visitor/);
  assert.match(html, /8888888888/);
});

test('adminNotificationEmail for an order includes the order number and totals', () => {
  const { subject, html } = adminNotificationEmail('order', { order: sampleOrder });
  assert.match(subject, /SBT-0001/);
  assert.match(html, /Priya Sharma/);
  assert.match(html, /1200\.00/);
});

test('adminNotificationEmail throws on an unknown kind', () => {
  assert.throws(() => adminNotificationEmail('carrier-pigeon', {}), /Unknown admin notification kind/);
});
