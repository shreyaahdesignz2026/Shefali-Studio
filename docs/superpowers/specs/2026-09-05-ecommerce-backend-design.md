# E-commerce backend, admin panel & checkout — design

Status: approved by user 2026-09-05. Ready for implementation planning.

## 1. Problem

The site (`Shreyaah's Bliss Trails`) is currently 100% static HTML with no
backend. `products/index.html` hardcodes 84 product cards with no images and
no stable IDs. `cart/` and `wishlist/` are client-side `localStorage` only.
There is no `checkout/` page — the cart links out to WhatsApp/email instead.
There is no way to take a real payment, record an order, or manage the
catalog without hand-editing HTML.

This spec covers: a Supabase-backed product catalog, an admin panel for
product CRUD (with image upload → WebP/AVIF conversion) and order
management, a real checkout page with Razorpay payment, and a publish
mechanism that keeps the public storefront static so ordinary browsing never
touches Supabase.

## 2. Goals / non-goals

**Goals**
- Admin can create/edit/archive products, including uploading one image per
  product, from a browser — no HTML editing.
- Storefront visitors can complete a real purchase (Razorpay, test key for
  now) and see an accurate grand total (subtotal + flat ₹300 shipping).
- Every order (test-key or eventually live-key) is visible in the admin
  panel with full customer/shipping details and line items.
- Admin can transition an order's status between `placed` / `cancelled` /
  `delivered`.
- Keep Supabase egress as low as practical: the public storefront should
  read from Supabase as close to never as possible.

**Non-goals (explicitly out of scope for this spec)**
- Customer accounts / login / order history for shoppers (guest checkout
  only, matches current site behavior — "Accounts aren't open yet").
- Multiple images per product (v1 is one image per product; schema can grow
  later without a breaking change).
- Inventory/stock tracking, coupons, taxes, multiple shipping tiers.
- Email/SMS order notifications (can be a follow-up phase, not required by
  the request this spec answers).
- Automatic redeploy on every product edit — publishing is a deliberate
  admin action (a button), not implicit on every save.

## 3. Architecture

- **Database / Storage / Auth**: Supabase (Postgres + Storage + Auth). Single
  admin user via Supabase Auth (email + password). Row Level Security gates
  all writes; the anon key is used for the storefront's narrow, low-volume
  reads (checkout price lookup) and the admin panel's authenticated reads.
- **Backend logic**: Vercel Serverless Functions under `/api/*` (Node.js
  runtime). Chosen over Supabase Edge Functions (Deno) because AVIF/WebP
  encoding needs `sharp`, which isn't available in Deno Deploy, and because
  the site already deploys on Vercel — one platform for all server code.
  Uses `@supabase/supabase-js` with the **service role key** (server-side
  only, never shipped to the client) for privileged writes (order creation,
  image storage writes).
- **Admin panel**: new static page(s) under `/admin/` in the existing site,
  vanilla JS (matches the site's no-build-step convention), gated by a
  Supabase Auth session. Talks to Supabase directly for product/order
  reads and simple writes (RLS-protected), and to the three privileged API
  routes below for things that need server-side secrets or `sharp`.
- **Checkout**: new `/checkout/` page. Reads the cart from the existing
  `localStorage` scheme (extended to carry product IDs), never trusts
  client-supplied prices for the actual charge.
- **Publish**: an admin-triggered API route regenerates the static
  `products/index.html` from the current `products` table and pushes a new
  Vercel deployment via the Vercel API — the same git-metadata-free deploy
  technique already validated manually on this project (bypasses the
  Hobby-plan "commit author must be team member" block, since it deploys a
  plain file tree with no `.git` attached).

## 4. Data model

```sql
create table products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null,        -- matches existing data-cat values e.g. 'candles'
  subcategory   text,                 -- shown as the product-tag / product-cat label
  description   text,
  price         numeric(10,2) not null,
  original_price numeric(10,2),       -- nullable; when set, price is a "sale" price
  is_provisional boolean not null default false,  -- "price to confirm" flag
  image_path    text,                 -- storage path prefix; null => front-end placeholder
  status        text not null default 'active' check (status in ('active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table orders (
  id               uuid primary key default gen_random_uuid(),
  razorpay_order_id   text not null,
  razorpay_payment_id text,
  razorpay_signature  text,
  is_test_payment  boolean not null default false,
  status           text not null default 'placed' check (status in ('placed','cancelled','delivered')),
  subtotal         numeric(10,2) not null,
  shipping_fee     numeric(10,2) not null default 300,
  grand_total      numeric(10,2) not null,
  customer_name    text not null,
  customer_phone   text not null,
  customer_email   text,
  address_line     text not null,
  city             text not null,
  state            text not null,
  pincode          text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,   -- snapshot, survives product edits/deletes
  unit_price    numeric(10,2) not null,  -- snapshot
  qty           integer not null check (qty > 0),
  line_total    numeric(10,2) not null
);
```

RLS: `products` and `orders`/`order_items` full read/write is restricted to
`auth.role() = 'authenticated'` — since exactly one Supabase Auth user will
ever exist for this project (the admin), authentication alone is a
sufficient admin check; no separate roles table is needed for a single-admin
site. The storefront's checkout price lookup uses a narrow `select id, name,
price, original_price, is_provisional where status = 'active'` policy open
to `anon` — safe, since prices are meant to be public. `orders`/`order_items`
inserts from the checkout flow happen via the service role key inside
`verify-payment` (bypassing RLS deliberately, since that route already does
its own signature-based trust check), never via the anon key.

## 5. API routes (Vercel Serverless Functions)

- `POST /api/checkout/create-order` — body: `{ items: [{product_id, qty}],
  customer: {...} }`. Re-fetches current prices from `products` (never
  trusts a client-sent amount), computes subtotal + ₹300 shipping, creates a
  Razorpay order via the `razorpay` npm SDK, returns `{razorpay_order_id,
  amount, key_id}` to the client.
- `POST /api/checkout/verify-payment` — body: `{razorpay_order_id,
  razorpay_payment_id, razorpay_signature, items, customer}`. Verifies the
  HMAC-SHA256 signature with the Razorpay key secret. Recomputes the price
  total the same way as create-order and rejects on mismatch (handles the
  rare case where a product's price changed mid-checkout). On success,
  inserts `orders` + `order_items` (status `placed`, `is_test_payment`
  derived from whether the configured key id starts with `rzp_test_`).
  Returns the new order id for the confirmation screen.
- `POST /api/admin/upload-image` — admin-session-gated. Body: multipart
  image + product_id. Runs `sharp` to produce WebP and AVIF derivatives
  (single size, ~1200px max width — no responsive srcset in v1), uploads
  both to Supabase Storage, updates `products.image_path`.
- `POST /api/admin/publish` — admin-session-gated. Reads all `active`
  products, regenerates `products/index.html` (and the illustrated
  placeholder fallback for any product with no `image_path`), deploys via
  the Vercel API using a stored `VERCEL_TOKEN` env var, same git-free-copy
  technique used today. Returns the new deployment URL once ready.

Admin-session gating: each of these routes checks the caller's Supabase
Auth JWT (sent as a bearer token from the admin panel) server-side before
doing anything privileged.

## 6. Checkout flow (client-visible steps)

1. Cart page "Proceed to checkout" → `/checkout/`.
2. Checkout page reads cart from `localStorage`, calls a narrow anon
   Supabase query to refresh prices/names for the items present (protects
   against a stale or tampered local price), and displays a summary:
   subtotal, flat ₹300 delivery, grand total.
3. Customer fills in name, phone, email (optional), address, city, state,
   pincode.
4. "Pay ₹{grand_total}" → `create-order` → open Razorpay Checkout.js modal.
5. On success → `verify-payment` → on success, clear the cart, show an order
   confirmation (order id, summary). On failure, show an error, cart stays
   intact, nothing is written to `orders`.

## 7. Image handling

One image per product. On admin upload: original goes through `sharp`
server-side into WebP + AVIF (no client-side conversion, avoids depending on
browser capability). Front-end product cards use a `<picture>` with AVIF →
WebP → (existing illustrated placeholder as the ultimate fallback when
`image_path` is null). This mirrors a pattern already proven on a related
project, so the known past regression (AVIF markup leaking onto elements
that shouldn't have had it) is a named risk to test against explicitly
during implementation, not a new invention.

## 8. Egress control

- Storefront browsing (`products/index.html`, home, etc.) is pure static
  HTML — zero Supabase reads for ordinary visitors.
- Checkout does one small anon read (only for items actually in the cart,
  not the whole catalog).
- Admin panel reads/writes are inherently low-volume (one person, occasional
  use).
- Publishing is a deliberate action, not triggered on every keystroke/save,
  so it doesn't cause deploy churn.

## 9. Error handling

- Payment verification failure: no order row is written; user sees a retry
  prompt; cart is preserved.
- Price-mismatch at verify time (product edited mid-checkout): treated the
  same as a verification failure — reject, ask the user to retry (rare
  edge case, not worth a reconciliation flow for a boutique store's volume).
- Image upload failure (bad file, `sharp` error): product save still
  succeeds without an image; admin sees an inline error on the image field.
- Publish failure (Vercel deploy error): admin sees the error and the
  previous production deployment stays live untouched (Vercel only swaps
  the alias on success).

## 10. Credentials needed before implementation

- Supabase project URL + anon key + service role key.
- Razorpay test `key_id` + `key_secret`.
- (Already in hand from this session: `VERCEL_TOKEN` for the publish route.)

## 11. Suggested implementation phasing

1. Supabase project setup: schema, RLS policies, admin auth user, storage
   bucket.
2. Admin panel skeleton + auth gate + product CRUD (no images yet).
3. Image upload pipeline (`sharp` derivatives, storage, front-end
   `<picture>` fallback).
4. Publish route + static `products/index.html` regeneration, wired to the
   admin panel's Publish button.
5. Checkout page + Razorpay create/verify routes.
6. Admin order list + customer detail view + status editor.
7. End-to-end verification: a real test-mode purchase, confirm it shows up
   correctly in the admin panel, confirm publish reflects a product edit.
