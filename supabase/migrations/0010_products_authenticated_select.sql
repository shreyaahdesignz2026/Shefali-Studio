

create policy products_authenticated_select_active on products
  for select to authenticated
  using (status = 'active');
