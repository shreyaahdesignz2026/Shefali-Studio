const { GIFT_CARD_MIN_AMOUNT } = require('./giftCards');

const SHIPPING_FEE = 300;

function buildGiftCardLine(item) {
  const amount = Math.round(Number(item.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < GIFT_CARD_MIN_AMOUNT) {
    throw new Error(`Invalid gift card amount: ${item.amount}`);
  }
  if (!item.recipient_name || !item.recipient_email) {
    throw new Error('Gift card recipient name and email are required');
  }
  if (!item.sender_name) {
    throw new Error('Gift card sender name is required');
  }
  return {
    item_type: 'gift_card',
    product_id: null,
    name: `E-Bliss Gift Card — for ${item.recipient_name}`,
    unit_price: amount,
    qty: 1,
    line_total: amount,
    gift_card: {
      amount,
      recipient_name: item.recipient_name,
      recipient_email: item.recipient_email,
      sender_name: item.sender_name,
      sender_email: item.sender_email || null,
      sender_phone: item.sender_phone || null,
      message: item.message || null,
    },
  };
}

function buildProductLine(item, byId) {
  const product = byId.get(item.product_id);
  if (!product) {
    throw new Error(`Product not found or inactive: ${item.product_id}`);
  }
  const qty = Number(item.qty);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`Invalid qty for product ${item.product_id}: ${item.qty}`);
  }
  const unitPrice = Number(product.price);
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;
  return {
    item_type: 'product',
    product_id: product.id,
    name: product.name,
    unit_price: unitPrice,
    qty,
    line_total: lineTotal,
  };
}

function computeTotals(cartItems, products) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  const byId = new Map(products.filter((p) => p.status === 'active').map((p) => [p.id, p]));

  const lineItems = cartItems.map((item) =>
    item.item_type === 'gift_card' ? buildGiftCardLine(item) : buildProductLine(item, byId)
  );

  const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.line_total, 0) * 100) / 100;
  // A gift card is delivered by email -- only charge shipping when the cart
  // also has at least one physical product in it.
  const hasPhysicalItem = lineItems.some((li) => li.item_type === 'product');
  const shippingFee = hasPhysicalItem ? SHIPPING_FEE : 0;
  const grandTotal = Math.round((subtotal + shippingFee) * 100) / 100;

  return { lineItems, subtotal, shippingFee, grandTotal };
}

module.exports = { computeTotals, SHIPPING_FEE };
