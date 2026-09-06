(function () {
  'use strict';

  var TYPE_LABELS = {
    service_booking: 'Service Booking',
    contact_individual: 'Individual Enquiry',
    contact_corporate: 'Corporate Enquiry',
    event_registration: 'Event Registration',
    artisoul_tribe: 'Artisoul Tribe Interest',
  };

  var PLAN_LABEL = { artisoul_member: 'Artisoul Member', free_tier: 'Free Tier' };
  var PLAN_BENEFITS = {
    artisoul_member: [
      'Discount on all products',
      'Priority booking on events and sessions',
      'Invitations to smaller gatherings',
    ],
    free_tier: [],
  };

  function money(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function humanize(key) {
    return String(key).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function statusPillClass(status) {
    if (status === 'delivered') return 'pill--sage';
    if (status === 'cancelled') return 'pill--terra';
    return 'pill--gold';
  }

  function initDashboard(session) {
    var SBTMember = window.SBTMember;
    var client = SBTMember.client;
    var escapeHtml = SBTMember.escapeHtml;
    var member = null;
    var addressesCache = [];

    function withLineBreaks(s) {
      return escapeHtml(s).replace(/\n/g, '<br>');
    }

    function authedFetch(url, options) {
      return client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;
        options = options || {};
        options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + token });
        return fetch(url, options).then(function (r) {
          return r.json().then(function (json) { return { status: r.status, json: json }; });
        });
      });
    }

    function statusBadge(status) {
      return '<span class="pill ' + statusPillClass(status) + '">' + escapeHtml(status) + '</span>';
    }

    /* ---------- profile ---------- */

    function renderPlan(m) {
      document.getElementById('plan-name').textContent = PLAN_LABEL[m.plan] || m.plan;
      var benefits = PLAN_BENEFITS[m.plan] || [];
      var ul = document.getElementById('plan-benefits');
      ul.innerHTML = benefits.length
        ? benefits
            .map(function (b) {
              return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ' + escapeHtml(b) + '</li>';
            })
            .join('')
        : '<li class="muted" style="list-style:none;margin-left:-1.4rem">A simple account — browse, book and buy with a saved profile and order history.</li>';
    }

    function applyMember(m) {
      member = m;
      document.querySelector('[data-member-name]').textContent = member.display_name || member.email;
      document.querySelector('[data-member-email]').textContent = member.email;
      document.getElementById('account-email').textContent = member.email;
      document.getElementById('p-display').value = member.display_name || '';
      document.getElementById('p-phone').value = member.phone || '';
      document.getElementById('p-note').value = member.note || '';
      document.getElementById('wallet-balance').textContent = money(member.wallet_balance || 0);
      renderPlan(member);
    }

    function loadProfile() {
      return authedFetch('/api/members/me').then(function (res) {
        if (res.json.error) return;
        applyMember(res.json.member);
      });
    }

    document.getElementById('profile-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('profile-error');
      var successEl = document.getElementById('profile-success');
      errorEl.hidden = true;
      successEl.hidden = true;
      var body = {
        display_name: document.getElementById('p-display').value.trim() || null,
        phone: document.getElementById('p-phone').value.trim() || null,
        note: document.getElementById('p-note').value.trim() || null,
      };
      authedFetch('/api/members/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (res) {
        if (res.json.error) { errorEl.textContent = res.json.error; errorEl.hidden = false; return; }
        applyMember(res.json.member);
        successEl.hidden = false;
      });
    });

    /* ---------- email change ---------- */

    document.getElementById('change-email-toggle').addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('change-email-form').hidden = false;
    });

    document.getElementById('change-email-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('change-email-error');
      errorEl.hidden = true;
      var newEmail = document.getElementById('new-email-input').value.trim();
      authedFetch('/api/members/change-email?action=request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail }),
      }).then(function (res) {
        if (res.json.error) { errorEl.textContent = res.json.error; errorEl.hidden = false; return; }
        document.getElementById('change-email-form').hidden = true;
        document.getElementById('confirm-email-form').hidden = false;
      });
    });

    document.getElementById('confirm-email-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('confirm-email-error');
      var successEl = document.getElementById('confirm-email-success');
      errorEl.hidden = true;
      successEl.hidden = true;
      var code = document.getElementById('email-code-input').value.trim();
      authedFetch('/api/members/change-email?action=confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code }),
      }).then(function (res) {
        if (res.json.error) { errorEl.textContent = res.json.error; errorEl.hidden = false; return; }
        document.getElementById('account-email').textContent = res.json.email;
        document.querySelector('[data-member-email]').textContent = res.json.email;
        document.getElementById('confirm-email-form').hidden = true;
        successEl.hidden = false;
      });
    });

    /* ---------- password change ---------- */

    document.getElementById('password-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('password-error');
      var successEl = document.getElementById('password-success');
      errorEl.hidden = true;
      successEl.hidden = true;
      var pw = document.getElementById('new-password').value;
      var confirmPw = document.getElementById('confirm-password').value;
      if (pw.length < 8) { errorEl.textContent = 'Password must be at least 8 characters.'; errorEl.hidden = false; return; }
      if (pw !== confirmPw) { errorEl.textContent = 'Passwords do not match.'; errorEl.hidden = false; return; }
      client.auth.updateUser({ password: pw }).then(function (res) {
        if (res.error) { errorEl.textContent = res.error.message; errorEl.hidden = false; return; }
        document.getElementById('password-form').reset();
        successEl.hidden = false;
      });
    });

    /* ---------- bookings & calendar ---------- */

    function bookingLabel(row) {
      if (row.form_type === 'service_booking') return (row.details && row.details.service) || 'Session';
      if (row.form_type === 'event_registration') return (row.details && row.details.event) || 'Event';
      return TYPE_LABELS[row.form_type] || row.form_type;
    }

    function renderBookingRow(row) {
      var when = row.happens_at
        ? new Date(row.happens_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Date to be confirmed';
      var detailLines = Object.keys(row.details || {})
        .map(function (k) {
          return '<p class="small muted" style="margin:.15rem 0"><strong>' + humanize(k) + ':</strong> ' + withLineBreaks(String(row.details[k])) + '</p>';
        })
        .join('');
      return (
        '<div style="padding:.9rem 0;border-bottom:1px solid var(--rule-soft)">' +
        '<p style="margin:0 0 .2rem"><strong>' + escapeHtml(bookingLabel(row)) + '</strong></p>' +
        '<p class="small muted" style="margin:0 0 .4rem">' + escapeHtml(TYPE_LABELS[row.form_type] || row.form_type) + ' — ' + when + '</p>' +
        (row.phone ? '<p class="small muted" style="margin:.15rem 0"><strong>Phone:</strong> ' + escapeHtml(row.phone) + '</p>' : '') +
        (row.email ? '<p class="small muted" style="margin:.15rem 0"><strong>Email:</strong> ' + escapeHtml(row.email) + '</p>' : '') +
        detailLines +
        (row.message ? '<p class="small muted" style="margin:.15rem 0"><strong>Message:</strong><br>' + withLineBreaks(row.message) + '</p>' : '') +
        '</div>'
      );
    }

    function loadBookings() {
      client
        .from('form_submissions')
        .select('*')
        .eq('member_id', session.user.id)
        .in('form_type', ['service_booking', 'event_registration'])
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) return;
          var now = Date.now();
          var upcoming = [];
          var past = [];
          res.data.forEach(function (row) {
            if (!row.happens_at || new Date(row.happens_at).getTime() >= now) upcoming.push(row);
            else past.push(row);
          });

          document.getElementById('bk-up').innerHTML = upcoming.length
            ? upcoming.map(renderBookingRow).join('')
            : '<div class="empty"><span class="motif"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span><h3>No bookings yet</h3><p>Sessions and events you book will appear here, with the details you need and a reminder before the day.</p><div class="flex flex-wrap gap-1 mt-2" style="justify-content:center"><a class="btn btn--primary btn--sm" href="../services/#book">Book a session</a><a class="btn btn--ghost btn--sm" href="../events/">See events</a></div></div>';

          document.getElementById('bk-past').innerHTML = past.length
            ? past.map(renderBookingRow).join('')
            : '<div class="empty"><h3>Nothing here yet</h3><p>Sessions you have attended will be listed here once they have taken place.</p></div>';
        });
    }

    /* ---------- orders ---------- */

    function renderOrders(orders, itemsByOrder) {
      var el = document.getElementById('orders-list');
      if (!orders.length) {
        el.innerHTML =
          '<div class="member-card"><div class="empty">' +
          '<span class="motif"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>' +
          '<h3>No orders yet</h3><p>Once you have ordered, everything you have bought will be here.</p>' +
          '<a class="btn btn--primary btn--sm mt-2" href="../products/">Browse the collection</a>' +
          '</div></div>';
        return;
      }
      el.innerHTML = orders
        .map(function (o) {
          var items = itemsByOrder[o.id] || [];
          var itemLines = items
            .map(function (li) { return '<li>' + li.qty + ' × ' + escapeHtml(li.product_name) + ' — ' + money(li.line_total) + '</li>'; })
            .join('');
          return (
            '<div class="member-card mb-2">' +
            '<div class="flex items-center justify-between" style="cursor:pointer" data-toggle-order="' + o.id + '">' +
            '<h4 style="margin:0">Order #' + o.order_number + '</h4>' +
            '<div>' + statusBadge(o.status) + ' <strong>' + money(o.grand_total) + '</strong></div>' +
            '</div>' +
            '<p class="small muted" style="margin:.4rem 0 0">' + new Date(o.created_at).toLocaleString('en-IN') + ' — click to view details</p>' +
            '<div id="order-detail-' + o.id + '" hidden style="margin-top:.75rem;padding-top:.75rem;border-top:1px dashed var(--rule)">' +
            '<ul style="margin:0 0 .75rem;padding-left:1.1rem">' + itemLines + '</ul>' +
            '<p class="small" style="margin:0 0 .6rem">Subtotal ' + money(o.subtotal) + ' + delivery ' + money(o.shipping_fee) + ' = <strong>' + money(o.grand_total) + '</strong></p>' +
            '<p class="small muted" style="margin:0"><strong>Delivered to:</strong><br>' +
            escapeHtml(o.customer_name) + ', ' + escapeHtml(o.customer_phone) + (o.customer_email ? ', ' + escapeHtml(o.customer_email) : '') + '<br>' +
            escapeHtml(o.address_line) + ', ' + escapeHtml(o.city) + ', ' + escapeHtml(o.state) + ' — ' + escapeHtml(o.pincode) +
            '</p>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      Array.prototype.forEach.call(el.querySelectorAll('[data-toggle-order]'), function (header) {
        header.addEventListener('click', function () {
          var detail = document.getElementById('order-detail-' + header.getAttribute('data-toggle-order'));
          detail.hidden = !detail.hidden;
        });
      });
    }

    function loadOrders() {
      client
        .from('orders')
        .select('*')
        .eq('member_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(function (ordersRes) {
          if (ordersRes.error) return;
          var orders = ordersRes.data;
          if (!orders.length) { renderOrders([], {}); return; }
          client
            .from('order_items')
            .select('*')
            .in('order_id', orders.map(function (o) { return o.id; }))
            .then(function (itemsRes) {
              if (itemsRes.error) return;
              var itemsByOrder = {};
              itemsRes.data.forEach(function (li) {
                (itemsByOrder[li.order_id] = itemsByOrder[li.order_id] || []).push(li);
              });
              renderOrders(orders, itemsByOrder);
            });
        });
    }

    /* ---------- saved addresses ---------- */

    function openAddressForm(address) {
      var card = document.getElementById('address-form-card');
      document.getElementById('address-form-title').textContent = address ? 'Edit address' : 'Add address';
      document.getElementById('addr-id').value = address ? address.id : '';
      document.getElementById('addr-label').value = address ? address.label || '' : '';
      document.getElementById('addr-name').value = address ? address.name : '';
      document.getElementById('addr-phone').value = address ? address.phone : '';
      document.getElementById('addr-line').value = address ? address.address_line : '';
      document.getElementById('addr-city').value = address ? address.city : '';
      document.getElementById('addr-state').value = address ? address.state : '';
      document.getElementById('addr-pincode').value = address ? address.pincode : '';
      document.getElementById('address-form-error').hidden = true;
      card.hidden = false;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function closeAddressForm() {
      document.getElementById('address-form-card').hidden = true;
      document.getElementById('address-form').reset();
    }

    function renderAddresses(addresses) {
      addressesCache = addresses;
      var grid = document.getElementById('addresses-grid');

      var cards = addresses
        .map(function (a, i) {
          var tagParts = [];
          if (i === 0) tagParts.push('Default');
          if (a.label) tagParts.push(escapeHtml(a.label));
          var tag = tagParts.length ? '<span class="tag">' + tagParts.join(' · ') + '</span>' : '';
          return (
            '<div class="addr' + (i === 0 ? ' is-default' : '') + '">' +
            tag +
            '<p style="margin:0 0 .3rem"><strong>' + escapeHtml(a.name) + '</strong> · ' + escapeHtml(a.phone) + '</p>' +
            '<p class="small muted" style="margin:0">' + escapeHtml(a.address_line) + ', ' + escapeHtml(a.city) + ', ' + escapeHtml(a.state) + ' — ' + escapeHtml(a.pincode) + '</p>' +
            '<p style="margin-top:.6rem">' +
            '<a class="link" href="#" data-edit-address="' + a.id + '" style="font-size:.72rem;margin-right:1rem">Edit</a>' +
            '<a class="link" href="#" data-delete-address="' + a.id + '" style="font-size:.72rem">Delete</a>' +
            '</p>' +
            '</div>'
          );
        })
        .join('');

      var addCard = addresses.length < 5
        ? '<a class="addr add" href="#" id="address-add-trigger"><span>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" style="margin:0 auto .5rem"><path d="M12 5v14M5 12h14"/></svg>' +
          '<span class="small">Add another address</span>' +
          '<span class="tiny muted" style="display:block;margin-top:.25rem">' + addresses.length + ' of 5 saved</span>' +
          '</span></a>'
        : '';

      grid.innerHTML = cards + addCard;

      Array.prototype.forEach.call(grid.querySelectorAll('[data-edit-address]'), function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var addr = addressesCache.filter(function (a) { return a.id === link.getAttribute('data-edit-address'); })[0];
          if (addr) openAddressForm(addr);
        });
      });

      Array.prototype.forEach.call(grid.querySelectorAll('[data-delete-address]'), function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          if (!confirm('Delete this address?')) return;
          client
            .from('member_addresses')
            .delete()
            .eq('id', link.getAttribute('data-delete-address'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              loadAddresses();
            });
        });
      });

      var addTrigger = document.getElementById('address-add-trigger');
      if (addTrigger) {
        addTrigger.addEventListener('click', function (e) {
          e.preventDefault();
          openAddressForm(null);
        });
      }
    }

    function loadAddresses() {
      client
        .from('member_addresses')
        .select('*')
        .eq('member_id', session.user.id)
        .order('created_at', { ascending: true })
        .then(function (res) {
          if (res.error) return;
          renderAddresses(res.data);
        });
    }

    document.getElementById('address-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var addressForm = e.target;
      var submitBtn = addressForm.querySelector('button[type="submit"]');
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;

      var errorEl = document.getElementById('address-form-error');
      errorEl.hidden = true;
      var id = document.getElementById('addr-id').value;
      var payload = {
        label: document.getElementById('addr-label').value.trim() || null,
        name: document.getElementById('addr-name').value.trim(),
        phone: document.getElementById('addr-phone').value.trim(),
        address_line: document.getElementById('addr-line').value.trim(),
        city: document.getElementById('addr-city').value.trim(),
        state: document.getElementById('addr-state').value.trim(),
        pincode: document.getElementById('addr-pincode').value.trim(),
        updated_at: new Date().toISOString(),
      };
      var query = id
        ? client.from('member_addresses').update(payload).eq('id', id)
        : client.from('member_addresses').insert(Object.assign({ member_id: session.user.id }, payload));
      query.then(function (res) {
        submitBtn.disabled = false;
        if (res.error) { errorEl.textContent = res.error.message; errorEl.hidden = false; return; }
        closeAddressForm();
        loadAddresses();
      });
    });

    document.getElementById('address-form-cancel').addEventListener('click', function () {
      closeAddressForm();
    });

    /* ---------- your data ---------- */

    function renderYourData(rows) {
      var el = document.getElementById('your-data-list');
      if (!rows.length) {
        el.innerHTML = '<div class="member-card"><p class="muted" style="margin:0">You have not sent us any enquiries yet.</p></div>';
        return;
      }
      el.innerHTML =
        '<div class="member-card">' +
        rows
          .map(function (row) {
            var detailLines = Object.keys(row.details || {})
              .map(function (k) {
                return '<p class="small muted" style="margin:.2rem 0"><strong>' + humanize(k) + ':</strong> ' + withLineBreaks(String(row.details[k])) + '</p>';
              })
              .join('');
            return (
              '<div style="padding:.9rem 0;border-bottom:1px solid var(--rule-soft)">' +
              '<p style="margin:0 0 .3rem"><strong>' + escapeHtml(TYPE_LABELS[row.form_type] || row.form_type) + '</strong> ' +
              '<span class="tiny muted">— ' + new Date(row.created_at).toLocaleString('en-IN') + '</span></p>' +
              detailLines +
              (row.message ? '<p class="small muted" style="margin:.2rem 0"><strong>Message:</strong><br>' + withLineBreaks(row.message) + '</p>' : '') +
              '</div>'
            );
          })
          .join('') +
        '</div>';
    }

    function loadYourData() {
      client
        .from('form_submissions')
        .select('*')
        .eq('member_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) return;
          renderYourData(res.data);
        });
    }

    /* ---------- logout ---------- */

    document.getElementById('member-logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      SBTMember.logout().then(function () { window.location.reload(); });
    });

    loadProfile();
    loadBookings();
    loadOrders();
    loadAddresses();
    loadYourData();
  }

  function boot() {
    var loginContainer = document.getElementById('member-login');
    var dashboard = document.getElementById('member-dashboard');
    if (!loginContainer || !dashboard) return;

    function showDashboard(session) {
      loginContainer.hidden = true;
      loginContainer.innerHTML = '';
      dashboard.hidden = false;
      initDashboard(session);
    }

    function showLogin() {
      dashboard.hidden = true;
      loginContainer.hidden = false;
      window.SBTMember.mountLoginPanel(loginContainer, { onSuccess: showDashboard });

      var params = new URLSearchParams(window.location.search);
      if (params.get('registered') === '1') {
        var banner = document.createElement('div');
        banner.className = 'form-success';
        banner.style.maxWidth = '420px';
        banner.style.margin = '0 auto 1.25rem';
        banner.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
          '<div><strong>Account created</strong><br>You can now log in with your registered email and password below.</div>';
        loginContainer.insertBefore(banner, loginContainer.firstChild);
        history.replaceState(null, '', window.location.pathname);
      }
    }

    window.SBTMember.getSession(function (session) {
      if (session) showDashboard(session);
      else showLogin();
    });
  }

  boot();
})();
