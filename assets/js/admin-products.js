(function () {
  'use strict';

  var SUPABASE_URL = 'https://lektufytmhaumsltyfxf.supabase.co';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;
    var form = document.getElementById('product-form');
    var idField = document.getElementById('product-id');
    var formError = document.getElementById('form-error');
    var formHeading = document.getElementById('form-heading');
    var cancelBtn = document.getElementById('cancel-edit');
    var rowsBody = document.getElementById('product-rows');
    var categorySelect = document.getElementById('category');
    var toggleFormBtn = document.getElementById('toggle-form-btn');
    var imageGallery = document.getElementById('image-gallery');

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
      imageGallery.innerHTML = '';
    }

    function renderGallery(images) {
      imageGallery.innerHTML = images
        .map(function (img) {
          var thumbUrl = SUPABASE_URL + '/storage/v1/object/public/product-images/' + img.product_id + '/' + img.slug + '.jpg';
          return (
            '<div style="text-align:center">' +
            '<img src="' + thumbUrl + '" alt="" width="80" height="80" style="object-fit:cover;border-radius:6px;border:1px solid #DDD5C7;display:block">' +
            '<button class="admin-btn admin-btn--danger" type="button" data-remove-image="' + img.id + '" style="margin-top:.3rem;padding:.2rem .5rem;font-size:.7rem">Remove</button>' +
            '</div>'
          );
        })
        .join('');

      Array.prototype.forEach.call(imageGallery.querySelectorAll('[data-remove-image]'), function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('Remove this image?')) return;
          client.auth.getSession().then(function (sessionRes) {
            var token = sessionRes.data.session.access_token;
            fetch('/api/admin/upload-image?imageId=' + encodeURIComponent(btn.getAttribute('data-remove-image')), {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + token },
            })
              .then(function (r) { return r.json(); })
              .then(function (json) {
                if (json.error) { alert(json.error); return; }
                loadProductImages(idField.value);
                loadProducts();
              });
          });
        });
      });
    }

    function loadProductImages(productId) {
      client
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('position')
        .then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          renderGallery(res.data);
        });
    }

    function fillForm(p) {
      idField.value = p.id;
      document.getElementById('name').value = p.name;
      categorySelect.value = p.category;
      document.getElementById('subcategory').value = p.subcategory || '';
      document.getElementById('description').value = p.description || '';
      document.getElementById('price').value = p.price;
      document.getElementById('original_price').value = p.original_price || '';
      document.getElementById('is_provisional').checked = !!p.is_provisional;
      formHeading.textContent = 'Edit product';
      cancelBtn.hidden = false;
      document.getElementById('upload-image-btn').disabled = false;
      form.hidden = false;
      loadProductImages(p.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateCategoryOptions(products) {
      var current = categorySelect.value;
      var categories = Array.from(new Set(products.map(function (p) { return p.category; }))).sort();
      categorySelect.innerHTML = categories
        .map(function (c) { return '<option value="' + c + '">' + c + '</option>'; })
        .join('');
      if (categories.indexOf(current) > -1) categorySelect.value = current;
    }

    function renderRows(products, imageCounts) {
      rowsBody.innerHTML = products
        .map(function (p) {
          var count = imageCounts[p.id] || 0;
          return (
            '<tr>' +
            '<td>' + p.name + '</td>' +
            '<td>' + p.category + '</td>' +
            '<td>' + money(p.price) + '</td>' +
            '<td>' + p.status + '</td>' +
            '<td>' + count + '</td>' +
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
          var products = res.data;
          updateCategoryOptions(products);
          client
            .from('product_images')
            .select('product_id')
            .then(function (imgRes) {
              if (imgRes.error) { alert(imgRes.error.message); return; }
              var counts = {};
              imgRes.data.forEach(function (row) {
                counts[row.product_id] = (counts[row.product_id] || 0) + 1;
              });
              renderRows(products, counts);
            });
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError.hidden = true;

      var payload = {
        name: document.getElementById('name').value.trim(),
        category: categorySelect.value,
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
        form.hidden = true;
        loadProducts();
      });
    });

    cancelBtn.addEventListener('click', function () {
      resetForm();
      form.hidden = true;
    });

    toggleFormBtn.addEventListener('click', function () {
      if (form.hidden) {
        resetForm();
        form.hidden = false;
      } else {
        form.hidden = true;
      }
    });

    document.getElementById('upload-image-btn').addEventListener('click', function () {
      var id = idField.value;
      var fileInput = document.getElementById('image-file');
      var status = document.getElementById('upload-status');
      if (!id) { status.textContent = 'Save the product first, then upload its image(s).'; return; }
      var files = Array.prototype.slice.call(fileInput.files);
      if (!files.length) { status.textContent = 'Choose at least one image file first.'; return; }

      status.textContent = 'Uploading 1 of ' + files.length + '…';

      client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;

        function uploadNext(index) {
          if (index >= files.length) {
            status.textContent = 'Uploaded ' + files.length + ' image(s).';
            fileInput.value = '';
            loadProductImages(id);
            loadProducts();
            return;
          }
          status.textContent = 'Uploading ' + (index + 1) + ' of ' + files.length + '…';
          var file = files[index];
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
              if (json.error) { status.textContent = 'Error on file ' + (index + 1) + ': ' + json.error; return; }
              uploadNext(index + 1);
            })
            .catch(function (err) { status.textContent = 'Error on file ' + (index + 1) + ': ' + err.message; });
        }

        uploadNext(0);
      });
    });

    document.getElementById('publish-btn').addEventListener('click', function () {
      var btn = document.getElementById('publish-btn');
      var status = document.getElementById('publish-status');
      btn.disabled = true;
      status.textContent = 'Publishing… this can take up to a minute.';

      client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;
        fetch('/api/admin/publish', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            btn.disabled = false;
            if (json.error) { status.textContent = 'Error: ' + json.error; return; }
            status.textContent = 'Published: ' + json.deployment.url;
          })
          .catch(function (err) {
            btn.disabled = false;
            status.textContent = 'Error: ' + err.message;
          });
      });
    });

    loadProducts();
  });
})();
