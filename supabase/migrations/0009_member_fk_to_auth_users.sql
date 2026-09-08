

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
