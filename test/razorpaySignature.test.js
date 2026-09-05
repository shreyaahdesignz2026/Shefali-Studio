const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyPaymentSignature } = require('../api/_lib/razorpaySignature');

test('accepts a correctly computed signature', () => {
  const keySecret = 'test-secret';
  const razorpay_order_id = 'order_ABC123';
  const razorpay_payment_id = 'pay_XYZ789';
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const ok = verifyPaymentSignature(
    { razorpay_order_id, razorpay_payment_id, razorpay_signature: expected },
    keySecret
  );
  assert.equal(ok, true);
});

test('rejects a tampered signature', () => {
  const ok = verifyPaymentSignature(
    {
      razorpay_order_id: 'order_ABC123',
      razorpay_payment_id: 'pay_XYZ789',
      razorpay_signature: 'not-the-real-signature',
    },
    'test-secret'
  );
  assert.equal(ok, false);
});

test('rejects when signed with the wrong secret', () => {
  const razorpay_order_id = 'order_ABC123';
  const razorpay_payment_id = 'pay_XYZ789';
  const wrongSig = crypto
    .createHmac('sha256', 'wrong-secret')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const ok = verifyPaymentSignature(
    { razorpay_order_id, razorpay_payment_id, razorpay_signature: wrongSig },
    'test-secret'
  );
  assert.equal(ok, false);
});
