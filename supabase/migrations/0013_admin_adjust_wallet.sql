-- Lets an admin add or subtract an arbitrary amount from a member's
-- E-Bliss Wallet balance (api/admin/members.js, ?action=adjust-wallet).
-- Atomic for the same reason redeem_gift_card/deduct_wallet are: the
-- UPDATE's WHERE clause serialises against a concurrent redemption or
-- checkout deduction on the same row, and the balance is never allowed to
-- go negative. Not granted to authenticated -- service-role only, called
-- after api/_lib/auth.js's requireAdmin has already checked the caller.
create function admin_adjust_wallet(p_member_id uuid, p_delta numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(10,2);
begin
  update members
    set wallet_balance = wallet_balance + p_delta, updated_at = now()
    where id = p_member_id and wallet_balance + p_delta >= 0
    returning wallet_balance into v_new_balance;
  if not found then
    raise exception 'That would take the wallet balance below zero';
  end if;

  return v_new_balance;
end;
$$;

revoke all on function admin_adjust_wallet(uuid, numeric) from public, authenticated, anon;
