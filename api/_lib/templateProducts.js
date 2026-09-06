function money(n) {
  const num = Number(n);
  return (
    '₹' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: num % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function slideMarkup(slug, product, isActive) {
  // Served through /api/img rather than Supabase Storage's public URL
  // directly -- Vercel's edge cache absorbs repeat requests for this
  // immutable, content-addressed slug instead of every visitor's browser
  // hitting Supabase's storage egress on every page view.
  const base = `/api/img?p=${product.id}&f=${slug}`;
  return (
    `<picture class="slide${isActive ? ' is-active' : ''}">` +
    `<source srcset="${base}.avif" type="image/avif">` +
    `<source srcset="${base}.webp" type="image/webp">` +
    `<img src="${base}.jpg" alt="${escapeHtml(product.name)}" loading="lazy" width="300" height="400">` +
    '</picture>'
  );
}

function mediaMarkup(product) {
  const images = product.images || [];
  if (!images.length) return '';

  const slides = images.map((img, i) => slideMarkup(img.slug, product, i === 0)).join('');

  if (images.length === 1) {
    return `<div class="product-slider">${slides}</div>`;
  }

  const dots = images.map((_, i) => `<span${i === 0 ? ' class="is-active"' : ''}></span>`).join('');

  return (
    '<div class="product-slider" data-slider>' +
    slides +
    '<button class="slider-nav slider-nav--prev" type="button" data-slide-nav="prev" aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
    '<button class="slider-nav slider-nav--next" type="button" data-slide-nav="next" aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>' +
    `<div class="slider-dots">${dots}</div>` +
    '</div>'
  );
}

function priceMarkup(product) {
  if (product.is_provisional) {
    return `<span class="price">${money(product.price)}<em style="color:var(--brown)">price to confirm</em></span>`;
  }
  if (product.original_price != null && Number(product.original_price) > Number(product.price)) {
    return `<span class="price"><s>${money(product.original_price)}</s>${money(product.price)}<em>Sale</em></span>`;
  }
  return `<span class="price">${money(product.price)}</span>`;
}

function productCard(product) {
  const name = escapeHtml(product.name);
  const label = escapeHtml(product.subcategory || '');
  const provisionalAttr = product.is_provisional ? ' data-provisional="1"' : '';
  const hasPhoto = (product.images || []).length > 0;

  return (
    `<article class="product" data-cat="${escapeHtml(product.category)}">` +
    `<div class="product-media${hasPhoto ? ' has-photo' : ''}">` +
    mediaMarkup(product) +
    (product.subcategory ? `<span class="product-tag">${label}</span>` : '') +
    `<button class="wish" type="button" data-wish="${name}" data-price="${product.price}" data-label="${label}" data-product-id="${product.id}"${provisionalAttr} aria-label="Save ${name} to wishlist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>` +
    '</div>' +
    '<div class="product-body">' +
    (product.subcategory ? `<p class="product-cat">${label}</p>` : '') +
    `<h3 class="product-name">${name}</h3>` +
    (product.description ? `<p class="product-desc">${escapeHtml(product.description)}</p>` : '') +
    '<div class="product-foot">' +
    priceMarkup(product) +
    `<button class="btn btn--ghost btn--sm" type="button" data-add-cart="${name}" data-price="${product.price}" data-label="${label}" data-product-id="${product.id}"${provisionalAttr}>Add</button>` +
    '</div>' +
    '</div>' +
    '</article>'
  );
}

function renderCatalogueHtml(products) {
  return (
    '<div class="grid grid-auto mt-3" id="catalogue">\n' +
    products.map((p) => productCard(p)).join('\n') +
    '\n</div>'
  );
}

module.exports = { renderCatalogueHtml, productCard, money, escapeHtml };
