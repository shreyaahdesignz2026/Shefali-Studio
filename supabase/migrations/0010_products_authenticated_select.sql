-- A logged-in member authenticates as `authenticated`, not `anon`, so the
-- existing products_anon_select_active policy (scoped `to anon`) never
-- applied to them -- and products_admin_all requires is_admin(). That left
-- no policy granting a non-admin member read access to active products at
-- all, which silently nulled out the embedded product join in main.js's
-- member_wishlist select (`member_wishlist.select('product_id,
-- products(...)')`). A member should never have less product-browsing
-- access than an anonymous visitor, so this mirrors the anon policy for
-- authenticated too.
create policy products_authenticated_select_active on products
  for select to authenticated
  using (status = 'active');
