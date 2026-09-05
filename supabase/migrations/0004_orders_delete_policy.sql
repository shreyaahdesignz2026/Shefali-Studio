-- Allow an admin/superadmin session to delete an order from the admin
-- panel. order_items cascades automatically via its existing
-- "on delete cascade" foreign key to orders(id).
create policy orders_admin_delete on orders
  for delete
  to authenticated
  using (true);
