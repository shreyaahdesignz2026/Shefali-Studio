-- Captures the services booking form, both contact forms (individual and
-- corporate), and the events registration form — none of which had any
-- backend before this. One flexible table rather than four rigid ones:
-- `details` holds whatever fields are specific to that form_type (the
-- session/event chosen, date/time, mode, org, budget, etc.), `message`
-- holds whichever field is that form's free-text note, and `name`/`phone`/
-- `email` are common to all four.
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

-- Inserts happen only via api/enquiries.js using the service-role key
-- (with its own server-side validation per form_type), so the only RLS
-- policy needed is admin read/manage access — same shape as orders.
create policy form_submissions_admin_all on form_submissions
  for all
  to authenticated
  using (true)
  with check (true);
