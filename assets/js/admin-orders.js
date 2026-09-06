(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function money(n) {
      return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    function statusBadge(status) {
      return '<span class="admin-status-badge admin-status-badge--' + status + '">' + status + '</span>';
    }

    function withLineBreaks(s) {
      return escapeHtml(s).replace(/\n/g, '<br>');
    }

    function renderDetail(order, items, giftCardsByItem) {
      var itemsHtml = items
        .map(function (li) {
          var giftCard = giftCardsByItem[li.id];
          var giftCardDetails = '';
          if (li.item_type === 'gift_card' && giftCard) {
            giftCardDetails =
              '<div class="admin-note" style="margin:.35rem 0 .5rem;padding:.5rem .7rem;background:#F6F1E6;border-radius:6px">' +
              '<strong>Recipient:</strong> ' + escapeHtml(giftCard.recipient_name) + ' — ' + escapeHtml(giftCard.recipient_email) + '<br>' +
              '<strong>Sender:</strong> ' + escapeHtml(giftCard.sender_name) +
              (giftCard.sender_phone ? ' — ' + escapeHtml(giftCard.sender_phone) : '') +
              (giftCard.sender_email ? ' — ' + escapeHtml(giftCard.sender_email) : '') + '<br>' +
              '<strong>Code:</strong> <span style="font-family:monospace">' + escapeHtml(giftCard.code) + '</span> (' + escapeHtml(giftCard.status) + ')' +
              (giftCard.message ? '<br><strong>Message:</strong> ' + withLineBreaks(giftCard.message) : '') +
              '</div>';
          }
          return '<li>' + li.qty + ' × ' + escapeHtml(li.product_name) + ' — ' + money(li.line_total) + giftCardDetails + '</li>';
        })
        .join('');

      var walletLine = Number(order.wallet_amount_used) > 0
        ? '<p class="admin-note">Wallet applied: ' + money(order.wallet_amount_used) + '</p>'
        : '';

      return (
        '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:1rem">' +
        '<div>' +
        (order.customer_email ? '<p class="admin-note">Email: ' + escapeHtml(order.customer_email) + '</p>' : '') +
        '<p class="admin-note">' + escapeHtml(order.address_line) + ', ' + escapeHtml(order.city) + ', ' + escapeHtml(order.state) + ' — ' + escapeHtml(order.pincode) + '</p>' +
        '<p class="admin-note">Placed ' + new Date(order.created_at).toLocaleString('en-IN') +
        (order.razorpay_order_id ? ' · Razorpay order ' + escapeHtml(order.razorpay_order_id) : ' · Paid entirely from wallet') + '</p>' +
        walletLine +
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

    function renderRows(orders, itemsByOrder, giftCardsByItem) {
      var tbody = document.getElementById('orders-rows');
      tbody.innerHTML = orders
        .map(function (o, i) {
          return (
            '<tr class="admin-order-row" data-toggle-order="' + o.id + '">' +
            '<td>' + (i + 1) + '</td>' +
            '<td>#' + o.order_number + '</td>' +
            '<td>' + escapeHtml(o.customer_name) + '</td>' +
            '<td>' + escapeHtml(o.customer_phone) + '</td>' +
            '<td>' + money(o.grand_total) + ' ' + statusBadge(o.status) + '</td>' +
            '<td><button class="admin-btn admin-btn--danger" data-delete-order="' + o.id + '">Delete</button></td>' +
            '</tr>' +
            '<tr class="admin-order-detail" id="order-detail-' + o.id + '" hidden>' +
            '<td colspan="6">' + renderDetail(o, itemsByOrder[o.id] || [], giftCardsByItem) + '</td>' +
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

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-delete-order]'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!confirm('Delete this order permanently? This cannot be undone.')) return;
          client
            .from('orders')
            .delete()
            .eq('id', btn.getAttribute('data-delete-order'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              loadOrders();
            });
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
              '<tr><td colspan="6" class="admin-note">No orders yet.</td></tr>';
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

              var giftCardItemIds = itemsRes.data
                .filter(function (li) { return li.item_type === 'gift_card'; })
                .map(function (li) { return li.id; });
              if (!giftCardItemIds.length) {
                renderRows(orders, itemsByOrder, {});
                return;
              }
              client
                .from('gift_cards')
                .select('*')
                .in('order_item_id', giftCardItemIds)
                .then(function (giftCardsRes) {
                  var giftCardsByItem = {};
                  (giftCardsRes.data || []).forEach(function (gc) {
                    giftCardsByItem[gc.order_item_id] = gc;
                  });
                  renderRows(orders, itemsByOrder, giftCardsByItem);
                });
            });
        });
    }

    loadOrders();
  });
})();
