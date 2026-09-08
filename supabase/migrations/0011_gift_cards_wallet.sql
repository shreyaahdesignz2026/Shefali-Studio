

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

create policy gift_cards_admin_select on gift_cards
  for select to authenticated using (is_admin());

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
