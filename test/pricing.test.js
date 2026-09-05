const test = require('node:test');
const assert = require('node:assert/strict');
const { computeTotals, SHIPPING_FEE } = require('../api/_lib/pricing');

const PRODUCTS = [
  { id: 'p1', name: 'Cranberry Orange Fresh', price: 175, status: 'active' },
  { id: 'p2', name: 'Massage Candle', price: 555, status: 'active' },
  { id: 'p3', name: 'Archived Thing', price: 100, status: 'archived' },
];

test('computes subtotal, flat shipping, and grand total for multiple items', () => {
  const result = computeTotals(
    [{ product_id: 'p1', qty: 2 }, { product_id: 'p2', qty: 1 }],
    PRODUCTS
  );
  assert.equal(result.subtotal, 175 * 2 + 555);
  assert.equal(result.shippingFee, 300);
  assert.equal(result.grandTotal, 175 * 2 + 555 + 300);
  assert.equal(result.lineItems.length, 2);
  assert.deepEqual(result.lineItems[0], {
    product_id: 'p1',
    name: 'Cranberry Orange Fresh',
    unit_price: 175,
    qty: 2,
    line_total: 350,
  });
});

test('SHIPPING_FEE constant is 300', () => {
  assert.equal(SHIPPING_FEE, 300);
});

test('throws when a product_id is not found', () => {
  assert.throws(
    () => computeTotals([{ product_id: 'does-not-exist', qty: 1 }], PRODUCTS),
    /not found/
  );
});

test('throws when a product is archived', () => {
  assert.throws(
    () => computeTotals([{ product_id: 'p3', qty: 1 }], PRODUCTS),
    /not found/
  );
});

test('throws on zero or negative qty', () => {
  assert.throws(() => computeTotals([{ product_id: 'p1', qty: 0 }], PRODUCTS), /qty/);
  assert.throws(() => computeTotals([{ product_id: 'p1', qty: -1 }], PRODUCTS), /qty/);
});

test('throws on an empty cart', () => {
  assert.throws(() => computeTotals([], PRODUCTS), /empty/);
});

test('rounds line and grand totals to 2 decimal places', () => {
  const products = [{ id: 'p4', name: 'Odd Price', price: 33.333, status: 'active' }];
  const result = computeTotals([{ product_id: 'p4', qty: 3 }], products);
  assert.equal(result.lineItems[0].line_total, 100);
  assert.equal(result.subtotal, 100);
});
