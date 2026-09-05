(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function money(n) {
      return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    function statusBadge(status) {
      return '<span class="admin-status-badge admin-status-badge--' + status + '">' + status + '</span>';
    }

    function renderOrder(order, items) {
      var itemsHtml = items
        .map(function (li) {
          return '<li>' + li.qty + ' × ' + li.product_name + ' — ' + money(li.line_total) + '</li>';
        })
        .join('');

      return (
        '<div class="admin-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:start">' +
        '<div>' +
        '<strong>' + order.customer_name + '</strong> · ' + order.customer_phone +
        (order.customer_email ? ' · ' + order.customer_email : '') +
        (order.is_test_payment ? ' ' + statusBadge('test') : '') +
        '<p class="admin-note">' + order.address_line + ', ' + order.city + ', ' + order.state + ' — ' + order.pincode + '</p>' +
        '<p class="admin-note">Placed ' + new Date(order.created_at).toLocaleString('en-IN') + ' · Razorpay order ' + order.razorpay_order_id + '</p>' +
        '</div>' +
        '<div style="text-align:right">' +
        statusBadge(order.status) +
        '<p style="font-weight:600;margin:.4rem 0">' + money(order.grand_total) + '</p>' +
        '</div>' +
        '</div>' +
        '<ul>' + itemsHtml + '</ul>' +
        '<p class="admin-note">Subtotal ' + money(order.subtotal) + ' + delivery ' + money(order.shipping_fee) + '</p>' +
        '<div class="admin-form-row" style="max-width:220px">' +
        '<label>Status</label>' +
        '<select data-status-for="' + order.id + '">' +
        ['placed', 'cancelled', 'delivered']
          .map(function (s) {
            return '<option value="' + s + '"' + (s === order.status ? ' selected' : '') + '>' + s + '</option>';
          })
          .join('') +
        '</select>' +
        '</div>' +
        '</div>'
      );
    }

    function loadOrders() {
      client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .then(function (ordersRes) {
          if (ordersRes.error) { alert(ordersRes.error.message); return; }
          var orders = ordersRes.data;
          if (!orders.length) {
            document.getElementById('orders-list').innerHTML = '<p class="admin-note">No orders yet.</p>';
            return;
          }
          client
            .from('order_items')
            .select('*')
            .in('order_id', orders.map(function (o) { return o.id; }))
            .then(function (itemsRes) {
              if (itemsRes.error) { alert(itemsRes.error.message); return; }
              var itemsByOrder = {};
              itemsRes.data.forEach(function (li) {
                (itemsByOrder[li.order_id] = itemsByOrder[li.order_id] || []).push(li);
              });

              document.getElementById('orders-list').innerHTML = orders
                .map(function (o) { return renderOrder(o, itemsByOrder[o.id] || []); })
                .join('');

              Array.prototype.forEach.call(
                document.querySelectorAll('[data-status-for]'),
                function (select) {
                  select.addEventListener('change', function () {
                    client
                      .from('orders')
                      .update({ status: select.value, updated_at: new Date().toISOString() })
                      .eq('id', select.getAttribute('data-status-for'))
                      .then(function (res) {
                        if (res.error) { alert(res.error.message); return; }
                        loadOrders();
                      });
                  });
                }
              );
            });
        });
    }

    loadOrders();
  });
})();
