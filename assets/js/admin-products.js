(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;
    var form = document.getElementById('product-form');
    var idField = document.getElementById('product-id');
    var formError = document.getElementById('form-error');
    var formHeading = document.getElementById('form-heading');
    var cancelBtn = document.getElementById('cancel-edit');
    var rowsBody = document.getElementById('product-rows');

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function money(n) {
      return '₹' + Number(n).toFixed(2).replace(/\.00$/, '');
    }

    function resetForm() {
      form.reset();
      idField.value = '';
      formHeading.textContent = 'Add a product';
      cancelBtn.hidden = true;
      formError.hidden = true;
      document.getElementById('upload-image-btn').disabled = true;
      document.getElementById('upload-status').textContent = '';
    }

    function fillForm(p) {
      idField.value = p.id;
      document.getElementById('name').value = p.name;
      document.getElementById('category').value = p.category;
      document.getElementById('subcategory').value = p.subcategory || '';
      document.getElementById('description').value = p.description || '';
      document.getElementById('price').value = p.price;
      document.getElementById('original_price').value = p.original_price || '';
      document.getElementById('is_provisional').checked = !!p.is_provisional;
      formHeading.textContent = 'Edit product';
      cancelBtn.hidden = false;
      document.getElementById('upload-image-btn').disabled = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderRows(products) {
      rowsBody.innerHTML = products
        .map(function (p) {
          return (
            '<tr>' +
            '<td>' + p.name + '</td>' +
            '<td>' + p.category + '</td>' +
            '<td>' + money(p.price) + '</td>' +
            '<td>' + p.status + '</td>' +
            '<td>' + (p.image_path ? 'Yes' : 'No') + '</td>' +
            '<td>' +
            '<button class="admin-btn admin-btn--ghost" data-edit="' + p.id + '">Edit</button> ' +
            '<button class="admin-btn admin-btn--ghost" data-toggle="' + p.id + '" data-current="' + p.status + '">' +
            (p.status === 'active' ? 'Archive' : 'Reactivate') +
            '</button> ' +
            '<button class="admin-btn admin-btn--danger" data-delete="' + p.id + '">Delete</button>' +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-edit]'), function (btn) {
        btn.addEventListener('click', function () {
          var p = products.find(function (x) { return x.id === btn.getAttribute('data-edit'); });
          if (p) fillForm(p);
        });
      });
      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-toggle]'), function (btn) {
        btn.addEventListener('click', function () {
          var newStatus = btn.getAttribute('data-current') === 'active' ? 'archived' : 'active';
          client
            .from('products')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', btn.getAttribute('data-toggle'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              loadProducts();
            });
        });
      });
      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-delete]'), function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('Delete this product permanently? Past orders keep their own snapshot, so this is safe, but it cannot be undone.')) return;
          client
            .from('products')
            .delete()
            .eq('id', btn.getAttribute('data-delete'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              loadProducts();
            });
        });
      });
    }

    function loadProducts() {
      client
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          renderRows(res.data);
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError.hidden = true;

      var payload = {
        name: document.getElementById('name').value.trim(),
        category: document.getElementById('category').value.trim(),
        subcategory: document.getElementById('subcategory').value.trim() || null,
        description: document.getElementById('description').value.trim() || null,
        price: parseFloat(document.getElementById('price').value),
        original_price: document.getElementById('original_price').value
          ? parseFloat(document.getElementById('original_price').value)
          : null,
        is_provisional: document.getElementById('is_provisional').checked,
        updated_at: new Date().toISOString(),
      };

      var id = idField.value;
      var query = id
        ? client.from('products').update(payload).eq('id', id)
        : client.from('products').insert(payload);

      query.then(function (res) {
        if (res.error) {
          formError.textContent = res.error.message;
          formError.hidden = false;
          return;
        }
        resetForm();
        loadProducts();
      });
    });

    cancelBtn.addEventListener('click', resetForm);

    document.getElementById('upload-image-btn').addEventListener('click', function () {
      var id = idField.value;
      var fileInput = document.getElementById('image-file');
      var status = document.getElementById('upload-status');
      if (!id) { status.textContent = 'Save the product first, then upload its image.'; return; }
      if (!fileInput.files[0]) { status.textContent = 'Choose an image file first.'; return; }

      var file = fileInput.files[0];
      status.textContent = 'Uploading…';

      client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;
        fetch('/api/admin/upload-image?productId=' + encodeURIComponent(id), {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            Authorization: 'Bearer ' + token,
          },
          body: file,
        })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (json.error) { status.textContent = 'Error: ' + json.error; return; }
            status.textContent = 'Image uploaded.';
            loadProducts();
          })
          .catch(function (err) { status.textContent = 'Error: ' + err.message; });
      });
    });

    loadProducts();

    // Tasks 9 and 10 append more code inside this same requireSession
    // callback below, so they can call loadProducts()/client directly via
    // closure — no global export needed.
  });
})();
