-- Deleting an order that included a gift card must invalidate that gift
-- card too -- otherwise its code stays redeemable forever even though the
-- order that paid for it (and the payment/wallet record backing it) is
-- gone. Was "on delete set null", which orphaned a still-valid,
-- still-redeemable code with no order behind it.
alter table gift_cards drop constraint gift_cards_order_id_fkey;
alter table gift_cards
  add constraint gift_cards_order_id_fkey
  foreign key (order_id) references orders(id) on delete cascade;
