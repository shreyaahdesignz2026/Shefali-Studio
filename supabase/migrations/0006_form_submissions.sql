

create table form_submissions (
  id         uuid primary key default gen_random_uuid(),
  form_type  text not null check (form_type in ('service_booking','contact_individual','contact_corporate','event_registration')),
  name       text not null,
  phone      text,
  email      text,
  message    text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index form_submissions_form_type_idx on form_submissions (form_type, created_at desc);

alter table form_submissions enable row level security;

create policy form_submissions_admin_all on form_submissions
  for all
  to authenticated
  using (true)
  with check (true);
