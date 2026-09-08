

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  slug       text not null default gen_random_uuid()::text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index product_images_product_slug_idx on product_images (product_id, slug);
create index product_images_product_id_idx on product_images (product_id, position);

alter table product_images enable row level security;

create policy product_images_admin_all on product_images
  for all
  to authenticated
  using (true)
  with check (true);

insert into product_images (product_id, slug, position)
select id, 'image', 0 from products where image_path is not null;

alter table products drop column image_path;
