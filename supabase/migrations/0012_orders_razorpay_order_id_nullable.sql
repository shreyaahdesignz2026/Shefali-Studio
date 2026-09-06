-- An order paid entirely from the wallet (see api/checkout/verify-payment.js's
-- zero-remainder path) never creates a Razorpay order at all.
alter table orders alter column razorpay_order_id drop not null;
