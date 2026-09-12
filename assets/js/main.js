
(function () {
  'use strict';

  var doc = document;
  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  var loader = $('#loader');
  if (loader) {
    doc.body.classList.add('is-loading');
    var loaderHidden = false;
    var hideLoader = function () {
      if (loaderHidden) return;
      loaderHidden = true;
      loader.classList.add('is-leaving');
      doc.body.classList.remove('is-loading');
      setTimeout(function () { loader.classList.add('is-hidden'); }, 1150);
    };
    if (doc.readyState === 'complete') {
      setTimeout(hideLoader, 2000);
    } else {
      window.addEventListener('load', function () { setTimeout(hideLoader, 2000); });
    }
    setTimeout(hideLoader, 5500);
  }

  var canCursor = $('.hero-illus') && window.matchMedia
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canCursor) {
    doc.documentElement.classList.add('has-custom-cursor');
    var cursorDot = doc.createElement('div');
    cursorDot.className = 'cursor-dot';
    var cursorRing = doc.createElement('div');
    cursorRing.className = 'cursor-ring';
    doc.body.appendChild(cursorDot);
    doc.body.appendChild(cursorRing);

    var mouseX = 0, mouseY = 0, ringX = 0, ringY = 0, cursorSeen = false;
    var cursorInteractiveSel = 'a, button, .pathway, .product, .card--lift, .event, .chip, .trail-tab, input, textarea, select, [role="button"]';

    doc.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';
      if (!cursorSeen) {
        cursorSeen = true;
        ringX = mouseX;
        ringY = mouseY;
        cursorDot.classList.add('is-visible');
        cursorRing.classList.add('is-visible');
      }
    });
    doc.addEventListener('mouseleave', function () {
      cursorDot.classList.remove('is-visible');
      cursorRing.classList.remove('is-visible');
    });
    doc.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(cursorInteractiveSel)) cursorRing.classList.add('is-active');
    });
    doc.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(cursorInteractiveSel)) cursorRing.classList.remove('is-active');
    });

    var tickCursor = function () {
      ringX += (mouseX - ringX) * .18;
      ringY += (mouseY - ringY) * .18;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top = ringY + 'px';
      requestAnimationFrame(tickCursor);
    };
    requestAnimationFrame(tickCursor);
  }

  var header = $('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

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

  var canTilt = $('.hero-illus') && window.matchMedia
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canTilt) {
    var initTilt = function (selector, opts) {
      opts = opts || {};
      var max = opts.max || 14;
      var scale = opts.scale || 1.045;
      var perspective = opts.perspective || 900;
      var layerSel = opts.layer;
      var layerAmount = opts.layerAmount || 16;

      $$(selector).forEach(function (el) {
        var layer = layerSel ? el.querySelector(layerSel) : null;

        el.addEventListener('mousemove', function (e) {
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          var rx = (0.5 - py) * max * 2;
          var ry = (px - 0.5) * max * 2;
          el.style.transition = 'transform .06s linear';
          el.style.transform = 'perspective(' + perspective + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + scale + ')';
          if (layer) {
            var lx = (px - 0.5) * layerAmount;
            var ly = (py - 0.5) * layerAmount;
            layer.style.transition = 'transform .06s linear';
            layer.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) scale(1.08)';
          }
        });

        el.addEventListener('mouseleave', function () {
          el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
          el.style.transform = '';
          if (layer) {
            layer.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
            layer.style.transform = '';
          }
        });
      });
    };

    initTilt('.pathway', { layer: '.n', max: 14, layerAmount: 12 });
    initTilt('.product', { layer: '.product-media img', max: 12, layerAmount: 14, scale: 1.035 });
    initTilt('.card--lift', { max: 14 });
    initTilt('.event', { layer: '.event-date', max: 10, layerAmount: 10 });
    initTilt('.map-parallax', { layer: 'img', max: 5, layerAmount: 8, scale: 1.015 });
  }

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

  var KEY_CART = 'sbt.cart';
  var KEY_WISH = 'sbt.wishlist';

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

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
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var memberSession = null;
  var memberWishCache = null;

  function getWish() {
    var localIdless = readWish().filter(function (it) { return !it.id; });
    if (memberSession && memberWishCache) return memberWishCache.concat(localIdless);
    return readWish();
  }

  function addWish(item) {
    if (memberSession && item.id) {
      return window.SBTMember.client
        .from('member_wishlist')
        .insert({ member_id: memberSession.user.id, product_id: item.id })
        .then(function (res) {
          if (!res.error) memberWishCache.push(item);
          return res;
        });
    }
    var l = readWish();
    l.push(item);
    write(KEY_WISH, l);
    return Promise.resolve({ error: null });
  }

  function removeWish(item) {
    if (memberSession && item.id) {
      return window.SBTMember.client
        .from('member_wishlist')
        .delete()
        .eq('member_id', memberSession.user.id)
        .eq('product_id', item.id)
        .then(function (res) {
          if (!res.error) {
            var i = indexOfName(memberWishCache, item);
            if (i > -1) memberWishCache.splice(i, 1);
          }
          return res;
        });
    }
    var l = readWish();
    var i = indexOfName(l, item);
    if (i > -1) l.splice(i, 1);
    write(KEY_WISH, l);
    return Promise.resolve({ error: null });
  }

  function paintWishButtons() {
    var list = getWish();
    $$('.wish').forEach(function (btn) {
      var wishItem = itemOf(btn, 'data-wish');
      btn.setAttribute('aria-pressed', indexOfName(list, wishItem) > -1 ? 'true' : 'false');
    });
  }

  function paintCounts() {
    var cart = readCart(), wish = getWish();
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
      toastEl.style.setProperty('--toast-top', (headerEl.getBoundingClientRect().height + 16) + 'px');
    }
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);

    var duration = Math.max(2600, Math.min(5500, msg.length * 60));
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, duration);
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
    btn.addEventListener('click', function () {
      var wishItem = itemOf(btn, 'data-wish');
      var pressed = btn.getAttribute('aria-pressed') === 'true';

      if (!pressed && !memberSession) {
        toast('Log in or create an account to save items to your wishlist');
        return;
      }

      (pressed ? removeWish(wishItem) : addWish(wishItem)).then(function (res) {
        if (res.error) { toast('Something went wrong — please try again'); return; }
        btn.setAttribute('aria-pressed', String(!pressed));
        toast(pressed ? 'Removed from wishlist' : 'Added to your wishlist — see it in the Wishlist tab from your Members Space');
        paintCounts();
        renderWishlist();
      });
    });
  });

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

  function lineRow(it, idx, kind) {
    var priceTxt = it.price == null
      ? '<span class="muted small">Price on request</span>'
      : money(it.price) + (it.provisional ? ' <em class="tiny" style="color:var(--brown);font-style:normal">to confirm</em>' : '');

    var qtyCell = kind === 'cart' && it.item_type !== 'gift_card'
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
        (it.label ? '<p class="product-cat">' + escapeHtml(it.label) + '</p>' : '') +
        '<h3 class="product-name">' + escapeHtml(it.name) + '</h3>' +
        '<p class="price" style="font-size:1rem">' + priceTxt + '</p>' +
      '</div>' +
      qtyCell + lineTotal +
      '<button type="button" class="line-remove" data-remove="' + idx + '" data-kind="' + kind + '" aria-label="Remove ' + escapeHtml(it.name) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>';
  }

  function bindLineActions(root, kind) {
    $$('[data-remove]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.getAttribute('data-remove'), 10);
        if (kind === 'cart') {
          var cart = readCart();
          var removed = cart.splice(idx, 1)[0];
          write(KEY_CART, cart);
          paintCounts();
          renderCart();
          toast((removed ? removed.name : 'Item') + ' removed');
          return;
        }
        var wish = getWish();
        var removedWish = wish[idx];
        removeWish(removedWish).then(function (res) {
          if (res.error) { toast('Something went wrong — please try again'); return; }
          paintCounts();
          renderWishlist();
          toast((removedWish ? removedWish.name : 'Item') + ' removed');
        });
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
    var list = getWish();
    var empty = $('[data-wishlist-empty]');

    if (!list.length) {
      root.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    root.innerHTML = list.map(function (it, i) { return lineRow(it, i, 'wish'); }).join('');
    bindLineActions(root, 'wish');

    $$('[data-move-cart]', root.parentNode).forEach(function (b) {
      b.addEventListener('click', function () {
        var wish = getWish(), cart = readCart();
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
  paintWishButtons();
  renderCart();
  renderWishlist();

  if (window.SBTMember) {
    window.SBTMember.getSession(function (session) {
      if (!session) return;
      memberSession = session;

      function loadMemberWish() {
        return window.SBTMember.client
          .from('member_wishlist')
          .select('product_id, products(id, name, price, is_provisional, category, subcategory)')
          .eq('member_id', session.user.id)
          .then(function (res) {
            if (res.error) return;
            memberWishCache = res.data
              .filter(function (row) { return row.products; })
              .map(function (row) {
                var p = row.products;
                return {
                  id: p.id,
                  name: p.name,
                  price: p.price,
                  label: p.subcategory || p.category || '',
                  provisional: !!p.is_provisional,
                  qty: 1,
                };
              });
            paintCounts();
            paintWishButtons();
            renderWishlist();
          });
      }

      var mergeFlag = 'sbt.wish.merged.' + session.user.id;
      var alreadyMerged = false;
      try { alreadyMerged = localStorage.getItem(mergeFlag) === '1'; } catch (e) {}

      if (alreadyMerged) { loadMemberWish(); return; }

      var localIdItems = readWish().filter(function (it) { return it.id; });
      var mergePromise = localIdItems.length
        ? window.SBTMember.client.from('member_wishlist').upsert(
            localIdItems.map(function (it) { return { member_id: session.user.id, product_id: it.id }; }),
            { onConflict: 'member_id,product_id', ignoreDuplicates: true }
          )
        : Promise.resolve({ error: null });

      mergePromise.then(function () {
        try {
          write(KEY_WISH, readWish().filter(function (it) { return !it.id; }));
          localStorage.setItem(mergeFlag, '1');
        } catch (e) {}
        loadMemberWish();
      });
    });
  }

  $$('.category-scroll').forEach(function (wrap) {
    var track = $('.tabs', wrap);
    if (!track) return;
    $$('[data-scroll-cat]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-scroll-cat') === 'prev' ? -1 : 1;
        track.scrollBy({ left: dir * 160, behavior: 'smooth' });
      });
    });
  });

  var runProductSearch = null;

  (function () {
    var group = $('[data-filter-group]');
    if (!group) return;
    var btns = $$('[data-filter]', group);
    var targetSel = group.getAttribute('data-filter-group');
    var searchQuery = '';

    function applyFilters() {
      var activeBtn = btns.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0];
      var cat = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
      var q = searchQuery.trim().toLowerCase();
      var items = $$(targetSel + ' [data-cat]');
      var visible = 0;
      items.forEach(function (item) {
        var matchesCat = cat === 'all' || item.getAttribute('data-cat') === cat;
        var matchesQuery = true;
        if (q) {

          var nameEl = item.querySelector('.product-name');
          var haystack = (nameEl ? nameEl.textContent : '').toLowerCase();
          matchesQuery = haystack.indexOf(q) > -1;
        }
        var show = matchesCat && matchesQuery;
        item.hidden = !show;
        if (show) visible++;
      });
      var out = $('[data-filter-count]');
      if (out) out.textContent = visible;
      var note = $('[data-search-note]');
      if (note) {
        if (q) {
          note.textContent = '';
          note.appendChild(doc.createTextNode('Showing results for "' + searchQuery.trim() + '" '));
          var clearBtn = doc.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'search-clear';
          clearBtn.setAttribute('aria-label', 'Clear search and show all products');
          clearBtn.textContent = '✕ Clear';
          clearBtn.addEventListener('click', clearProductSearch);
          note.appendChild(clearBtn);
          note.hidden = false;
        } else {
          note.hidden = true;
        }
      }
    }

    function clearProductSearch() {
      searchQuery = '';
      $$('.search-form[data-search-scope="products"] input[name="q"]').forEach(function (input) { input.value = ''; });
      applyFilters();
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        applyFilters();
      });
    });

    var applyHash = function () {
      var id = location.hash.slice(1);
      if (!id) return;
      var btn = group.querySelector('#' + CSS.escape(id) + '[data-filter]');
      if (btn) btn.click();
    };
    window.addEventListener('hashchange', applyHash);
    applyHash();
    applyFilters();

    runProductSearch = function (query) {
      searchQuery = query;
      applyFilters();
      setTimeout(function () {
        var scrollTarget = $('.category-scroll') || group;
        var headerEl = doc.querySelector('.site-header');
        var headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
        var top = scrollTarget.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }, 60);
    };
  })();

  var SERVICE_SEARCH_INDEX = [
    { anchor: '#oracle', keywords: ['oracle', 'oracle card reading', 'oracle card reading based consultation'] },
    { anchor: '#intro', keywords: ['intro', 'introductory', 'introductory consultation', 'consultation — introductory'] },
    { anchor: '#discussion', keywords: ['discussion', 'consultation & discussion', 'consultation and discussion'] },
    { anchor: '#dhyan-sutras-i', keywords: ['dhyan sutras i', 'dhyan sutras 1'] },
    { anchor: '#dhyan-sutras-ii', keywords: ['dhyan sutras', 'dhyan sutras ii', 'dhyan sutras 2'] },
    { anchor: '#bff', keywords: ['b.f.f.', 'bff'] },
    { anchor: '#beyond-the-pages', keywords: ['beyond the pages'] },
    { anchor: '#animal-kingdom', keywords: ['lessons from the animal kingdom', 'animal kingdom'] },
    { anchor: '#meet-and-jam', keywords: ['meet & jam', 'jam & chill', 'meet and jam', 'jam and chill'] },
    { anchor: '#moon-circle', keywords: ['moon circle'] },
    { anchor: '#drum-circle', keywords: ['drum circle'] },
    { anchor: '#services-sound-healing', keywords: ['sound healing'] },
    { anchor: '#services-art-therapy', keywords: ['art therapy'] },
    { anchor: '#craft-therapy', keywords: ['craft therapy'] },
    { anchor: '#yoga-movement-circles', keywords: ['yoga & movement circles', 'yoga and movement circles', 'yoga'] },
    { anchor: '#services-mindful-parenting', keywords: ['mindful parenting dialogues', 'mindful parenting'] },
    { anchor: '#journaling-vision-board', keywords: ['journaling & vision-board circles', 'journaling', 'vision board', 'vision-board'] },
    { anchor: '#custom', keywords: ['custom collaborations', 'corporate'] },
  ];

  var EVENT_SEARCH_INDEX = [
    { anchor: '#alaap', keywords: ['alaap'] },
    { anchor: '#rotary', keywords: ['rotary', 'pay it forward'] },
    { anchor: '#geetu', keywords: ['beyond the pages with geetu', 'beyond the pages', 'geetu'] },
    { anchor: '#event-bff', keywords: ['b.f.f.', 'bff', 'books, films & fandoms', 'books films fandoms'] },
    { anchor: '#kala-bhava', keywords: ['kalā bhāva', 'kala bhava', 'art therapy'] },
    { anchor: '#nada-ananda', keywords: ['nāda ananda', 'nada ananda', 'sound healing'] },
    { anchor: '#events-mindful-parenting', keywords: ['curious about — mindful parenting', 'mindful parenting'] },
    { anchor: '#events-yoga-intro', keywords: ['curious about — yoga', 'yoga? an honest introduction', 'yoga'] },
    { anchor: '#past', keywords: ['past events'] },
  ];

  function findAnchorMatch(index, query) {
    var q = query.trim().toLowerCase();
    if (!q) return null;
    var best = null;
    index.forEach(function (entry) {
      entry.keywords.forEach(function (kw) {
        if (kw.indexOf(q) > -1 || q.indexOf(kw) > -1) {
          if (!best || kw.length > best.matchLen) best = { anchor: entry.anchor, matchLen: kw.length };
        }
      });
    });
    return best ? best.anchor : null;
  }

  function scrollToAnchor(anchor) {
    var el = doc.querySelector(anchor);
    if (!el) return false;
    var headerEl = doc.querySelector('.site-header');
    var headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
    var top = el.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
    window.scrollTo({ top: top, behavior: 'smooth' });
    return true;
  }

  $$('.search-form').forEach(function (form) {
    var scope = form.getAttribute('data-search-scope');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[name="q"]');
      var query = input ? input.value.trim() : '';
      if (!query) return;

      if (scope === 'products' && runProductSearch) {
        closeSearch();
        runProductSearch(query);
        return;
      }

      if (scope === 'services' || scope === 'events') {
        var index = scope === 'services' ? SERVICE_SEARCH_INDEX : EVENT_SEARCH_INDEX;
        var anchor = findAnchorMatch(index, query);
        closeSearch();
        if (anchor && scrollToAnchor(anchor)) {
          toast('Showing results for "' + query + '"');
        } else {
          toast('No ' + (scope === 'services' ? 'session' : 'event') + ' found matching "' + query + '"');
        }
      }
    });
  });

  $$('form[data-demo-form]:not([data-capture-form]):not(.search-form)').forEach(function (form) {
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

  $$('form[data-capture-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.disabled) return;
      if (submitBtn) submitBtn.disabled = true;

      var formType = form.getAttribute('data-capture-form');
      var fields = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        fields[el.name] = el.value;
      });

      var note = form.querySelector('[data-form-note]');

      function send(headers) {
        return fetch('/api/enquiries', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ form_type: formType, fields: fields }),
        })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (submitBtn) submitBtn.disabled = false;
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
            if (submitBtn) submitBtn.disabled = false;
            toast("Something went wrong — please send your details on WhatsApp or email instead");
          });
      }

      if (window.SBTMember) {
        window.SBTMember.getSession(function (session) {
          var headers = { 'Content-Type': 'application/json' };
          if (session) headers.Authorization = 'Bearer ' + session.access_token;
          send(headers);
        });
      } else {
        send({ 'Content-Type': 'application/json' });
      }
    });
  });

  var giftOther = $('#gift-other');
  if (giftOther) {
    $$('input[name="gift-amount"]').forEach(function (r) {
      r.addEventListener('change', function () {
        giftOther.hidden = r.value !== 'other';
        if (r.value === 'other') { var i = giftOther.querySelector('input'); if (i) i.focus(); }
      });
    });
  }

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

  $$('[data-events-nav]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-events-nav');
      $$('[data-events-nav]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      $$('[data-events-panel]').forEach(function (p) {
        p.hidden = p.getAttribute('data-events-panel') !== id;
      });
    });
  });

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  window.SBTCart = {
    readCart: readCart,
    KEY_CART: KEY_CART,

    addItem: function (item) {
      var cart = readCart();
      cart.push(item);
      write(KEY_CART, cart);
      paintCounts();
      return cart;
    },
  };
})();
