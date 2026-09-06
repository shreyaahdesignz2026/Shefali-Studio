(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;
    var myRole = null;
    var myId = null;

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

    function roleLabel(role) {
      return role === 'superadmin' ? 'Super Admin' : 'Admin';
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function renderRows(admins) {
      var tbody = document.getElementById('admin-rows');
      tbody.innerHTML = admins
        .map(function (a) {
          var isSelf = a.id === myId;
          var roleControl;
          if (myRole === 'superadmin' && !isSelf) {
            roleControl =
              '<select data-role-for="' + a.id + '">' +
              ['admin', 'superadmin']
                .map(function (r) {
                  return '<option value="' + r + '"' + (r === a.role ? ' selected' : '') + '>' + roleLabel(r) + '</option>';
                })
                .join('') +
              '</select>';
          } else {
            roleControl =
              '<span class="admin-status-badge admin-status-badge--' + a.role + '">' + roleLabel(a.role) + '</span>';
          }

          var kickControl = '';
          if (myRole === 'superadmin' && !isSelf) {
            kickControl = '<button class="admin-btn admin-btn--danger" data-kick="' + a.id + '">Remove</button>';
          }

          var passwordControl = '<span class="admin-note">—</span>';
          if (myRole === 'superadmin') {
            passwordControl =
              '<div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center">' +
              '<input type="text" data-new-password-for="' + a.id + '" placeholder="New password" minlength="8" style="width:130px;font-size:.75rem;padding:.35rem .5rem">' +
              '<button class="admin-btn admin-btn--ghost" type="button" data-set-password="' + a.id + '" style="font-size:.7rem;padding:.35rem .55rem">Set</button>' +
              '<button class="admin-btn admin-btn--ghost" type="button" data-reset-password="' + a.id + '" style="font-size:.7rem;padding:.35rem .55rem">Reset</button>' +
              '</div>' +
              '<p class="admin-note" data-password-result-for="' + a.id + '" hidden style="margin:.3rem 0 0;max-width:220px"></p>';
          }

          return (
            '<tr>' +
            '<td>' + escapeHtml(a.email) + (isSelf ? ' <span class="admin-note">(you)</span>' : '') + '</td>' +
            '<td>' + roleControl + '</td>' +
            '<td>' + new Date(a.created_at).toLocaleDateString('en-IN') + '</td>' +
            '<td>' + passwordControl + '</td>' +
            '<td>' + kickControl + '</td>' +
            '</tr>'
          );
        })
        .join('');

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-set-password]'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-set-password');
          var input = tbody.querySelector('[data-new-password-for="' + id + '"]');
          var resultEl = tbody.querySelector('[data-password-result-for="' + id + '"]');
          var password = input.value;
          if (password.length < 8) {
            resultEl.textContent = 'Password must be at least 8 characters.';
            resultEl.hidden = false;
            return;
          }
          authedFetch('/api/admin/admin-users?id=' + encodeURIComponent(id) + '&action=set-password', {
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
      });

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-reset-password]'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-reset-password');
          var resultEl = tbody.querySelector('[data-password-result-for="' + id + '"]');
          if (!confirm('Reset this account\'s password to a random one? Their current password will stop working immediately.')) return;
          authedFetch('/api/admin/admin-users?id=' + encodeURIComponent(id) + '&action=reset-login', {
            method: 'PATCH',
          }).then(function (res) {
            if (res.json.error) {
              resultEl.textContent = res.json.error;
              resultEl.hidden = false;
              return;
            }
            resultEl.textContent = 'New password: ' + res.json.temporary_password + ' — share this with them now, it will not be shown again.';
            resultEl.hidden = false;
          });
        });
      });

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-role-for]'), function (select) {
        select.addEventListener('change', function () {
          var id = select.getAttribute('data-role-for');
          authedFetch('/api/admin/admin-users?id=' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: select.value }),
          }).then(function (res) {
            if (res.json.error) alert(res.json.error);
            loadAdmins();
          });
        });
      });

      Array.prototype.forEach.call(tbody.querySelectorAll('[data-kick]'), function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('Remove this account? They will lose admin access immediately and can no longer log in.')) return;
          var id = btn.getAttribute('data-kick');
          authedFetch('/api/admin/admin-users?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
            if (res.json.error) { alert(res.json.error); return; }
            loadAdmins();
          });
        });
      });
    }

    function loadAdmins() {
      authedFetch('/api/admin/admin-users').then(function (res) {
        if (res.json.error) { alert(res.json.error); return; }
        myRole = res.json.self.role;
        myId = res.json.self.id;
        document.getElementById('my-role-note').textContent = 'You are signed in as: ' + roleLabel(myRole) + '.';

        var roleSelect = document.getElementById('new-role');
        if (myRole !== 'superadmin') {
          roleSelect.innerHTML = '<option value="admin">Admin</option>';
          roleSelect.value = 'admin';
        }

        renderRows(res.json.admins);
      });
    }

    document.getElementById('add-admin-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;

      var errorEl = document.getElementById('add-error');
      var successEl = document.getElementById('add-success');
      errorEl.hidden = true;
      successEl.hidden = true;

      var email = document.getElementById('new-email').value.trim();
      var role = document.getElementById('new-role').value;

      authedFetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, role: role }),
      }).then(function (res) {
        submitBtn.disabled = false;
        if (res.json.error) {
          errorEl.textContent = res.json.error;
          errorEl.hidden = false;
          return;
        }
        document.getElementById('add-admin-form').reset();
        successEl.textContent = res.json.temporary_password
          ? 'Added ' + res.json.email + ' as ' + roleLabel(res.json.role) + '. Temporary password: ' + res.json.temporary_password + ' — share this with them now, it will not be shown again.'
          : 'Added ' + res.json.email + ' as ' + roleLabel(res.json.role) + ' (existing account, no new password).';
        successEl.hidden = false;
        loadAdmins();
      });
    });

    loadAdmins();
  });
})();
