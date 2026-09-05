(function () {
  'use strict';

  var SUPABASE_URL = 'https://lektufytmhaumsltyfxf.supabase.co';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3R1Znl0bWhhdW1zbHR5ZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDU4ODcsImV4cCI6MjEwNDE4MTg4N30.NjFKO-hgk5PrdM-di5lOGbFYVXLWJtKpl24ye3GKAmk';
  var SHIPPING_FEE = 300; // display only — the server (api/_lib/pricing.js) is authoritative

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function money(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  var cart = (window.SBTCart ? window.SBTCart.readCart() : []).filter(function (it) {
    return it.id;
  });

  var emptyEl = document.querySelector('[data-checkout-empty]');
  var contentEl = document.querySelector('[data-checkout-content]');
  var successEl = document.querySelector('[data-checkout-success]');

  if (!cart.length) {
    emptyEl.hidden = false;
    return;
  }
  contentEl.hidden = false;

  var latestTotals = null;

  function renderLines(products) {
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });

    var linesHtml = cart
      .map(function (it) {
        var p = byId[it.id];
        if (!p) return '';
        return (
          '<div class="line line--simple">' +
          '<div class="line-media" aria-hidden="true"></div>' +
          '<div class="line-body">' +
          '<h3 class="product-name">' + p.name + '</h3>' +
          '<p class="price">' + money(p.price) + ' × ' + it.qty + '</p>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    document.getElementById('checkout-lines').innerHTML = linesHtml;

    var subtotal = cart.reduce(function (sum, it) {
      var p = byId[it.id];
      return p ? sum + p.price * it.qty : sum;
    }, 0);
    var grandTotal = subtotal + SHIPPING_FEE;

    document.getElementById('co-subtotal').textContent = money(subtotal);
    document.getElementById('co-shipping').textContent = money(SHIPPING_FEE);
    document.getElementById('co-total').textContent = money(grandTotal);
    document.getElementById('pay-amount').textContent = money(grandTotal);

    latestTotals = { subtotal: subtotal, grandTotal: grandTotal };
  }

  client
    .from('products')
    .select('id, name, price, original_price, is_provisional')
    .in('id', cart.map(function (it) { return it.id; }))
    .then(function (res) {
      if (res.error) {
        document.getElementById('checkout-error').textContent = res.error.message;
        document.getElementById('checkout-error').hidden = false;
        return;
      }
      renderLines(res.data);
    });

  document.getElementById('checkout-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('checkout-error');
    errorEl.hidden = true;

    var customer = {
      name: document.getElementById('cf-name').value.trim(),
      phone: document.getElementById('cf-phone').value.trim(),
      email: document.getElementById('cf-email').value.trim() || null,
      address_line: document.getElementById('cf-address').value.trim(),
      city: document.getElementById('cf-city').value.trim(),
      state: document.getElementById('cf-state').value.trim(),
      pincode: document.getElementById('cf-pincode').value.trim(),
    };
    var items = cart.map(function (it) { return { product_id: it.id, qty: it.qty || 1 }; });

    var payBtn = document.getElementById('pay-btn');
    payBtn.disabled = true;

    fetch('/api/checkout/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items, customer: customer }),
    })
      .then(function (r) { return r.json(); })
      .then(function (order) {
        if (order.error) throw new Error(order.error);

        var rzp = new Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: 'INR',
          name: "Shreyaah's Bliss Trails",
          order_id: order.razorpay_order_id,
          prefill: { name: customer.name, email: customer.email || '', contact: customer.phone },
          handler: function (response) {
            fetch('/api/checkout/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                items: items,
                customer: customer,
              }),
            })
              .then(function (r) { return r.json(); })
              .then(function (result) {
                payBtn.disabled = false;
                if (result.error) {
                  errorEl.textContent = result.error;
                  errorEl.hidden = false;
                  return;
                }
                localStorage.removeItem(window.SBTCart.KEY_CART);
                contentEl.hidden = true;
                successEl.hidden = false;
                document.getElementById('co-order-id').textContent = result.order_id;
              })
              .catch(function (err) {
                payBtn.disabled = false;
                errorEl.textContent = err.message;
                errorEl.hidden = false;
              });
          },
          modal: {
            ondismiss: function () { payBtn.disabled = false; },
          },
        });
        rzp.open();
      })
      .catch(function (err) {
        payBtn.disabled = false;
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      });
  });
})();
