(function () {
  'use strict';

  var SUPABASE_URL = 'https://lektufytmhaumsltyfxf.supabase.co';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3R1Znl0bWhhdW1zbHR5ZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDU4ODcsImV4cCI6MjEwNDE4MTg4N30.NjFKO-hgk5PrdM-di5lOGbFYVXLWJtKpl24ye3GKAmk';

  // A distinct storageKey keeps a member's session separate from an admin
  // session in the same browser (different localStorage key), so a site
  // owner who is signed into /admin/ never has their admin session picked
  // up here (or vice versa) just because both clients share an origin.
  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: 'sbt-member-auth' },
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showError(form, msg) {
    var el = form.querySelector('[data-login-error]');
    el.textContent = msg;
    el.hidden = false;
  }

  function clearError(form) {
    var el = form.querySelector('[data-login-error]');
    el.hidden = true;
  }

  function mountLoginPanel(container, opts) {
    opts = opts || {};

    container.innerHTML =
      '<div class="member-card" style="max-width:420px;margin:0 auto;">' +
      '<div class="tabs" style="margin-bottom:1.25rem;">' +
      '<button type="button" class="tab" data-login-switch="password" aria-selected="true">Password</button>' +
      '<button type="button" class="tab" data-login-switch="otp" aria-selected="false">Email code</button>' +
      '</div>' +

      '<form data-login-form="password">' +
      '<div class="field"><label for="login-email-pw">Email <span class="req">*</span></label><input id="login-email-pw" type="email" required autocomplete="email"></div>' +
      '<div class="field"><label for="login-password">Password <span class="req">*</span></label><input id="login-password" type="password" required autocomplete="current-password"></div>' +
      '<button class="btn btn--primary btn--block" type="submit">Log in</button>' +
      '<p class="form-error" data-login-error hidden></p>' +
      '</form>' +

      '<form data-login-form="otp-request" hidden>' +
      '<p class="small muted mb-2">We will email you a 6-digit code to log in — no password needed.</p>' +
      '<div class="field"><label for="login-email-otp">Email <span class="req">*</span></label><input id="login-email-otp" type="email" required autocomplete="email"></div>' +
      '<button class="btn btn--primary btn--block" type="submit">Email me a code</button>' +
      '<p class="form-error" data-login-error hidden></p>' +
      '</form>' +

      '<form data-login-form="otp-verify" hidden>' +
      '<p class="small muted mb-2">Enter the 6-digit code we just emailed you.</p>' +
      '<div class="field"><label for="login-otp-code">Code <span class="req">*</span></label><input id="login-otp-code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" required></div>' +
      '<button class="btn btn--primary btn--block" type="submit">Verify &amp; log in</button>' +
      '<p class="tiny muted mt-1"><a href="#" data-login-resend>Use a different email</a></p>' +
      '<p class="form-error" data-login-error hidden></p>' +
      '<p class="form-success" data-otp-success hidden>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
      '<div>Success! Your code matched — redirecting you to your Members Space now…</div>' +
      '</p>' +
      '</form>' +
      '<p class="tiny muted mt-2" style="text-align:center">New here? <a href="/register/">Create an account</a></p>' +
      '</div>';

    var forms = {
      password: container.querySelector('[data-login-form="password"]'),
      otpRequest: container.querySelector('[data-login-form="otp-request"]'),
      otpVerify: container.querySelector('[data-login-form="otp-verify"]'),
    };
    var switches = Array.prototype.slice.call(container.querySelectorAll('[data-login-switch]'));
    var pendingOtpEmail = null;

    function showForm(name) {
      forms.password.hidden = name !== 'password';
      forms.otpRequest.hidden = name !== 'otp-request';
      forms.otpVerify.hidden = name !== 'otp-verify';
    }

    switches.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switches.forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        showForm(btn.getAttribute('data-login-switch') === 'otp' ? 'otp-request' : 'password');
      });
    });

    forms.password.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError(forms.password);
      var email = document.getElementById('login-email-pw').value.trim();
      var password = document.getElementById('login-password').value;
      client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
        if (res.error) { showError(forms.password, res.error.message); return; }
        if (opts.onSuccess) opts.onSuccess(res.data.session);
      });
    });

    forms.otpRequest.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError(forms.otpRequest);
      var email = document.getElementById('login-email-otp').value.trim();
      var submitBtn = forms.otpRequest.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      fetch('/api/members/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function (r) { return r.json().then(function (json) { return { status: r.status, json: json }; }); })
        .then(function (res) {
          submitBtn.disabled = false;
          if (res.json.error) { showError(forms.otpRequest, res.json.error); return; }
          pendingOtpEmail = email;
          document.getElementById('login-otp-code').value = '';
          showForm('otp-verify');
        })
        .catch(function () {
          submitBtn.disabled = false;
          showError(forms.otpRequest, 'Something went wrong — please try again.');
        });
    });

    forms.otpVerify.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError(forms.otpVerify);
      var code = document.getElementById('login-otp-code').value.trim();
      var submitBtn = forms.otpVerify.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      fetch('/api/members/request-otp?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingOtpEmail, code: code }),
      })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json.error) {
            submitBtn.disabled = false;
            showError(forms.otpVerify, json.error);
            return;
          }
          return client.auth.setSession({
            access_token: json.session.access_token,
            refresh_token: json.session.refresh_token,
          }).then(function (res) {
            submitBtn.disabled = false;
            if (res.error) { showError(forms.otpVerify, res.error.message); return; }
            // Brief, visible confirmation that the code matched before
            // handing off to onSuccess (which usually swaps this whole
            // panel out for the dashboard) -- otherwise a fast redirect
            // can look like nothing happened.
            forms.otpVerify.querySelector('[data-otp-success]').hidden = false;
            setTimeout(function () {
              if (opts.onSuccess) opts.onSuccess(res.data.session);
            }, 900);
          });
        })
        .catch(function () {
          submitBtn.disabled = false;
          showError(forms.otpVerify, 'Something went wrong — please try again.');
        });
    });

    container.querySelector('[data-login-resend]').addEventListener('click', function (e) {
      e.preventDefault();
      pendingOtpEmail = null;
      showForm('otp-request');
    });
  }

  window.SBTMember = {
    client: client,
    escapeHtml: escapeHtml,
    getSession: function (callback) {
      client.auth.getSession().then(function (res) {
        callback(res.data && res.data.session);
      });
    },
    onAuthChange: function (callback) {
      return client.auth.onAuthStateChange(function (event, session) {
        callback(session);
      });
    },
    logout: function () {
      return client.auth.signOut();
    },
    mountLoginPanel: mountLoginPanel,
  };
})();
