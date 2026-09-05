const Razorpay = require('razorpay');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { computeTotals } = require('../_lib/pricing');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, status')
    .in('id', items.map((i) => i.product_id));
  if (error) return res.status(500).json({ error: error.message });

  let totals;
  try {
    totals = computeTotals(items, products);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const amountInPaise = Math.round(totals.grandTotal * 100);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      notes: { source: 'shreyaahs-bliss-trails-checkout' },
    });
    return res.status(200).json({
      razorpay_order_id: order.id,
      amount: amountInPaise,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return res.status(500).json({ error: `Razorpay order creation failed: ${e.message}` });
  }
};
