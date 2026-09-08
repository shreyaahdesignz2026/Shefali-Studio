

alter table gift_cards drop constraint gift_cards_order_id_fkey;
alter table gift_cards
  add constraint gift_cards_order_id_fkey
  foreign key (order_id) references orders(id) on delete cascade;
