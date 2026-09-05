-- Admin/superadmin accounts. This table is the single source of truth for
-- who is allowed into the admin panel and what role they hold — it is
-- deliberately locked down with no RLS policies for anon/authenticated at
-- all. Every read and write goes through the service-role API route in
-- api/admin/admin-users.js, which runs its own requireAdmin() check plus
-- the role-based permission rules (see api/_lib/adminRoles.js) before
-- touching this table. Expressing "a superadmin can edit anyone but an
-- admin can only add new admins" as plain RLS policies isn't practical
-- without a security-definer function, so that logic lives in application
-- code instead.
create table admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  role       text not null default 'admin' check (role in ('admin','superadmin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_users_role_idx on admin_users (role);

alter table admin_users enable row level security;

-- Seed the one admin account that already exists (created by
-- scripts/create-admin-user.js before this table existed) as the
-- project's first superadmin, so the new role check doesn't lock out the
-- only admin the moment it's deployed.
insert into admin_users (id, email, role)
values ('52397551-75d2-4d6f-84b3-89d2b765d50d', 'shreyaahdesignz2026@gmail.com', 'superadmin')
on conflict (id) do nothing;
