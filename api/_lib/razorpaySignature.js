const crypto = require('node:crypto');

function verifyPaymentSignature(
  { razorpay_order_id, razorpay_payment_id, razorpay_signature },
  keySecret
) {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(razorpay_signature || '', 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyPaymentSignature };
