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
  function paintCounts() {
    var c = read(KEY_CART).length, w = read(KEY_WISH).length;
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
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  $$('[data-add-cart]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-add-cart');
      var cart = read(KEY_CART);
      cart.push(name);
      write(KEY_CART, cart);
      paintCounts();
      toast(name + ' added to your cart');
    });
  });

  $$('.wish').forEach(function (btn) {
    var name = btn.getAttribute('data-wish');
    var list = read(KEY_WISH);
    if (name && list.indexOf(name) > -1) btn.setAttribute('aria-pressed', 'true');
    btn.addEventListener('click', function () {
      var l = read(KEY_WISH);
      var i = l.indexOf(name);
      if (i > -1) { l.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); toast('Removed from wishlist'); }
      else { l.push(name); btn.setAttribute('aria-pressed', 'true'); toast('Saved to your wishlist'); }
      write(KEY_WISH, l);
      paintCounts();
    });
  });

  paintCounts();

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

  /* ---------- "load more" reveal for long product grids ---------- */
  $$('[data-load-more]').forEach(function (btn) {
    var sel = btn.getAttribute('data-load-more');
    btn.addEventListener('click', function () {
      $$(sel).forEach(function (el) { el.hidden = false; });
      btn.hidden = true;
    });
  });

  /* ---------- enquiry / booking forms ----------
     No backend is connected yet, so forms confirm locally and
     point the visitor at WhatsApp or email instead of silently failing. */
  $$('form[data-demo-form]').forEach(function (form) {
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
})();
