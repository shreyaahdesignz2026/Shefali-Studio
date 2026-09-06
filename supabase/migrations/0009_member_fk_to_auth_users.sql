-- member_wishlist, member_addresses, orders.member_id and
-- form_submissions.member_id previously referenced members(id). The
-- `members` row is created lazily (first GET /api/members/me, or by an
-- admin) rather than at the moment an auth.users row is created -- OTP
-- login (api/members/request-otp.js's generateLink) creates the auth user
-- silently, with no server round-trip that also creates a `members` row.
-- A brand-new member interacting with the wishlist (direct RLS, not
-- gated by requireMember) before ever visiting /members/ hit a foreign-key
-- violation as a result. members.id is always equal to auth.users.id
-- whenever a members row exists, so pointing these at auth.users(id)
-- directly is equally correct and removes the ordering dependency.

alter table member_wishlist drop constraint member_wishlist_member_id_fkey;
alter table member_wishlist add constraint member_wishlist_member_id_fkey
  foreign key (member_id) references auth.users(id) on delete cascade;

alter table member_addresses drop constraint member_addresses_member_id_fkey;
alter table member_addresses add constraint member_addresses_member_id_fkey
  foreign key (member_id) references auth.users(id) on delete cascade;

alter table orders drop constraint orders_member_id_fkey;
alter table orders add constraint orders_member_id_fkey
  foreign key (member_id) references auth.users(id) on delete set null;

alter table form_submissions drop constraint form_submissions_member_id_fkey;
alter table form_submissions add constraint form_submissions_member_id_fkey
  foreign key (member_id) references auth.users(id) on delete set null;
