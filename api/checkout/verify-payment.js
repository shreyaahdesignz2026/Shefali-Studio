const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { computeTotals } = require('../_lib/pricing');
const { verifyPaymentSignature } = require('../_lib/razorpaySignature');

function isTestKey() {
  return (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    items,
    customer,
  } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing Razorpay payment fields' });
  }
  if (!customer || !customer.name || !customer.phone || !customer.address_line ||
      !customer.city || !customer.state || !customer.pincode) {
    return res.status(400).json({ error: 'Missing customer details' });
  }

  const validSignature = verifyPaymentSignature(
    { razorpay_order_id, razorpay_payment_id, razorpay_signature },
    process.env.RAZORPAY_KEY_SECRET
  );
  if (!validSignature) {
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, status')
    .in('id', items.map((i) => i.product_id));
  if (productsError) return res.status(500).json({ error: productsError.message });

  let totals;
  try {
    totals = computeTotals(items, products);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      is_test_payment: isTestKey(),
      status: 'placed',
      subtotal: totals.subtotal,
      shipping_fee: totals.shippingFee,
      grand_total: totals.grandTotal,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email || null,
      address_line: customer.address_line,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    })
    .select()
    .single();
  if (orderError) return res.status(500).json({ error: orderError.message });

  const orderItems = totals.lineItems.map((li) => ({
    order_id: order.id,
    product_id: li.product_id,
    product_name: li.name,
    unit_price: li.unit_price,
    qty: li.qty,
    line_total: li.line_total,
  }));
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  return res.status(200).json({ ok: true, order_id: order.id });
};
