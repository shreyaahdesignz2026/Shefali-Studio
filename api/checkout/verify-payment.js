const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { computeTotals } = require('../_lib/pricing');
const { verifyPaymentSignature } = require('../_lib/razorpaySignature');
const { getOptionalMember } = require('../_lib/memberAuth');
const { generateGiftCardCode } = require('../_lib/giftCards');
const { orderConfirmationEmail, giftCardEmail, adminNotificationEmail } = require('../_lib/emailTemplates');
const { sendEmail } = require('../_lib/email');

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'shreyaahdesignz2026@gmail.com';
const MAX_CODE_ATTEMPTS = 5;

function isTestKey() {
  return (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
}

async function insertGiftCard(supabase, { orderId, orderItemId, memberId, giftCardData, createdAt }) {

  let lastError;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateGiftCardCode();
    const { data, error } = await supabase
      .from('gift_cards')
      .insert({
        order_id: orderId,
        order_item_id: orderItemId,
        code,
        amount: giftCardData.amount,
        sender_name: giftCardData.sender_name,
        sender_email: giftCardData.sender_email,
        sender_phone: giftCardData.sender_phone,
        recipient_name: giftCardData.recipient_name,
        recipient_email: giftCardData.recipient_email,
        message: giftCardData.message,
        purchaser_member_id: memberId,
      })
      .select()
      .single();
    if (!error) return { ...data, created_at: data.created_at || createdAt };
    lastError = error;
    if (error.code !== '23505') break;
  }
  throw new Error(`Could not issue gift card code: ${lastError.message}`);
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
    use_wallet,
  } = req.body || {};

  if (!customer || !customer.name || !customer.phone || !customer.email || !customer.address_line ||
      !customer.city || !customer.state || !customer.pincode) {
    return res.status(400).json({ error: 'Missing customer details' });
  }

  const member = await getOptionalMember(req.headers.authorization);

  const supabase = getSupabaseAdmin();
  const productIds = (items || []).filter((i) => i.item_type !== 'gift_card').map((i) => i.product_id);
  const { data: products, error: productsError } = productIds.length
    ? await supabase.from('products').select('id, name, price, status').in('id', productIds)
    : { data: [], error: null };
  if (productsError) return res.status(500).json({ error: productsError.message });

  let totals;
  try {
    totals = computeTotals(items, products);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  let walletAmount = 0;
  if (use_wallet && member) {
    const { data: row, error: memberError } = await supabase
      .from('members')
      .select('wallet_balance')
      .eq('id', member.id)
      .maybeSingle();
    if (memberError) return res.status(500).json({ error: memberError.message });
    const balance = row ? Number(row.wallet_balance) : 0;
    walletAmount = Math.round(Math.min(balance, totals.grandTotal) * 100) / 100;
  }
  const remainder = Math.round((totals.grandTotal - walletAmount) * 100) / 100;

  if (remainder > 0) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing Razorpay payment fields' });
    }
    const validSignature = verifyPaymentSignature(
      { razorpay_order_id, razorpay_payment_id, razorpay_signature },
      process.env.RAZORPAY_KEY_SECRET
    );
    if (!validSignature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }
  } else if (walletAmount > 0) {

    const { error: deductError } = await supabase.rpc('deduct_wallet', {
      p_member_id: member.id,
      p_amount: walletAmount,
    });
    if (deductError) {
      return res.status(400).json({ error: `Wallet charge failed: ${deductError.message}` });
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      razorpay_order_id: razorpay_order_id || null,
      razorpay_payment_id: razorpay_payment_id || null,
      razorpay_signature: razorpay_signature || null,
      is_test_payment: remainder > 0 ? isTestKey() : false,
      status: 'placed',
      subtotal: totals.subtotal,
      shipping_fee: totals.shippingFee,
      grand_total: totals.grandTotal,
      wallet_amount_used: walletAmount,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email,
      address_line: customer.address_line,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      member_id: member ? member.id : null,
    })
    .select()
    .single();
  if (orderError) return res.status(500).json({ error: orderError.message });

  const orderItemsPayload = totals.lineItems.map((li) => ({
    order_id: order.id,
    item_type: li.item_type,
    product_id: li.product_id,
    product_name: li.name,
    unit_price: li.unit_price,
    qty: li.qty,
    line_total: li.line_total,
  }));
  const { data: insertedItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload)
    .select();
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  if (walletAmount > 0 && remainder > 0) {
    const { error: deductError } = await supabase.rpc('deduct_wallet', {
      p_member_id: member.id,
      p_amount: walletAmount,
    });
    if (deductError) console.error('Wallet deduction after paid order failed:', deductError.message);
  }

  const issuedGiftCards = [];
  for (let i = 0; i < totals.lineItems.length; i++) {
    const li = totals.lineItems[i];
    if (li.item_type !== 'gift_card') continue;
    try {
      const giftCard = await insertGiftCard(supabase, {
        orderId: order.id,
        orderItemId: insertedItems[i] ? insertedItems[i].id : null,
        memberId: member ? member.id : null,
        giftCardData: li.gift_card,
        createdAt: order.created_at,
      });
      issuedGiftCards.push(giftCard);
    } catch (e) {
      console.error('Gift card issuance failed:', e.message);
    }
  }

  const responseOrder = {
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address_line: order.address_line,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    items: totals.lineItems,
    subtotal: totals.subtotal,
    shipping_fee: totals.shippingFee,
    wallet_amount_used: walletAmount,
    grand_total: totals.grandTotal,
  };

  if (responseOrder.customer.email) {
    try {
      const { subject, html } = orderConfirmationEmail(responseOrder);
      await sendEmail({ to: responseOrder.customer.email, subject, html });
    } catch (e) {
      console.error('Order confirmation email failed:', e.message);
    }
  }

  for (const giftCard of issuedGiftCards) {
    try {
      const { subject, html } = giftCardEmail(giftCard);
      await sendEmail({ to: giftCard.recipient_email, subject, html });
    } catch (e) {
      console.error('Gift card recipient email failed:', e.message);
    }
  }

  try {
    const { subject, html } = adminNotificationEmail('order', { order: responseOrder });
    await sendEmail({ to: ADMIN_NOTIFICATION_EMAIL, subject, html });
  } catch (e) {
    console.error('Admin order notification email failed:', e.message);
  }

  return res.status(200).json({
    ok: true,
    order_id: order.id,
    order: responseOrder,
  });
};
