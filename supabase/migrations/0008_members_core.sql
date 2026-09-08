

create function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admin_users where id = auth.uid());
$$;

drop policy products_admin_all on products;
create policy products_admin_all on products
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy orders_admin_select on orders;
create policy orders_admin_select on orders
  for select to authenticated using (is_admin());

drop policy orders_admin_update on orders;
create policy orders_admin_update on orders
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy orders_admin_delete on orders;
create policy orders_admin_delete on orders
  for delete to authenticated using (is_admin());

drop policy order_items_admin_select on order_items;
create policy order_items_admin_select on order_items
  for select to authenticated using (is_admin());

drop policy product_images_admin_all on product_images;
create policy product_images_admin_all on product_images
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy form_submissions_admin_all on form_submissions;
create policy form_submissions_admin_all on form_submissions
  for all to authenticated using (is_admin()) with check (is_admin());

create table members (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text,
  phone        text,
  note         text,
  plan         text not null default 'free_tier' check (plan in ('free_tier','artisoul_member')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index members_plan_idx on members (plan);

alter table members enable row level security;

create policy members_self_select on members
  for select to authenticated using (id = auth.uid());

create policy members_admin_select on members
  for select to authenticated using (is_admin());

create table member_addresses (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  label        text,
  name         text not null,
  phone        text not null,
  address_line text not null,
  city         text not null,
  state        text not null,
  pincode      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index member_addresses_member_id_idx on member_addresses (member_id);

alter table member_addresses enable row level security;

create policy member_addresses_self_all on member_addresses
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

create policy member_addresses_admin_select on member_addresses
  for select to authenticated using (is_admin());

create function enforce_member_address_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from member_addresses where member_id = new.member_id) >= 5 then
    raise exception 'A member may save at most 5 addresses';
  end if;
  return new;
end;
$$;

create trigger member_addresses_limit
  before insert on member_addresses
  for each row execute function enforce_member_address_limit();

create table member_wishlist (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (member_id, product_id)
);

create index member_wishlist_member_id_idx on member_wishlist (member_id);

alter table member_wishlist enable row level security;

create policy member_wishlist_self_all on member_wishlist
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

create table member_otp_requests (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now()
);

create index member_otp_requests_email_idx on member_otp_requests (email, created_at desc);

alter table member_otp_requests enable row level security;

create table member_email_change_requests (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  new_email   text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index member_email_change_requests_member_id_idx on member_email_change_requests (member_id, created_at desc);

alter table member_email_change_requests enable row level security;

alter table orders add column member_id uuid references members(id) on delete set null;
create index orders_member_id_idx on orders (member_id);

create policy orders_member_select on orders
  for select to authenticated using (member_id = auth.uid());

alter table form_submissions add column member_id uuid references members(id) on delete set null;
alter table form_submissions add column happens_at timestamptz;
create index form_submissions_member_id_idx on form_submissions (member_id);

create policy form_submissions_member_select on form_submissions
  for select to authenticated using (member_id = auth.uid());
