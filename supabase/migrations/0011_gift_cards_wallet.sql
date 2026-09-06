-- E-Bliss Gift Cards + member wallet.
--
-- A gift card is purchased like a product (through the existing cart/
-- checkout flow -- see api/checkout/verify-payment.js), which is why
-- order_items gets an item_type column instead of a separate cart/order
-- system. Once payment is confirmed, one gift_cards row is created per
-- gift-card line item with a freshly generated 16-character code, and the
-- recipient is emailed that code. Redeeming the code credits the
-- redeeming member's wallet_balance -- it is not tied to the original
-- purchaser's account at all, since the whole point is gifting it to
-- someone else's inbox.
--
-- Both balance-changing operations (issuing a wallet debit at checkout,
-- crediting a wallet on redemption) go through security-definer functions
-- rather than plain UPDATEs, so concurrent requests can't double-spend or
-- double-redeem: the row lock taken by each UPDATE's WHERE clause (or the
-- explicit SELECT ... FOR UPDATE in redeem_gift_card) serialises competing
-- attempts. Neither function is granted to authenticated -- both are only
-- ever called with the service-role key from api/checkout/verify-payment.js
-- and api/members/me.js, which have already authenticated the caller.

alter table members add column wallet_balance numeric(10,2) not null default 0;

alter table orders add column wallet_amount_used numeric(10,2) not null default 0;

alter table order_items add column item_type text not null default 'product' check (item_type in ('product','gift_card'));

create table gift_cards (
  id                   uuid primary key default gen_random_uuid(),
  serial               bigint generated always as identity,
  order_id             uuid references orders(id) on delete set null,
  order_item_id        uuid references order_items(id) on delete set null,
  code                 text not null unique,
  amount               numeric(10,2) not null check (amount > 0),
  status               text not null default 'active' check (status in ('active','redeemed')),
  sender_name          text not null,
  sender_email         text,
  sender_phone         text,
  recipient_name       text not null,
  recipient_email      text not null,
  message              text,
  purchaser_member_id  uuid references members(id) on delete set null,
  redeemed_by          uuid references members(id) on delete set null,
  redeemed_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index gift_cards_order_id_idx on gift_cards (order_id);

alter table gift_cards enable row level security;

-- Admin-only. Issuing (checkout) and redeeming both go through service-role
-- code paths, same lockdown shape as admin_users/members.
create policy gift_cards_admin_select on gift_cards
  for select to authenticated using (is_admin());

-- Atomically redeem a gift card code into a member's wallet. Raises if the
-- code doesn't exist, is already redeemed, or the member row doesn't exist
-- yet (a members row is created lazily on first GET /api/members/me, so in
-- practice this can only happen if that hasn't run even once).
create function redeem_gift_card(p_code text, p_member_id uuid)
returns table(amount numeric, new_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift gift_cards%rowtype;
  v_new_balance numeric(10,2);
begin
  select * into v_gift from gift_cards where code = p_code for update;
  if not found then
    raise exception 'Invalid gift card code';
  end if;
  if v_gift.status = 'redeemed' then
    raise exception 'This gift card has already been redeemed';
  end if;

  update gift_cards
    set status = 'redeemed', redeemed_by = p_member_id, redeemed_at = now()
    where id = v_gift.id;

  update members
    set wallet_balance = wallet_balance + v_gift.amount, updated_at = now()
    where id = p_member_id
    returning wallet_balance into v_new_balance;
  if not found then
    raise exception 'Member account not found';
  end if;

  return query select v_gift.amount, v_new_balance;
end;
$$;

revoke all on function redeem_gift_card(text, uuid) from public, authenticated, anon;

-- Atomically deduct from a member's wallet at checkout. The WHERE clause's
-- balance check makes the deduction fail closed (0 rows updated) rather
-- than going negative if two checkouts race.
create function deduct_wallet(p_member_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(10,2);
begin
  if p_amount <= 0 then
    raise exception 'Invalid wallet deduction amount';
  end if;

  update members
    set wallet_balance = wallet_balance - p_amount, updated_at = now()
    where id = p_member_id and wallet_balance >= p_amount
    returning wallet_balance into v_new_balance;
  if not found then
    raise exception 'Insufficient wallet balance';
  end if;

  return v_new_balance;
end;
$$;

revoke all on function deduct_wallet(uuid, numeric) from public, authenticated, anon;
