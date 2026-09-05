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

    function renderDetail(order, items) {
      var itemsHtml = items
        .map(function (li) {
          return '<li>' + li.qty + ' × ' + li.product_name + ' — ' + money(li.line_total) + '</li>';
        })
        .join('');

      return (
        '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:1rem">' +
        '<div>' +
        (order.customer_email ? '<p class="admin-note">Email: ' + order.customer_email + '</p>' : '') +
        '<p class="admin-note">' + order.address_line + ', ' + order.city + ', ' + order.state + ' — ' + order.pincode + '</p>' +
        '<p class="admin-note">Placed ' + new Date(order.created_at).toLocaleString('en-IN') + ' · Razorpay order ' + order.razorpay_order_id + '</p>' +
        '</div>' +
        '<div style="text-align:right">' +
        (order.is_test_payment ? statusBadge('test') : '') +
        '<p class="admin-note">Subtotal ' + money(order.subtotal) + ' + delivery ' + money(order.shipping_fee) + '</p>' +
        '</div>' +
        '</div>' +
        '<ul style="margin:.75rem 0">' + itemsHtml + '</ul>' +
        '<div class="admin-form-row" style="max-width:220px">' +
        '<label>Status</label>' +
        '<select data-status-for="' + order.id + '">' +
        ['placed', 'cancelled', 'delivered']
          .map(function (s) {
            return '<option value="' + s + '"' + (s === order.status ? ' selected' : '') + '>' + s + '</option>';
          })
          .join('') +
        '</select>' +
        '</div>'
      );
    }

    function renderRows(orders, itemsByOrder) {
      var tbody = document.getElementById('orders-rows');
      tbody.innerHTML = orders
        .map(function (o, i) {
          return (
            '<tr class="admin-order-row" data-toggle-order="' + o.id + '">' +
            '<td>' + (i + 1) + '</td>' +
            '<td>#' + o.order_number + '</td>' +
            '<td>' + o.customer_name + '</td>' +
            '<td>' + o.customer_phone + '</td>' +
            '<td>' + money(o.grand_total) + ' ' + statusBadge(o.status) + '</td>' +
            '</tr>' +
            '<tr class="admin-order-detail" id="order-detail-' + o.id + '" hidden>' +
            '<td colspan="5">' + renderDetail(o, itemsByOrder[o.id] || []) + '</td>' +
            '</tr>'
          );
        })
        .join('');

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-toggle-order]'), function (row) {
        row.addEventListener('click', function () {
          var detail = document.getElementById('order-detail-' + row.getAttribute('data-toggle-order'));
          detail.hidden = !detail.hidden;
        });
      });

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-status-for]'), function (select) {
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
      });
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
            document.getElementById('orders-rows').innerHTML =
              '<tr><td colspan="5" class="admin-note">No orders yet.</td></tr>';
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
              renderRows(orders, itemsByOrder);
            });
        });
    }

    loadOrders();
  });
})();
