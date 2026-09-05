const SHIPPING_FEE = 300;

function computeTotals(cartItems, products) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  const byId = new Map(products.filter((p) => p.status === 'active').map((p) => [p.id, p]));

  const lineItems = cartItems.map((item) => {
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
      product_id: product.id,
      name: product.name,
      unit_price: unitPrice,
      qty,
      line_total: lineTotal,
    };
  });

  const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.line_total, 0) * 100) / 100;
  const grandTotal = Math.round((subtotal + SHIPPING_FEE) * 100) / 100;

  return { lineItems, subtotal, shippingFee: SHIPPING_FEE, grandTotal };
}

module.exports = { computeTotals, SHIPPING_FEE };
