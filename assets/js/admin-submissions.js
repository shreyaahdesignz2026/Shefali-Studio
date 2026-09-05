(function () {
  'use strict';

  var TYPE_LABELS = {
    service_booking: 'Service Booking',
    contact_individual: 'Individual Enquiry',
    contact_corporate: 'Corporate Enquiry',
    event_registration: 'Event Registration',
  };

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;
    var formTypes = window.SBT_FORM_TYPES || [];
    var rowsBody = document.getElementById('submission-rows');

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function withLineBreaks(s) {
      return escapeHtml(s).replace(/\n/g, '<br>');
    }

    function humanize(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function renderDetail(row) {
      var detailLines = Object.keys(row.details || {})
        .map(function (k) {
          return '<p class="admin-note"><strong>' + humanize(k) + ':</strong> ' + withLineBreaks(row.details[k]) + '</p>';
        })
        .join('');

      return (
        (formTypes.length > 1 ? '<p class="admin-note"><strong>Type:</strong> ' + escapeHtml(TYPE_LABELS[row.form_type] || row.form_type) + '</p>' : '') +
        (row.email ? '<p class="admin-note"><strong>Email:</strong> ' + escapeHtml(row.email) + '</p>' : '') +
        detailLines +
        (row.message ? '<p class="admin-note"><strong>Message:</strong><br>' + withLineBreaks(row.message) + '</p>' : '') +
        '<p class="admin-note">Submitted ' + new Date(row.created_at).toLocaleString('en-IN') + '</p>'
      );
    }

    function renderRows(rows) {
      rowsBody.innerHTML = rows
        .map(function (row, i) {
          return (
            '<tr class="admin-order-row" data-toggle-row="' + row.id + '">' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + escapeHtml(row.name) + '</td>' +
            '<td>' + escapeHtml(row.phone || '') + '</td>' +
            '<td>' + new Date(row.created_at).toLocaleDateString('en-IN') + '</td>' +
            '<td><button class="admin-btn admin-btn--danger" data-delete-row="' + row.id + '">Delete</button></td>' +
            '</tr>' +
            '<tr class="admin-order-detail" id="row-detail-' + row.id + '" hidden>' +
            '<td colspan="5">' + renderDetail(row) + '</td>' +
            '</tr>'
          );
        })
        .join('');

      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-toggle-row]'), function (tr) {
        tr.addEventListener('click', function () {
          var detail = document.getElementById('row-detail-' + tr.getAttribute('data-toggle-row'));
          detail.hidden = !detail.hidden;
        });
      });

      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-delete-row]'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!confirm('Delete this submission permanently?')) return;
          client
            .from('form_submissions')
            .delete()
            .eq('id', btn.getAttribute('data-delete-row'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              load();
            });
        });
      });
    }

    function load() {
      client
        .from('form_submissions')
        .select('*')
        .in('form_type', formTypes)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          if (!res.data.length) {
            rowsBody.innerHTML = '<tr><td colspan="5" class="admin-note">No submissions yet.</td></tr>';
            return;
          }
          renderRows(res.data);
        });
    }

    load();
  });
})();
