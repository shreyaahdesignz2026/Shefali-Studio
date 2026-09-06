(function () {
  'use strict';

  var form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('register-error');
    errorEl.hidden = true;

    var password = document.getElementById('r-password').value;
    var confirmPassword = document.getElementById('r-confirm-password').value;
    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters.';
      errorEl.hidden = false;
      return;
    }
    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.hidden = false;
      return;
    }

    var body = {
      email: document.getElementById('r-email').value.trim(),
      password: password,
      display_name: document.getElementById('r-display-name').value.trim() || null,
      phone: document.getElementById('r-phone').value.trim() || null,
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json().then(function (json) { return { status: r.status, json: json }; }); })
      .then(function (res) {
        if (res.json.error) {
          submitBtn.disabled = false;
          errorEl.textContent = res.json.error;
          errorEl.hidden = false;
          return;
        }
        window.location.href = '../members/?registered=1';
      })
      .catch(function () {
        submitBtn.disabled = false;
        errorEl.textContent = 'Something went wrong — please try again.';
        errorEl.hidden = false;
      });
  });
})();
