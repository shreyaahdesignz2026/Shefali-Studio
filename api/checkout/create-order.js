const Razorpay = require('razorpay');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { computeTotals } = require('../_lib/pricing');
const { getOptionalMember } = require('../_lib/memberAuth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, use_wallet } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const supabase = getSupabaseAdmin();
  const productIds = items.filter((i) => i.item_type !== 'gift_card').map((i) => i.product_id);
  const { data: products, error } = productIds.length
    ? await supabase.from('products').select('id, name, price, status').in('id', productIds)
    : { data: [], error: null };
  if (error) return res.status(500).json({ error: error.message });

  let totals;
  try {
    totals = computeTotals(items, products);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  let walletAmount = 0;
  if (use_wallet) {
    const member = await getOptionalMember(req.headers.authorization);
    if (member) {
      const { data: row, error: memberError } = await supabase
        .from('members')
        .select('wallet_balance')
        .eq('id', member.id)
        .maybeSingle();
      if (memberError) return res.status(500).json({ error: memberError.message });
      const balance = row ? Number(row.wallet_balance) : 0;
      walletAmount = Math.round(Math.min(balance, totals.grandTotal) * 100) / 100;
    }
  }

  const remainder = Math.round((totals.grandTotal - walletAmount) * 100) / 100;

  if (remainder <= 0) {
    return res.status(200).json({
      zero_amount: true,
      wallet_amount: walletAmount,
      grand_total: totals.grandTotal,
    });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const amountInPaise = Math.round(remainder * 100);

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
      wallet_amount: walletAmount,
      grand_total: totals.grandTotal,
    });
  } catch (e) {
    return res.status(500).json({ error: `Razorpay order creation failed: ${e.message}` });
  }
};
