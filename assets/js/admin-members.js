(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function authedFetch(url, options) {
      return client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;
        options = options || {};
        options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + token });
        return fetch(url, options).then(function (r) {
          return r.json().then(function (json) {
            return { status: r.status, json: json };
          });
        });
      });
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function money(n) {
      return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    function planLabel(plan) {
      return plan === 'artisoul_member' ? 'Artisoul Member' : 'Free Tier';
    }

    function planBadge(plan) {
      return '<span class="admin-status-badge admin-status-badge--' + plan + '">' + planLabel(plan) + '</span>';
    }

    function renderAddresses(addresses) {
      if (!addresses.length) return '<p class="admin-note">No saved addresses.</p>';
      return (
        '<ul style="margin:.5rem 0; padding-left:1.1rem;">' +
        addresses
          .map(function (a) {
            return (
              '<li class="admin-note">' +
              (a.label ? '<strong>' + escapeHtml(a.label) + ':</strong> ' : '') +
              escapeHtml(a.name) + ', ' + escapeHtml(a.phone) + '<br>' +
              escapeHtml(a.address_line) + ', ' + escapeHtml(a.city) + ', ' + escapeHtml(a.state) + ' — ' + escapeHtml(a.pincode) +
              '</li>'
            );
          })
          .join('') +
        '</ul>'
      );
    }

    function renderOrders(orders) {
      if (!orders.length) return '<p class="admin-note">No orders yet.</p>';
      return (
        '<ul style="margin:.5rem 0; padding-left:1.1rem;">' +
        orders
          .map(function (o) {
            return (
              '<li class="admin-note">#' + o.order_number + ' — ' + money(o.grand_total) + ' ' +
              '<span class="admin-status-badge admin-status-badge--' + o.status + '">' + o.status + '</span>' +
              ' — ' + new Date(o.created_at).toLocaleDateString('en-IN') +
              '</li>'
            );
          })
          .join('') +
        '</ul>'
      );
    }

    function renderDetail(member) {
      return (
        '<div style="display:grid; gap:1.25rem; grid-template-columns: 1fr 1fr;">' +
        '<div>' +
        '<h4 style="margin:0 0 .5rem">Profile</h4>' +
        '<form data-edit-form="' + member.id + '">' +
        '<div class="admin-form-row"><label>Display name</label><input type="text" data-field="display_name" value="' + escapeHtml(member.display_name || '') + '"></div>' +
        '<div class="admin-form-row"><label>Phone</label><input type="tel" data-field="phone" value="' + escapeHtml(member.phone || '') + '"></div>' +
        '<div class="admin-form-row"><label>Note</label><textarea data-field="note" rows="2">' + escapeHtml(member.note || '') + '</textarea></div>' +
        '<div class="admin-form-row"><label>Membership plan</label>' +
        '<select data-field="plan">' +
        ['free_tier', 'artisoul_member']
          .map(function (p) {
            return '<option value="' + p + '"' + (p === member.plan ? ' selected' : '') + '>' + planLabel(p) + '</option>';
          })
          .join('') +
        '</select></div>' +
        '<button class="admin-btn" type="submit">Save</button> ' +
        '<button class="admin-btn admin-btn--danger" type="button" data-delete-member="' + member.id + '">Delete member</button>' +
        '<p class="admin-error" data-edit-error hidden></p>' +
        '<p class="admin-note" data-edit-success hidden></p>' +
        '</form>' +

        '<h4 style="margin:1rem 0 .5rem">Login data</h4>' +
        '<p class="admin-note">Email: ' + escapeHtml(member.email) + '</p>' +
        '<div class="admin-form-row"><label>Set a specific password</label>' +
        '<div style="display:flex;gap:.5rem">' +
        '<input type="text" data-new-password minlength="8" placeholder="At least 8 characters" style="flex:1">' +
        '<button class="admin-btn admin-btn--ghost" type="button" data-set-password="' + member.id + '">Set</button>' +
        '</div></div>' +
        '<button class="admin-btn admin-btn--ghost" data-reset-login="' + member.id + '">Or reset to a random password</button>' +
        '<p class="admin-note" data-reset-result hidden></p>' +
        '</div>' +

        '<div>' +
        '<h4 style="margin:0 0 .5rem">Saved addresses</h4>' +
        '<div data-addresses-for="' + member.id + '"><p class="admin-note">Loading…</p></div>' +
        '<h4 style="margin:1rem 0 .5rem">Past orders</h4>' +
        '<div data-orders-for="' + member.id + '"><p class="admin-note">Loading…</p></div>' +
        '</div>' +
        '</div>'
      );
    }

    function wireDetail(member) {
      var detailEl = document.getElementById('member-detail-' + member.id);

      var form = detailEl.querySelector('[data-edit-form]');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var errorEl = form.querySelector('[data-edit-error]');
        var successEl = form.querySelector('[data-edit-success]');
        errorEl.hidden = true;
        successEl.hidden = true;

        var body = {
          display_name: form.querySelector('[data-field="display_name"]').value.trim() || null,
          phone: form.querySelector('[data-field="phone"]').value.trim() || null,
          note: form.querySelector('[data-field="note"]').value.trim() || null,
          plan: form.querySelector('[data-field="plan"]').value,
        };

        authedFetch('/api/admin/members?id=' + encodeURIComponent(member.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(function (res) {
          if (res.json.error) {
            errorEl.textContent = res.json.error;
            errorEl.hidden = false;
            return;
          }
          successEl.textContent = 'Saved.';
          successEl.hidden = false;
          loadMembers();
        });
      });

      detailEl.querySelector('[data-delete-member]').addEventListener('click', function () {
        if (!confirm('Delete this member permanently? They will lose access immediately and this cannot be undone.')) return;
        authedFetch('/api/admin/members?id=' + encodeURIComponent(member.id), { method: 'DELETE' }).then(function (res) {
          if (res.json.error) { alert(res.json.error); return; }
          loadMembers();
        });
      });

      detailEl.querySelector('[data-set-password]').addEventListener('click', function () {
        var input = detailEl.querySelector('[data-new-password]');
        var password = input.value;
        var resultEl = detailEl.querySelector('[data-reset-result]');
        if (password.length < 8) {
          resultEl.textContent = 'Password must be at least 8 characters.';
          resultEl.hidden = false;
          return;
        }
        authedFetch('/api/admin/members?id=' + encodeURIComponent(member.id) + '&action=set-password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password }),
        }).then(function (res) {
          if (res.json.error) {
            resultEl.textContent = res.json.error;
            resultEl.hidden = false;
            return;
          }
          input.value = '';
          resultEl.textContent = 'Password set. Share it with them now — it will not be shown again.';
          resultEl.hidden = false;
        });
      });

      detailEl.querySelector('[data-reset-login]').addEventListener('click', function () {
        if (!confirm('Reset this member\'s password? Their current password will stop working immediately.')) return;
        authedFetch('/api/admin/members?id=' + encodeURIComponent(member.id) + '&action=reset-login', {
          method: 'PATCH',
        }).then(function (res) {
          var resultEl = detailEl.querySelector('[data-reset-result]');
          if (res.json.error) {
            resultEl.textContent = res.json.error;
            resultEl.hidden = false;
            return;
          }
          resultEl.textContent = 'New temporary password: ' + res.json.temporary_password + ' — share this with them now, it will not be shown again.';
          resultEl.hidden = false;
        });
      });
    }

    function loadDetailData(member) {
      client
        .from('member_addresses')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: true })
        .then(function (res) {
          var el = document.querySelector('[data-addresses-for="' + member.id + '"]');
          if (!el) return;
          if (res.error) { el.innerHTML = '<p class="admin-error">' + escapeHtml(res.error.message) + '</p>'; return; }
          el.innerHTML = renderAddresses(res.data);
        });

      client
        .from('orders')
        .select('id, order_number, grand_total, status, created_at')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          var el = document.querySelector('[data-orders-for="' + member.id + '"]');
          if (!el) return;
          if (res.error) { el.innerHTML = '<p class="admin-error">' + escapeHtml(res.error.message) + '</p>'; return; }
          el.innerHTML = renderOrders(res.data);
        });
    }

    function renderRows(members) {
      var tbody = document.getElementById('member-rows');
      if (!members.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-note">No members yet.</td></tr>';
        return;
      }

      tbody.innerHTML = members
        .map(function (m, i) {
          return (
            '<tr class="admin-order-row" data-toggle-member="' + m.id + '">' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + escapeHtml(m.email) + '</td>' +
            '<td>' + escapeHtml(m.display_name || '') + '</td>' +
            '<td>' + planBadge(m.plan) + '</td>' +
            '<td>' + new Date(m.created_at).toLocaleDateString('en-IN') + '</td>' +
            '</tr>' +
            '<tr class="admin-order-detail" id="member-detail-' + m.id + '" hidden>' +
            '<td colspan="5">' + renderDetail(m) + '</td>' +
            '</tr>'
          );
        })
        .join('');

      members.forEach(function (m) {
        wireDetail(m);
      });

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-toggle-member]'), function (row) {
        row.addEventListener('click', function () {
          var id = row.getAttribute('data-toggle-member');
          var detail = document.getElementById('member-detail-' + id);
          detail.hidden = !detail.hidden;
          if (!detail.hidden) {
            var member = members.filter(function (m) { return m.id === id; })[0];
            loadDetailData(member);
          }
        });
      });
    }

    function loadMembers() {
      authedFetch('/api/admin/members').then(function (res) {
        if (res.json.error) { alert(res.json.error); return; }
        renderRows(res.json.members);
      });
    }

    document.getElementById('add-member-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn.disabled) return;

      var errorEl = document.getElementById('add-error');
      var successEl = document.getElementById('add-success');
      errorEl.hidden = true;
      successEl.hidden = true;

      var password = document.getElementById('new-password').value;
      if (password && password.length < 8) {
        errorEl.textContent = 'Password must be at least 8 characters.';
        errorEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;

      var body = {
        email: document.getElementById('new-email').value.trim(),
        display_name: document.getElementById('new-display-name').value.trim() || null,
        phone: document.getElementById('new-phone').value.trim() || null,
        plan: document.getElementById('new-plan').value,
        password: password || undefined,
      };

      authedFetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (res) {
        submitBtn.disabled = false;
        if (res.json.error) {
          errorEl.textContent = res.json.error;
          errorEl.hidden = false;
          return;
        }
        document.getElementById('add-member-form').reset();
        successEl.textContent = res.json.temporary_password
          ? 'Created ' + res.json.member.email + '. Password: ' + res.json.temporary_password + ' — share this with them now, it will not be shown again.'
          : 'Enrolled ' + res.json.member.email + ' (existing account, no new password).';
        successEl.hidden = false;
        loadMembers();
      });
    });

    loadMembers();
  });
})();
