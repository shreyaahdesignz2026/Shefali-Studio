
create table products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,
  subcategory    text,
  description    text,
  price          numeric(10,2) not null,
  original_price numeric(10,2),
  is_provisional boolean not null default false,
  image_path     text,
  status         text not null default 'active' check (status in ('active','archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_status_idx on products (status);
create index products_category_idx on products (category);

create table orders (
  id                   uuid primary key default gen_random_uuid(),
  razorpay_order_id    text not null,
  razorpay_payment_id  text,
  razorpay_signature   text,
  is_test_payment      boolean not null default false,
  status               text not null default 'placed' check (status in ('placed','cancelled','delivered')),
  subtotal             numeric(10,2) not null,
  shipping_fee         numeric(10,2) not null default 300,
  grand_total          numeric(10,2) not null,
  customer_name        text not null,
  customer_phone       text not null,
  customer_email       text,
  address_line         text not null,
  city                 text not null,
  state                text not null,
  pincode              text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index orders_status_idx on orders (status);
create index orders_razorpay_order_id_idx on orders (razorpay_order_id);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  unit_price   numeric(10,2) not null,
  qty          integer not null check (qty > 0),
  line_total   numeric(10,2) not null
);

create index order_items_order_id_idx on order_items (order_id);

alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy products_anon_select_active on products
  for select
  to anon
  using (status = 'active');

create policy products_admin_all on products
  for all
  to authenticated
  using (true)
  with check (true);

create policy orders_admin_select on orders
  for select
  to authenticated
  using (true);

create policy orders_admin_update on orders
  for update
  to authenticated
  using (true)
  with check (true);

create policy order_items_admin_select on order_items
  for select
  to authenticated
  using (true);
