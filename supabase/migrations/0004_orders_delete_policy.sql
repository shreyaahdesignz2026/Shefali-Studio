

create policy orders_admin_delete on orders
  for delete
  to authenticated
  using (true);
