/* Shreyaah's Bliss Trails — shared behaviour */
(function () {
  'use strict';

  var doc = document;
  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  /* ---------- sticky header shadow ---------- */
  var header = $('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile drawer ---------- */
  var drawer = $('#drawer');
  var scrim  = $('#scrim');
  var lastFocus = null;

  function openDrawer() {
    if (!drawer) return;
    lastFocus = doc.activeElement;
    drawer.classList.add('is-open');
    if (scrim) scrim.classList.add('is-open');
    doc.body.classList.add('no-scroll');
    drawer.setAttribute('aria-hidden', 'false');
    var f = drawer.querySelector('a, button');
    if (f) f.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-open');
    doc.body.classList.remove('no-scroll');
    drawer.setAttribute('aria-hidden', 'true');
    if (lastFocus) lastFocus.focus();
  }
  $$('[data-open-menu]').forEach(function (b) { b.addEventListener('click', openDrawer); });
  $$('[data-close-menu]').forEach(function (b) { b.addEventListener('click', closeDrawer); });
  if (scrim) scrim.addEventListener('click', function () { closeDrawer(); closeSearch(); });

  /* ---------- search panel ---------- */
  var search = $('#search-panel');
  function openSearch() {
    if (!search) return;
    search.classList.add('is-open');
    if (scrim) scrim.classList.add('is-open');
    search.setAttribute('aria-hidden', 'false');
    var i = search.querySelector('input');
    if (i) setTimeout(function () { i.focus(); }, 120);
  }
  function closeSearch() {
    if (!search) return;
    search.classList.remove('is-open');
    if (scrim && !(drawer && drawer.classList.contains('is-open'))) scrim.classList.remove('is-open');
    search.setAttribute('aria-hidden', 'true');
  }
  $$('[data-open-search]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openSearch(); });
  });
  $$('[data-close-search]').forEach(function (b) { b.addEventListener('click', closeSearch); });

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); closeSearch(); }
  });

  /* ---------- accordions ---------- */
  $$('.acc-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      var group = btn.closest('[data-acc-group]');
      if (group && !open) {
        $$('.acc-btn[aria-expanded="true"]', group).forEach(function (o) {
          o.setAttribute('aria-expanded', 'false');
        });
      }
      btn.setAttribute('aria-expanded', String(!open));
    });
  });

  /* ---------- tabs ---------- */
  $$('[data-tabs]').forEach(function (group) {
    var tabs = $$('.tab', group);
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.setAttribute('aria-selected', 'false');
          var p = doc.getElementById(t.getAttribute('aria-controls'));
          if (p) p.hidden = true;
        });
        tab.setAttribute('aria-selected', 'true');
        var panel = doc.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = false;
      });
      tab.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(tab);
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft')  n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { e.preventDefault(); n.focus(); n.click(); }
      });
    });
  });

  /* ---------- reveal on scroll ---------- */
  var reveals = $$('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  /* ---------- anchor nav active state ---------- */
  var anchorNav = $('.anchor-nav');
  if (anchorNav) {
    var links = $$('a[href^="#"]', anchorNav);
    var targets = links.map(function (a) { return doc.getElementById(a.getAttribute('href').slice(1)); })
                       .filter(Boolean);
    if (targets.length && 'IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
          });
        });
      }, { rootMargin: '-25% 0px -68% 0px' });
      targets.forEach(function (t) { sio.observe(t); });
    }
  }

  /* ==========================================================
     Cart / wishlist — front-end demo state held in localStorage.
     No checkout exists yet; these record intent only.
     ========================================================== */
  var KEY_CART = 'sbt.cart';
  var KEY_WISH = 'sbt.wishlist';

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  /* Entries are {name, price, label, qty}. Anything saved by an older version
     was a bare name string, so normalise on read rather than discarding it. */
  function normalise(list) {
    return (list || []).map(function (it) {
      if (typeof it === 'string') return { name: it, price: null, label: '', qty: 1 };
      it.qty = it.qty || 1;
      return it;
    });
  }
  function readCart() { return normalise(read(KEY_CART)); }
  function readWish() { return normalise(read(KEY_WISH)); }

  function itemOf(btn, attr) {
    var price = btn.getAttribute('data-price');
    return {
      id: btn.getAttribute('data-product-id') || null,
      name: btn.getAttribute(attr),
      price: price ? parseFloat(price.replace(/,/g, '')) : null,
      label: btn.getAttribute('data-label') || '',
      provisional: btn.getAttribute('data-provisional') === '1',
      qty: 1
    };
  }
  function indexOfName(list, item) {
    var id = typeof item === 'string' ? null : item.id;
    var name = typeof item === 'string' ? item : item.name;
    for (var i = 0; i < list.length; i++) {
      if (id && list[i].id === id) return i;
      if (!list[i].id && list[i].name === name) return i;
    }
    return -1;
  }
  function money(n) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function paintCounts() {
    var cart = readCart(), wish = readWish();
    var c = cart.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
    var w = wish.length;
    $$('[data-count="cart"]').forEach(function (b) { b.textContent = c; b.hidden = c === 0; });
    $$('[data-count="wishlist"]').forEach(function (b) { b.textContent = w; b.hidden = w === 0; });
  }

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span></span>';
      doc.body.appendChild(toastEl);
    }
    var headerEl = doc.querySelector('.site-header');
    if (headerEl) {
      toastEl.style.top = (headerEl.getBoundingClientRect().height + 16) + 'px';
    }
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  $$('[data-add-cart]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = itemOf(btn, 'data-add-cart');
      var cart = readCart();
      var i = indexOfName(cart, item);
      if (i > -1) cart[i].qty = (cart[i].qty || 1) + 1;
      else cart.push(item);
      write(KEY_CART, cart);
      paintCounts();
      renderCart();
      toast(item.name + ' added to your cart');
    });
  });

  $$('.wish').forEach(function (btn) {
    var name = btn.getAttribute('data-wish');
    if (name && indexOfName(readWish(), name) > -1) btn.setAttribute('aria-pressed', 'true');
    btn.addEventListener('click', function () {
      var l = readWish();
      var wishItem = itemOf(btn, 'data-wish');
      var i = indexOfName(l, wishItem);
      if (i > -1) { l.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); toast('Removed from wishlist'); }
      else { l.push(wishItem); btn.setAttribute('aria-pressed', 'true'); toast('Saved to your wishlist'); }
      write(KEY_WISH, l);
      paintCounts();
      renderWishlist();
    });
  });

  /* ---------- product photo slider ---------- */
  $$('[data-slide-nav]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var slider = btn.closest('[data-slider]');
      if (!slider) return;
      var slides = $$('.slide', slider);
      var dots = $$('.slider-dots span', slider);
      var current = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
      var dir = btn.getAttribute('data-slide-nav') === 'next' ? 1 : -1;
      var next = (current + dir + slides.length) % slides.length;
      slides[current].classList.remove('is-active');
      slides[next].classList.add('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      if (dots[next]) dots[next].classList.add('is-active');
    });
  });

  /* ==========================================================
     Cart and wishlist pages. Both render from the same
     localStorage the header badges count, so they always agree.
     ========================================================== */
  function lineRow(it, idx, kind) {
    var priceTxt = it.price == null
      ? '<span class="muted small">Price on request</span>'
      : money(it.price) + (it.provisional ? ' <em class="tiny" style="color:var(--brown);font-style:normal">to confirm</em>' : '');
    var qtyCell = kind === 'cart'
      ? '<div class="qty">' +
          '<button type="button" class="qty-btn" data-qty="-1" data-i="' + idx + '" aria-label="Decrease quantity">&minus;</button>' +
          '<span class="qty-n">' + (it.qty || 1) + '</span>' +
          '<button type="button" class="qty-btn" data-qty="1" data-i="' + idx + '" aria-label="Increase quantity">+</button>' +
        '</div>'
      : '';
    var lineTotal = kind === 'cart'
      ? '<div class="line-total">' + (it.price != null ? money(it.price * (it.qty || 1)) : '') + '</div>'
      : '';

    return '<div class="line' + (kind === 'cart' ? '' : ' line--simple') + '">' +
      '<div class="line-media" aria-hidden="true"></div>' +
      '<div class="line-body">' +
        (it.label ? '<p class="product-cat">' + it.label + '</p>' : '') +
        '<h3 class="product-name">' + it.name + '</h3>' +
        '<p class="price" style="font-size:1rem">' + priceTxt + '</p>' +
      '</div>' +
      qtyCell + lineTotal +
      '<button type="button" class="line-remove" data-remove="' + idx + '" data-kind="' + kind + '" aria-label="Remove ' + it.name + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>';
  }

  function bindLineActions(root, kind) {
    $$('[data-remove]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var key = kind === 'cart' ? KEY_CART : KEY_WISH;
        var list = kind === 'cart' ? readCart() : readWish();
        var removed = list.splice(parseInt(b.getAttribute('data-remove'), 10), 1)[0];
        write(key, list);
        paintCounts();
        kind === 'cart' ? renderCart() : renderWishlist();
        toast((removed ? removed.name : 'Item') + ' removed');
      });
    });
    $$('[data-qty]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var cart = readCart();
        var i = parseInt(b.getAttribute('data-i'), 10);
        if (!cart[i]) return;
        cart[i].qty = (cart[i].qty || 1) + parseInt(b.getAttribute('data-qty'), 10);
        if (cart[i].qty < 1) cart.splice(i, 1);
        write(KEY_CART, cart);
        paintCounts();
        renderCart();
      });
    });
  }

  function renderCart() {
    var root = $('[data-cart-page]');
    if (!root) return;
    var cart = readCart();
    var empty = $('[data-cart-empty]');
    var summary = $('[data-cart-summary]');

    if (!cart.length) {
      root.innerHTML = '';
      if (empty) empty.hidden = false;
      if (summary) summary.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (summary) summary.hidden = false;

    root.innerHTML = cart.map(function (it, i) { return lineRow(it, i, 'cart'); }).join('');
    bindLineActions(root, 'cart');

    var priced = cart.filter(function (i) { return i.price != null; });
    var subtotal = priced.reduce(function (s, i) { return s + i.price * (i.qty || 1); }, 0);
    var unpriced = cart.length - priced.length;
    var provisional = cart.filter(function (i) { return i.provisional; }).length;

    var sub = $('[data-subtotal]');
    if (sub) sub.textContent = money(subtotal);

    // ₹555 is a placeholder for lines with no price on record — never let it
    // read as a confirmed figure just because it lands in a subtotal.
    var note = $('[data-subtotal-note]');
    if (note) {
      var msgs = [];
      if (provisional) {
        msgs.push(provisional + (provisional === 1 ? ' item uses' : ' items use') +
          ' a provisional placeholder price, so this total is not final.');
      }
      if (unpriced) {
        msgs.push(unpriced + (unpriced === 1 ? ' item has' : ' items have') +
          ' no price on record and is not included.');
      }
      note.hidden = msgs.length === 0;
      note.textContent = msgs.join(' ');
    }
  }

  function renderWishlist() {
    var root = $('[data-wishlist-page]');
    if (!root) return;
    var list = readWish();
    var empty = $('[data-wishlist-empty]');

    if (!list.length) {
      root.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    root.innerHTML = list.map(function (it, i) { return lineRow(it, i, 'wish'); }).join('');
    bindLineActions(root, 'wish');

    // "move to cart" on the wishlist page
    $$('[data-move-cart]', root.parentNode).forEach(function (b) {
      b.addEventListener('click', function () {
        var wish = readWish(), cart = readCart();
        wish.forEach(function (it) {
          var i = indexOfName(cart, it);
          if (i > -1) cart[i].qty = (cart[i].qty || 1) + 1;
          else cart.push(Object.assign({}, it, { qty: 1 }));
        });
        write(KEY_CART, cart);
        paintCounts();
        toast('Moved ' + wish.length + ' item' + (wish.length === 1 ? '' : 's') + ' to your cart');
      });
    });
  }

  paintCounts();
  renderCart();
  renderWishlist();

  /* ---------- product filtering ---------- */
  $$('[data-filter-group]').forEach(function (group) {
    var btns = $$('[data-filter]', group);
    var targetSel = group.getAttribute('data-filter-group');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-filter');
        btns.forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        $$(targetSel + ' [data-cat]').forEach(function (item) {
          var show = val === 'all' || item.getAttribute('data-cat') === val;
          item.hidden = !show;
        });
        var visible = $$(targetSel + ' [data-cat]').filter(function (i) { return !i.hidden; }).length;
        var out = $('[data-filter-count]');
        if (out) out.textContent = visible;
      });
    });
  });

  /* Arriving at /products#candles should open that category, not just jump. */
  (function () {
    var group = $('[data-filter-group]');
    if (!group) return;
    var applyHash = function () {
      var id = location.hash.slice(1);
      if (!id) return;
      var btn = group.querySelector('#' + CSS.escape(id) + '[data-filter]');
      if (btn) btn.click();
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
  })();

  /* ---------- enquiry / booking forms with no backend ----------
     These still just confirm locally and point the visitor at WhatsApp
     or email. Forms with data-capture-form (below) are handled instead
     by their own handler, since those actually reach a backend now. */
  $$('form[data-demo-form]:not([data-capture-form])').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = form.querySelector('[data-form-note]');
      if (note) {
        note.hidden = false;
        note.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast('Details captured — please also send them via WhatsApp or email');
    });
  });

  /* ---------- booking/enquiry/registration forms — sent to the admin panel ---------- */
  $$('form[data-capture-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var formType = form.getAttribute('data-capture-form');
      var fields = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        fields[el.name] = el.value;
      });

      var note = form.querySelector('[data-form-note]');

      fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_type: formType, fields: fields }),
      })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json.error) {
            toast("Something went wrong — please send your details on WhatsApp or email instead");
            return;
          }
          form.reset();
          if (note) {
            note.hidden = false;
            note.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          toast("Thank you — we've received your details");
        })
        .catch(function () {
          toast("Something went wrong — please send your details on WhatsApp or email instead");
        });
    });
  });

  /* ---------- gift card amount picker ---------- */
  var giftOther = $('#gift-other');
  if (giftOther) {
    $$('input[name="gift-amount"]').forEach(function (r) {
      r.addEventListener('change', function () {
        giftOther.hidden = r.value !== 'other';
        if (r.value === 'other') { var i = giftOther.querySelector('input'); if (i) i.focus(); }
      });
    });
  }

  /* ---------- members space section switching ---------- */
  $$('[data-member-nav]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var id = link.getAttribute('data-member-nav');
      $$('[data-member-nav]').forEach(function (l) { l.classList.toggle('is-active', l === link); });
      $$('[data-member-panel]').forEach(function (p) {
        p.hidden = p.getAttribute('data-member-panel') !== id;
      });
      var panel = $('[data-member-panel="' + id + '"]');
      if (panel && window.innerWidth < 900) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- current year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  window.SBTCart = { readCart: readCart, KEY_CART: KEY_CART };
})();
