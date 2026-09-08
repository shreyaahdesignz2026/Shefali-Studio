

alter table form_submissions drop constraint form_submissions_form_type_check;
alter table form_submissions add constraint form_submissions_form_type_check
  check (form_type in (
    'service_booking',
    'contact_individual',
    'contact_corporate',
    'event_registration',
    'artisoul_tribe'
  ));
