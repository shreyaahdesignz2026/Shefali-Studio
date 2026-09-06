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

    function withLineBreaks(s) {
      return escapeHtml(s).replace(/\n/g, '<br>');
    }

    function statusBadge(status) {
      return '<span class="admin-status-badge admin-status-badge--' + status + '">' + escapeHtml(status) + '</span>';
    }

    function renderDetail(gc) {
      return (
        '<div style="display:grid; gap:1.25rem; grid-template-columns: 1fr 1fr;">' +
        '<div>' +
        '<h4 style="margin:0 0 .5rem">Card</h4>' +
        '<p class="admin-note"><strong>Amount:</strong> ' + money(gc.amount) + '</p>' +
        '<p class="admin-note"><strong>Status:</strong> ' + statusBadge(gc.status) + '</p>' +
        '<p class="admin-note"><strong>Issued:</strong> ' + new Date(gc.created_at).toLocaleString('en-IN') + '</p>' +
        (gc.status === 'redeemed'
          ? '<p class="admin-note"><strong>Redeemed:</strong> ' + new Date(gc.redeemed_at).toLocaleString('en-IN') + '</p>'
          : '') +
        '<p class="admin-note" style="margin-top:.75rem"><strong>Code</strong></p>' +
        '<p style="font-family:monospace;font-size:1.1rem;letter-spacing:2px;background:#F6F1E6;padding:.6rem .8rem;border-radius:6px;display:inline-block">' + escapeHtml(gc.code) + '</p>' +
        '</div>' +

        '<div>' +
        '<h4 style="margin:0 0 .5rem">Recipient</h4>' +
        '<p class="admin-note">' + escapeHtml(gc.recipient_name) + '<br>' + escapeHtml(gc.recipient_email) + '</p>' +

        '<h4 style="margin:1rem 0 .5rem">Sender</h4>' +
        '<p class="admin-note">' + escapeHtml(gc.sender_name) +
        (gc.sender_phone ? '<br>' + escapeHtml(gc.sender_phone) : '') +
        (gc.sender_email ? '<br>' + escapeHtml(gc.sender_email) : '') + '</p>' +

        '<h4 style="margin:1rem 0 .5rem">Message</h4>' +
        '<p class="admin-note">' + (gc.message ? withLineBreaks(gc.message) : '<em>None</em>') + '</p>' +
        '</div>' +
        '</div>'
      );
    }

    function renderRows(giftCards) {
      var tbody = document.getElementById('gift-card-rows');
      if (!giftCards.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-note">No gift cards issued yet.</td></tr>';
        return;
      }

      tbody.innerHTML = giftCards
        .map(function (gc) {
          return (
            '<tr class="admin-order-row" data-toggle-gift-card="' + gc.id + '">' +
            '<td>' + gc.serial + '</td>' +
            '<td>' + escapeHtml(gc.recipient_name) + '</td>' +
            '<td>' + money(gc.amount) + '</td>' +
            '<td>' + statusBadge(gc.status) + '</td>' +
            '<td>' + new Date(gc.created_at).toLocaleDateString('en-IN') + '</td>' +
            '</tr>' +
            '<tr class="admin-order-detail" id="gift-card-detail-' + gc.id + '" hidden>' +
            '<td colspan="5">' + renderDetail(gc) + '</td>' +
            '</tr>'
          );
        })
        .join('');

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-toggle-gift-card]'), function (row) {
        row.addEventListener('click', function () {
          var id = row.getAttribute('data-toggle-gift-card');
          var detail = document.getElementById('gift-card-detail-' + id);
          detail.hidden = !detail.hidden;
        });
      });
    }

    function loadGiftCards() {
      client
        .from('gift_cards')
        .select('*')
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) {
            document.getElementById('gift-card-rows').innerHTML =
              '<tr><td colspan="5" class="admin-error">' + escapeHtml(res.error.message) + '</td></tr>';
            return;
          }
          renderRows(res.data);
        });
    }

    loadGiftCards();
  });
})();
