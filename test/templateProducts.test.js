const test = require('node:test');
const assert = require('node:assert/strict');
const { renderCatalogueHtml, productCard } = require('../api/_lib/templateProducts');

const SUPABASE_URL = 'https://example.supabase.co';

test('renders a plain-price product with no image', () => {
  const html = productCard(
    { id: '1', name: 'Plain Thing', category: 'misc', subcategory: '', price: 100, status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /data-cat="misc"/);
  assert.match(html, /data-product-id="1"/);
  assert.match(html, /<h3 class="product-name">Plain Thing<\/h3>/);
  assert.match(html, /<span class="price">₹100<\/span>/);
  assert.doesNotMatch(html, /<picture>/);
});

test('renders a sale price with strikethrough original', () => {
  const html = productCard(
    { id: '2', name: 'Sale Thing', category: 'candles', price: 175, original_price: 199, status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /<s>₹199<\/s>₹175<em>Sale<\/em>/);
});

test('renders a provisional price note', () => {
  const html = productCard(
    { id: '3', name: 'TBD Thing', category: 'candles', price: 555, is_provisional: true, status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /₹555<em style="color:var\(--brown\)">price to confirm<\/em>/);
  assert.match(html, /data-provisional="1"/);
});

test('renders a picture element when image_path is set', () => {
  const html = productCard(
    { id: '4', name: 'Photographed Thing', category: 'candles', price: 100, image_path: '4', status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /<picture>/);
  assert.match(html, new RegExp(`${SUPABASE_URL}/storage/v1/object/public/product-images/4/image\\.avif`));
});

test('escapes HTML in product name', () => {
  const html = productCard(
    { id: '5', name: '<script>alert(1)</script>', category: 'misc', price: 1, status: 'active' },
    SUPABASE_URL
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('renderCatalogueHtml wraps all cards in the catalogue grid', () => {
  const html = renderCatalogueHtml(
    [
      { id: '1', name: 'A', category: 'misc', price: 1, status: 'active' },
      { id: '2', name: 'B', category: 'misc', price: 2, status: 'active' },
    ],
    SUPABASE_URL
  );
  assert.match(html, /id="catalogue"/);
  assert.match(html, /data-product-id="1"/);
  assert.match(html, /data-product-id="2"/);
});
