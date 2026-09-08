

create table admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  role       text not null default 'admin' check (role in ('admin','superadmin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_users_role_idx on admin_users (role);

alter table admin_users enable row level security;

insert into admin_users (id, email, role)
values ('52397551-75d2-4d6f-84b3-89d2b765d50d', 'shreyaahdesignz2026@gmail.com', 'superadmin')
on conflict (id) do nothing;
