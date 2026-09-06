-- Extends form_submissions to accept the Artisoul Tribe membership-interest
-- form (artisoul-tribe/index.html), the last of the site's enquiry forms
-- still lacking a backend. Same table, same admin-review pattern as
-- service_booking/contact_individual/contact_corporate/event_registration —
-- no new machinery.
alter table form_submissions drop constraint form_submissions_form_type_check;
alter table form_submissions add constraint form_submissions_form_type_check
  check (form_type in (
    'service_booking',
    'contact_individual',
    'contact_corporate',
    'event_registration',
    'artisoul_tribe'
  ));
