# E-commerce Backend, Admin Panel & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the static "Shreyaah's Bliss Trails" site a real backend: a Supabase-backed product catalog manageable from a new admin panel (with image upload → WebP/AVIF conversion), a working checkout with Razorpay payment, and order management (status: placed/cancelled/delivered) — while keeping the public storefront 100% static so ordinary browsing never touches Supabase.

**Architecture:** Supabase (Postgres + Storage + Auth) is the data layer. All backend logic is Vercel Serverless Functions under `/api/*` (Node.js), using `@supabase/supabase-js`, `razorpay`, and `sharp`. The admin panel is new static pages under `/admin/` using the Supabase JS client directly (loaded via CDN) plus three privileged API routes. An admin "Publish" button regenerates `products/index.html` from the DB and redeploys via the Vercel REST API directly (no CLI dependency, no `.git` metadata — the same technique already validated manually on this project to bypass the Hobby-plan "commit author must be a team member" block).

**Tech Stack:** Node.js (Vercel Serverless Functions, `nodejs20.x` runtime), `@supabase/supabase-js`, `razorpay` (npm SDK), `sharp`, Supabase (Postgres/Storage/Auth), Razorpay Checkout.js (client-side), vanilla JS (matches the site's existing no-build-step convention), Node's built-in `node:test` runner for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-05-ecommerce-backend-design.md`

## Global Constraints

- No build step for the storefront itself — plain HTML/CSS/JS, matching the existing site (per its own README: "No build step, no dependencies"). The **only** place `npm`/`package.json` is introduced is for the Vercel serverless functions under `/api/*` and one-off local scripts under `/scripts/*` — the static pages are untouched by any bundler.
- The public storefront must never read Supabase directly for ordinary browsing. Only `checkout/` (a small, cart-sized price lookup) and `/admin/*` talk to Supabase from the browser.
- One image per product (v1). No multiple-image galleries, no customer accounts, no inventory/stock tracking, no coupons/taxes/multiple shipping tiers, no email/SMS notifications — all explicitly out of scope per the spec.
- Flat shipping fee is **₹300**, added to the subtotal for every order — this exact value must never be computed on the trusted (server) side from anything the client sends; it's a hardcoded constant in `api/_lib/pricing.js`.
- Every price used to actually charge a customer must come from the `products` table at the moment of charge, never from the client's `localStorage` or from any client-supplied amount.
- `order_items` snapshot `product_name` and `unit_price` at order time — editing or deleting a product later must never change a past order's recorded values.
- Admin panel is an internal tool. It does **not** need to match the storefront's illustrated/watercolor brand identity — keep its styling plain and functional (a new small `assets/css/admin.css`, not a re-theme of `style.css`). Do not spend effort matching the marketing site's visual design here.
- Testing philosophy: pure logic (pricing math, HMAC signature verification, HTML template generation, admin-auth token check) gets full `node:test` unit test coverage with no network calls, using dependency injection to swap in fakes. Thin I/O glue (the actual Vercel function handlers wiring Supabase/Razorpay/Vercel-API calls together, and all UI code) is verified manually against a real deployed preview or the real test-mode Razorpay flow — mocking an entire external HTTP API for a single boutique-scale store is not worth the engineering cost this project needs elsewhere.
- Credentials already stored as local environment variables this session (do not re-request them): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. Known Vercel identifiers: project id `prj_DrhK5kyBPbI6yE2nKtYmIlxONSgY`, org/team id `team_YqlvSMFfX0jzDSCCthrRgkm0`, project name `shreyaahs-bliss-trails`. Admin login: `shreyaahdesignz2026@gmail.com` / `team@4EWG`.
- Repo root for every file path below: `C:\Users\anind\Downloads\Shreyaah Blissfull Trails\Shreyaah Blissfull Trails` (this is also the git working tree pushed to `github.com/shreyaahdesignz2026/Shefali-Studio`, remote `origin`).
- Commit after every task using the project's existing commit style (`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer) — do **not** push after every task; push once at natural checkpoints (end of a work session or when explicitly told to) since a push doesn't auto-deploy anything on this project anymore (deploys now happen only through `api/admin/publish.js` or a manual Vercel CLI/API call).

---

## Task 1: Project scaffolding — package.json, dependencies, directory layout

**Files:**
- Create: `package.json`
- Create: `vercel.json`
- Create: `api/_lib/.gitkeep`, `api/checkout/.gitkeep`, `api/admin/.gitkeep` (placeholders so empty dirs exist until later tasks populate them — delete each `.gitkeep` in the task that adds a real file to that directory)
- Create: `scripts/.gitkeep`
- Create: `supabase/migrations/.gitkeep`
- Modify: `.gitignore` (confirm `node_modules/` and `.env.local` are present — `.env.local` was already added automatically by `vercel link` earlier this session; verify, don't duplicate)

**Interfaces:**
- Produces: a Node project at the repo root that later tasks add files into. `vercel.json`'s `functions` block will be extended by Tasks 9 and 10 (image upload needs more memory/time; publish needs `includeFiles` and more time) — this task creates the file with an empty `functions: {}` object for them to fill in.

- [ ] **Step 1: Initialize the Node project**

```bash
cd "C:\Users\anind\Downloads\Shreyaah Blissfull Trails\Shreyaah Blissfull Trails"
npm init -y
```

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install @supabase/supabase-js razorpay sharp
npm install --save-dev pg
```

- [ ] **Step 3: Edit `package.json`**

Open the generated `package.json` and set it to exactly:

```json
{
  "name": "shreyaahs-bliss-trails",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "test": "node --test test/"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "razorpay": "^2.9.4",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "pg": "^8.13.0"
  }
}
```

(Keep whatever exact versions `npm install` actually resolved if they differ slightly from these — don't downgrade. The point is the shape: `engines.node: "20.x"` so Vercel builds functions on a `sharp`-compatible runtime, and a `test` script using Node's built-in test runner.)

- [ ] **Step 4: Create `vercel.json`**

```json
{
  "functions": {}
}
```

- [ ] **Step 5: Create the directory layout**

```bash
mkdir -p api/_lib api/checkout api/admin scripts supabase/migrations
touch api/_lib/.gitkeep api/checkout/.gitkeep api/admin/.gitkeep scripts/.gitkeep supabase/migrations/.gitkeep
```

- [ ] **Step 6: Verify `vercel.json` is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 7: Confirm `.gitignore` already covers `node_modules/` and `.env.local`**

Run: `cat .gitignore` (or `Get-Content .gitignore` in PowerShell)
Expected: contains `node_modules/` and `.env.local` (both already present from earlier work this session — if `.env.local` is missing, add it now)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vercel.json api scripts supabase .gitignore
git commit -m "Scaffold Node project for Vercel serverless backend

Adds package.json (supabase-js, razorpay, sharp), vercel.json, and
the directory layout for API routes, one-off scripts, and DB
migrations.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 2: Database schema — products, orders, order_items, RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `scripts/run-sql.js`
- Delete: `supabase/migrations/.gitkeep` (superseded by the real migration file)

**Interfaces:**
- Produces: three tables (`products`, `orders`, `order_items`) that every later task reads/writes. Column names and types below are final — later tasks must match them exactly (e.g. `products.image_path`, `orders.is_test_payment`, `order_items.product_name`).

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:

```sql
-- Products
create table products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,
  subcategory    text,
  description    text,
  price          numeric(10,2) not null,
  original_price numeric(10,2),
  is_provisional boolean not null default false,
  image_path     text,
  status         text not null default 'active' check (status in ('active','archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_status_idx on products (status);
create index products_category_idx on products (category);

-- Orders
create table orders (
  id                   uuid primary key default gen_random_uuid(),
  razorpay_order_id    text not null,
  razorpay_payment_id  text,
  razorpay_signature   text,
  is_test_payment      boolean not null default false,
  status               text not null default 'placed' check (status in ('placed','cancelled','delivered')),
  subtotal             numeric(10,2) not null,
  shipping_fee         numeric(10,2) not null default 300,
  grand_total          numeric(10,2) not null,
  customer_name        text not null,
  customer_phone       text not null,
  customer_email       text,
  address_line         text not null,
  city                 text not null,
  state                text not null,
  pincode              text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index orders_status_idx on orders (status);
create index orders_razorpay_order_id_idx on orders (razorpay_order_id);

-- Order line items
create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  unit_price   numeric(10,2) not null,
  qty          integer not null check (qty > 0),
  line_total   numeric(10,2) not null
);

create index order_items_order_id_idx on order_items (order_id);

-- Row Level Security
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Public (anon) can read only active products' public fields — used by the
-- checkout page's price-refresh lookup and by nothing else client-side.
create policy products_anon_select_active on products
  for select
  to anon
  using (status = 'active');

-- The authenticated admin (the one Supabase Auth user this project will
-- ever have) can do everything on products.
create policy products_admin_all on products
  for all
  to authenticated
  using (true)
  with check (true);

-- Orders and order_items: admin-only. Inserts from the checkout flow happen
-- via the service role key inside api/checkout/verify-payment.js, which
-- bypasses RLS deliberately (that route already does its own HMAC
-- signature check before writing) — anon and authenticated get no insert
-- policy on orders/order_items at all, only the admin's authenticated
-- select/update.
create policy orders_admin_select on orders
  for select
  to authenticated
  using (true);

create policy orders_admin_update on orders
  for update
  to authenticated
  using (true)
  with check (true);

create policy order_items_admin_select on order_items
  for select
  to authenticated
  using (true);
```

- [ ] **Step 2: Write the migration runner script**

Create `scripts/run-sql.js`:

```js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: node scripts/run-sql.js <path-to-sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(sqlPath), 'utf8');

  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Applied ${sqlPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run the migration**

```bash
node scripts/run-sql.js supabase/migrations/0001_init.sql
```

Expected: prints `Applied supabase/migrations/0001_init.sql`

- [ ] **Step 4: Verify the tables and RLS exist**

```bash
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(() => c.query(\"select table_name from information_schema.tables where table_schema='public' order by table_name\"))
  .then(r => { console.log(r.rows.map(x => x.table_name)); return c.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
"
```

Expected: `[ 'order_items', 'orders', 'products' ]`

- [ ] **Step 5: Delete the placeholder and commit**

```bash
rm supabase/migrations/.gitkeep
git add supabase scripts/run-sql.js
git commit -m "Add products/orders/order_items schema with RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 3: Admin auth — Supabase Auth user + `api/_lib/auth.js`

**Files:**
- Create: `scripts/create-admin-user.js`
- Create: `api/_lib/auth.js`
- Create: `test/auth.test.js`
- Delete: `api/_lib/.gitkeep`

**Interfaces:**
- Produces: `requireAdmin(authHeader)` — an async function exported from `api/_lib/auth.js`. Takes the raw `Authorization` header string (e.g. `"Bearer eyJ..."`), returns the Supabase user object on success, **throws an `Error` with a `.status` property** (401 or 403) on failure. Tasks 9, 10, and admin API routes all call this the same way: `const user = await requireAdmin(req.headers.authorization);`.
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_ANON_KEY`, `process.env.ADMIN_EMAIL` (set in Task 6).

- [ ] **Step 1: Write the admin user creation script**

Create `scripts/create-admin-user.js`:

```js
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars first.');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error('Failed to create admin user:', error.message);
    process.exit(1);
  }
  console.log('Created admin user:', data.user.id, data.user.email);
}

main();
```

- [ ] **Step 2: Run it once to create the admin account**

```bash
export ADMIN_EMAIL="shreyaahdesignz2026@gmail.com"
export ADMIN_PASSWORD="team@4EWG"
node scripts/create-admin-user.js
```

Expected: `Created admin user: <uuid> shreyaahdesignz2026@gmail.com`

- [ ] **Step 3: Write `api/_lib/auth.js` with an injectable client (for testability)**

```js
const { createClient } = require('@supabase/supabase-js');

function makeRequireAdmin(getClient) {
  return async function requireAdmin(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Missing Authorization header');
      err.status = 401;
      throw err;
    }
    const token = authHeader.slice('Bearer '.length);
    const supabase = getClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      const err = new Error('Invalid or expired session');
      err.status = 401;
      throw err;
    }
    if (data.user.email !== process.env.ADMIN_EMAIL) {
      const err = new Error('Not the admin account');
      err.status = 403;
      throw err;
    }
    return data.user;
  };
}

const defaultClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = {
  requireAdmin: makeRequireAdmin(defaultClient),
  makeRequireAdmin,
};
```

- [ ] **Step 4: Write the failing test first**

Create `test/auth.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRequireAdmin } = require('../api/_lib/auth');

function fakeClient(getUserResult) {
  return () => ({
    auth: {
      getUser: async () => getUserResult,
    },
  });
}

test('rejects a missing Authorization header', async () => {
  const requireAdmin = makeRequireAdmin(fakeClient({ data: null, error: null }));
  await assert.rejects(() => requireAdmin(undefined), /Missing Authorization header/);
});

test('rejects an invalid token', async () => {
  const requireAdmin = makeRequireAdmin(
    fakeClient({ data: null, error: new Error('bad token') })
  );
  await assert.rejects(
    () => requireAdmin('Bearer not-a-real-token'),
    /Invalid or expired session/
  );
});

test('rejects a valid session that is not the admin email', async () => {
  process.env.ADMIN_EMAIL = 'shreyaahdesignz2026@gmail.com';
  const requireAdmin = makeRequireAdmin(
    fakeClient({ data: { user: { email: 'someone-else@example.com' } }, error: null })
  );
  await assert.rejects(() => requireAdmin('Bearer some-token'), /Not the admin account/);
});

test('accepts a valid admin session', async () => {
  process.env.ADMIN_EMAIL = 'shreyaahdesignz2026@gmail.com';
  const requireAdmin = makeRequireAdmin(
    fakeClient({
      data: { user: { email: 'shreyaahdesignz2026@gmail.com', id: 'abc' } },
      error: null,
    })
  );
  const user = await requireAdmin('Bearer some-token');
  assert.equal(user.email, 'shreyaahdesignz2026@gmail.com');
});
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/auth.test.js`
Expected: 4 tests pass

- [ ] **Step 6: Delete the placeholder and commit**

```bash
rm api/_lib/.gitkeep
git add scripts/create-admin-user.js api/_lib/auth.js test/auth.test.js
git commit -m "Add admin Supabase Auth user and requireAdmin() token check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 4: `api/_lib/supabaseAdmin.js` and `api/_lib/pricing.js`

**Files:**
- Create: `api/_lib/supabaseAdmin.js`
- Create: `api/_lib/pricing.js`
- Create: `test/pricing.test.js`

**Interfaces:**
- Produces: `getSupabaseAdmin()` from `supabaseAdmin.js` — returns a Supabase client authenticated with the service role key (bypasses RLS). Used by Tasks 9, 10, and both checkout routes.
- Produces: `computeTotals(cartItems, products)` from `pricing.js` where `cartItems` is `[{product_id, qty}]` and `products` is the array of matching rows from `products` table (as returned by a Supabase `select`). Returns `{ lineItems, subtotal, shippingFee, grandTotal }` where `lineItems` is `[{product_id, name, unit_price, qty, line_total}]`. Throws `Error` if a `product_id` isn't found in `products`, if a product's `status !== 'active'`, or if `qty` isn't a positive integer. `SHIPPING_FEE` (300) is also exported as a named constant.

- [ ] **Step 1: Write `api/_lib/supabaseAdmin.js`**

```js
const { createClient } = require('@supabase/supabase-js');

let cached = null;

function getSupabaseAdmin() {
  if (!cached) {
    cached = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return cached;
}

module.exports = { getSupabaseAdmin };
```

- [ ] **Step 2: Write the failing tests for `pricing.js`**

Create `test/pricing.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeTotals, SHIPPING_FEE } = require('../api/_lib/pricing');

const PRODUCTS = [
  { id: 'p1', name: 'Cranberry Orange Fresh', price: 175, status: 'active' },
  { id: 'p2', name: 'Massage Candle', price: 555, status: 'active' },
  { id: 'p3', name: 'Archived Thing', price: 100, status: 'archived' },
];

test('computes subtotal, flat shipping, and grand total for multiple items', () => {
  const result = computeTotals(
    [{ product_id: 'p1', qty: 2 }, { product_id: 'p2', qty: 1 }],
    PRODUCTS
  );
  assert.equal(result.subtotal, 175 * 2 + 555);
  assert.equal(result.shippingFee, 300);
  assert.equal(result.grandTotal, 175 * 2 + 555 + 300);
  assert.equal(result.lineItems.length, 2);
  assert.deepEqual(result.lineItems[0], {
    product_id: 'p1',
    name: 'Cranberry Orange Fresh',
    unit_price: 175,
    qty: 2,
    line_total: 350,
  });
});

test('SHIPPING_FEE constant is 300', () => {
  assert.equal(SHIPPING_FEE, 300);
});

test('throws when a product_id is not found', () => {
  assert.throws(
    () => computeTotals([{ product_id: 'does-not-exist', qty: 1 }], PRODUCTS),
    /not found/
  );
});

test('throws when a product is archived', () => {
  assert.throws(
    () => computeTotals([{ product_id: 'p3', qty: 1 }], PRODUCTS),
    /not found/
  );
});

test('throws on zero or negative qty', () => {
  assert.throws(() => computeTotals([{ product_id: 'p1', qty: 0 }], PRODUCTS), /qty/);
  assert.throws(() => computeTotals([{ product_id: 'p1', qty: -1 }], PRODUCTS), /qty/);
});

test('throws on an empty cart', () => {
  assert.throws(() => computeTotals([], PRODUCTS), /empty/);
});

test('rounds line and grand totals to 2 decimal places', () => {
  const products = [{ id: 'p4', name: 'Odd Price', price: 33.333, status: 'active' }];
  const result = computeTotals([{ product_id: 'p4', qty: 3 }], products);
  assert.equal(result.lineItems[0].line_total, 100);
  assert.equal(result.subtotal, 100);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `node --test test/pricing.test.js`
Expected: FAIL — `Cannot find module '../api/_lib/pricing'`

- [ ] **Step 4: Implement `api/_lib/pricing.js`**

```js
const SHIPPING_FEE = 300;

function computeTotals(cartItems, products) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  const byId = new Map(products.filter((p) => p.status === 'active').map((p) => [p.id, p]));

  const lineItems = cartItems.map((item) => {
    const product = byId.get(item.product_id);
    if (!product) {
      throw new Error(`Product not found or inactive: ${item.product_id}`);
    }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(`Invalid qty for product ${item.product_id}: ${item.qty}`);
    }
    const unitPrice = Number(product.price);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    return {
      product_id: product.id,
      name: product.name,
      unit_price: unitPrice,
      qty,
      line_total: lineTotal,
    };
  });

  const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.line_total, 0) * 100) / 100;
  const grandTotal = Math.round((subtotal + SHIPPING_FEE) * 100) / 100;

  return { lineItems, subtotal, shippingFee: SHIPPING_FEE, grandTotal };
}

module.exports = { computeTotals, SHIPPING_FEE };
```

- [ ] **Step 5: Run the tests again**

Run: `node --test test/pricing.test.js`
Expected: 7 tests pass

- [ ] **Step 6: Commit**

```bash
git add api/_lib/supabaseAdmin.js api/_lib/pricing.js test/pricing.test.js
git commit -m "Add service-role Supabase client and server-side pricing math

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 5: `api/_lib/razorpaySignature.js`

**Files:**
- Create: `api/_lib/razorpaySignature.js`
- Create: `test/razorpaySignature.test.js`

**Interfaces:**
- Produces: `verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }, keySecret)` — pure function returning `true`/`false`. Used by `api/checkout/verify-payment.js` (Task 11).

- [ ] **Step 1: Write the failing test**

Create `test/razorpaySignature.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyPaymentSignature } = require('../api/_lib/razorpaySignature');

test('accepts a correctly computed signature', () => {
  const keySecret = 'test-secret';
  const razorpay_order_id = 'order_ABC123';
  const razorpay_payment_id = 'pay_XYZ789';
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const ok = verifyPaymentSignature(
    { razorpay_order_id, razorpay_payment_id, razorpay_signature: expected },
    keySecret
  );
  assert.equal(ok, true);
});

test('rejects a tampered signature', () => {
  const ok = verifyPaymentSignature(
    {
      razorpay_order_id: 'order_ABC123',
      razorpay_payment_id: 'pay_XYZ789',
      razorpay_signature: 'not-the-real-signature',
    },
    'test-secret'
  );
  assert.equal(ok, false);
});

test('rejects when signed with the wrong secret', () => {
  const razorpay_order_id = 'order_ABC123';
  const razorpay_payment_id = 'pay_XYZ789';
  const wrongSig = crypto
    .createHmac('sha256', 'wrong-secret')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const ok = verifyPaymentSignature(
    { razorpay_order_id, razorpay_payment_id, razorpay_signature: wrongSig },
    'test-secret'
  );
  assert.equal(ok, false);
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `node --test test/razorpaySignature.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `api/_lib/razorpaySignature.js`**

```js
const crypto = require('node:crypto');

function verifyPaymentSignature(
  { razorpay_order_id, razorpay_payment_id, razorpay_signature },
  keySecret
) {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(razorpay_signature || '', 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyPaymentSignature };
```

- [ ] **Step 4: Run the tests again**

Run: `node --test test/razorpaySignature.test.js`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add api/_lib/razorpaySignature.js test/razorpaySignature.test.js
git commit -m "Add Razorpay HMAC payment signature verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 6: Configure Vercel environment variables

**Files:** none (Vercel project configuration only)

**Interfaces:**
- Produces: the following environment variables available to every function under `/api/*` at runtime on Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Every later task's API routes assume these exist in the deployed environment (not just locally).

- [ ] **Step 1: Add each variable via the Vercel REST API**

Run once per variable (values are the same ones already stored locally as environment variables this session):

```bash
add_env() {
  curl -s -X POST \
    "https://api.vercel.com/v10/projects/prj_DrhK5kyBPbI6yE2nKtYmIlxONSgY/env?teamId=team_YqlvSMFfX0jzDSCCthrRgkm0" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$1\",\"value\":\"$2\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}"
  echo ""
}

add_env SUPABASE_URL "$SUPABASE_URL"
add_env SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
add_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
add_env ADMIN_EMAIL "shreyaahdesignz2026@gmail.com"
add_env RAZORPAY_KEY_ID "$RAZORPAY_KEY_ID"
add_env RAZORPAY_KEY_SECRET "$RAZORPAY_KEY_SECRET"
add_env VERCEL_TOKEN "$VERCEL_TOKEN"
add_env VERCEL_ORG_ID "team_YqlvSMFfX0jzDSCCthrRgkm0"
add_env VERCEL_PROJECT_ID "prj_DrhK5kyBPbI6yE2nKtYmIlxONSgY"
```

- [ ] **Step 2: Verify all nine are present**

```bash
curl -s "https://api.vercel.com/v10/projects/prj_DrhK5kyBPbI6yE2nKtYmIlxONSgY/env?teamId=team_YqlvSMFfX0jzDSCCthrRgkm0" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
const j=JSON.parse(d);
console.log(j.envs.map(e=>e.key).sort());
});
"
```

Expected: an array containing all nine keys from Step 1.

- [ ] **Step 3: No commit needed** (this task changes Vercel project config only, not files in the repo)

---

## Task 7: Admin login page and session guard

**Files:**
- Create: `admin/index.html`
- Create: `assets/js/admin-common.js`
- Create: `assets/css/admin.css`

**Interfaces:**
- Produces: `window.SBTAdmin.client` (a Supabase JS client using the anon key), `window.SBTAdmin.requireSession(callback)` (redirects to `/admin/` if there's no logged-in session, otherwise calls `callback(session)`), `window.SBTAdmin.logout()`. Tasks 8 and 12's admin pages both load `assets/js/admin-common.js` and call `requireSession` on page load.

- [ ] **Step 1: Create `assets/css/admin.css`**

```css
/* Admin panel — plain and functional, not a re-theme of the storefront. */
.admin-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #F5F3EF;
  color: #2B3A44;
  margin: 0;
  min-height: 100vh;
}
.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: #2B3A44;
  color: #fff;
}
.admin-header nav a {
  color: #E8DFCF;
  text-decoration: none;
  margin-right: 1.25rem;
  font-size: 0.9rem;
}
.admin-header nav a.is-active { color: #fff; font-weight: 600; }
.admin-main { max-width: 1000px; margin: 0 auto; padding: 1.5rem; }
.admin-card {
  background: #fff;
  border: 1px solid #DDD5C7;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.admin-table th, .admin-table td {
  text-align: left;
  padding: 0.6rem 0.5rem;
  border-bottom: 1px solid #EEE8DC;
  vertical-align: top;
}
.admin-form-row { display: grid; gap: 0.4rem; margin-bottom: 0.9rem; }
.admin-form-row label { font-size: 0.82rem; font-weight: 600; }
.admin-form-row input, .admin-form-row select, .admin-form-row textarea {
  padding: 0.55rem 0.7rem;
  border: 1px solid #C9C0AF;
  border-radius: 6px;
  font-size: 0.92rem;
  font-family: inherit;
}
.admin-btn {
  display: inline-block;
  padding: 0.55rem 1.1rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: #2B3A44;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}
.admin-btn--ghost { background: transparent; border-color: #2B3A44; color: #2B3A44; }
.admin-btn--danger { background: #A33; }
.admin-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
.admin-error { color: #A33; font-size: 0.85rem; margin-top: 0.4rem; }
.admin-note { color: #6B6455; font-size: 0.82rem; }
.admin-status-badge {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.admin-status-badge--placed { background: #E4EFE0; color: #2E6B2E; }
.admin-status-badge--cancelled { background: #F3DEDE; color: #A33; }
.admin-status-badge--delivered { background: #DDE7F3; color: #2B4E8C; }
.admin-status-badge--test { background: #F3EEDA; color: #8F6213; }
```

- [ ] **Step 2: Create `assets/js/admin-common.js`**

```js
(function () {
  'use strict';

  var SUPABASE_URL = 'https://lektufytmhaumsltyfxf.supabase.co';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3R1Znl0bWhhdW1zbHR5ZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDU4ODcsImV4cCI6MjEwNDE4MTg4N30.NjFKO-hgk5PrdM-di5lOGbFYVXLWJtKpl24ye3GKAmk';

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.SBTAdmin = {
    client: client,
    requireSession: function (callback) {
      client.auth.getSession().then(function (res) {
        var session = res.data && res.data.session;
        if (!session) {
          window.location.href = '/admin/';
          return;
        }
        callback(session);
      });
    },
    logout: function () {
      client.auth.signOut().then(function () {
        window.location.href = '/admin/';
      });
    },
  };
})();
```

- [ ] **Step 3: Create `admin/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Login — Shreyaah's Bliss Trails</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="../assets/img/logo-mark.png">
<link rel="stylesheet" href="../assets/css/admin.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
</head>
<body class="admin-body">
  <div class="admin-main" style="max-width:380px;margin-top:4rem">
    <div class="admin-card">
      <h1 style="font-size:1.2rem;margin-top:0">Admin Login</h1>
      <form id="login-form">
        <div class="admin-form-row">
          <label for="email">Email</label>
          <input id="email" type="email" required autocomplete="username">
        </div>
        <div class="admin-form-row">
          <label for="password">Password</label>
          <input id="password" type="password" required autocomplete="current-password">
        </div>
        <button class="admin-btn" type="submit" style="width:100%">Log in</button>
        <p class="admin-error" id="login-error" hidden></p>
      </form>
    </div>
  </div>

  <script src="../assets/js/admin-common.js"></script>
  <script>
    (function () {
      var form = document.getElementById('login-form');
      var errorEl = document.getElementById('login-error');

      // If already logged in, skip straight to the products page.
      window.SBTAdmin.client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) window.location.href = '/admin/products/';
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        errorEl.hidden = true;
        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;
        window.SBTAdmin.client.auth
          .signInWithPassword({ email: email, password: password })
          .then(function (res) {
            if (res.error) {
              errorEl.textContent = res.error.message;
              errorEl.hidden = false;
              return;
            }
            window.location.href = '/admin/products/';
          });
      });
    })();
  </script>
</body>
</html>
```

- [ ] **Step 4: Manual verification**

This can't be verified with an automated test (it's a login UI). Verify once the site is deployed (after Task 10 makes `admin/` part of the publish set, or via a manual preview deploy): visiting `/admin/` shows the login form, submitting the admin email/password from the Global Constraints redirects to `/admin/products/` (which won't exist until Task 8 — a 404 there is expected and fine for now, it confirms the login itself succeeded).

- [ ] **Step 5: Commit**

```bash
git add admin/index.html assets/js/admin-common.js assets/css/admin.css
git commit -m "Add admin login page and Supabase Auth session guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 8: Admin product CRUD UI

**Files:**
- Create: `admin/products/index.html`
- Create: `assets/js/admin-products.js`

**Interfaces:**
- Consumes: `window.SBTAdmin.client`, `window.SBTAdmin.requireSession`, `window.SBTAdmin.logout` from Task 7.
- Produces: a working product list/add/edit/delete UI reading and writing the `products` table directly via the Supabase client (RLS allows this for an authenticated session). Task 9 will extend this file to add image upload; Task 10 will add a "Publish" button to it — both note the exact insertion points below.

- [ ] **Step 1: Create `admin/products/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Products — Admin</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="../../assets/img/logo-mark.png">
<link rel="stylesheet" href="../../assets/css/admin.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
</head>
<body class="admin-body">
  <header class="admin-header">
    <strong>Shreyaah's Bliss Trails — Admin</strong>
    <nav>
      <a href="../products/" class="is-active">Products</a>
      <a href="../orders/">Orders</a>
      <a href="#" id="logout-link">Log out</a>
    </nav>
  </header>

  <main class="admin-main">
    <!-- PUBLISH-BUTTON-SLOT: Task 10 adds a Publish button + status area here -->

    <div class="admin-card">
      <h2 id="form-heading" style="margin-top:0">Add a product</h2>
      <form id="product-form">
        <input type="hidden" id="product-id" value="">
        <div class="admin-form-row">
          <label for="name">Name</label>
          <input id="name" required>
        </div>
        <div class="admin-form-row">
          <label for="category">Category (matches a filter tab, e.g. "candles")</label>
          <input id="category" required>
        </div>
        <div class="admin-form-row">
          <label for="subcategory">Subcategory / tag label (e.g. "Soy Wax Candle · Ambrosial")</label>
          <input id="subcategory">
        </div>
        <div class="admin-form-row">
          <label for="description">Description</label>
          <textarea id="description" rows="2"></textarea>
        </div>
        <div class="admin-form-row">
          <label for="price">Price (₹)</label>
          <input id="price" type="number" step="0.01" min="0" required>
        </div>
        <div class="admin-form-row">
          <label for="original_price">Original price (₹, optional — set only for a sale item)</label>
          <input id="original_price" type="number" step="0.01" min="0">
        </div>
        <div class="admin-form-row">
          <label><input type="checkbox" id="is_provisional"> Price is provisional ("price to confirm")</label>
        </div>
        <!-- IMAGE-UPLOAD-SLOT: Task 9 adds a file input + upload button here -->
        <button class="admin-btn" type="submit">Save product</button>
        <button class="admin-btn admin-btn--ghost" type="button" id="cancel-edit" hidden>Cancel edit</button>
        <p class="admin-error" id="form-error" hidden></p>
      </form>
    </div>

    <div class="admin-card">
      <h2 style="margin-top:0">Catalog</h2>
      <table class="admin-table">
        <thead>
          <tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Image</th><th></th></tr>
        </thead>
        <tbody id="product-rows"></tbody>
      </table>
    </div>
  </main>

  <script src="../../assets/js/admin-common.js"></script>
  <script src="../../assets/js/admin-products.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `assets/js/admin-products.js`**

```js
(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;
    var form = document.getElementById('product-form');
    var idField = document.getElementById('product-id');
    var formError = document.getElementById('form-error');
    var formHeading = document.getElementById('form-heading');
    var cancelBtn = document.getElementById('cancel-edit');
    var rowsBody = document.getElementById('product-rows');

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function money(n) {
      return '₹' + Number(n).toFixed(2).replace(/\.00$/, '');
    }

    function resetForm() {
      form.reset();
      idField.value = '';
      formHeading.textContent = 'Add a product';
      cancelBtn.hidden = true;
      formError.hidden = true;
    }

    function fillForm(p) {
      idField.value = p.id;
      document.getElementById('name').value = p.name;
      document.getElementById('category').value = p.category;
      document.getElementById('subcategory').value = p.subcategory || '';
      document.getElementById('description').value = p.description || '';
      document.getElementById('price').value = p.price;
      document.getElementById('original_price').value = p.original_price || '';
      document.getElementById('is_provisional').checked = !!p.is_provisional;
      formHeading.textContent = 'Edit product';
      cancelBtn.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderRows(products) {
      rowsBody.innerHTML = products
        .map(function (p) {
          return (
            '<tr>' +
            '<td>' + p.name + '</td>' +
            '<td>' + p.category + '</td>' +
            '<td>' + money(p.price) + '</td>' +
            '<td>' + p.status + '</td>' +
            '<td>' + (p.image_path ? 'Yes' : 'No') + '</td>' +
            '<td>' +
            '<button class="admin-btn admin-btn--ghost" data-edit="' + p.id + '">Edit</button> ' +
            '<button class="admin-btn admin-btn--ghost" data-toggle="' + p.id + '" data-current="' + p.status + '">' +
            (p.status === 'active' ? 'Archive' : 'Reactivate') +
            '</button> ' +
            '<button class="admin-btn admin-btn--danger" data-delete="' + p.id + '">Delete</button>' +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-edit]'), function (btn) {
        btn.addEventListener('click', function () {
          var p = products.find(function (x) { return x.id === btn.getAttribute('data-edit'); });
          if (p) fillForm(p);
        });
      });
      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-toggle]'), function (btn) {
        btn.addEventListener('click', function () {
          var newStatus = btn.getAttribute('data-current') === 'active' ? 'archived' : 'active';
          client
            .from('products')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', btn.getAttribute('data-toggle'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              loadProducts();
            });
        });
      });
      Array.prototype.forEach.call(rowsBody.querySelectorAll('[data-delete]'), function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('Delete this product permanently? Past orders keep their own snapshot, so this is safe, but it cannot be undone.')) return;
          client
            .from('products')
            .delete()
            .eq('id', btn.getAttribute('data-delete'))
            .then(function (res) {
              if (res.error) { alert(res.error.message); return; }
              loadProducts();
            });
        });
      });
    }

    function loadProducts() {
      client
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          renderRows(res.data);
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError.hidden = true;

      var payload = {
        name: document.getElementById('name').value.trim(),
        category: document.getElementById('category').value.trim(),
        subcategory: document.getElementById('subcategory').value.trim() || null,
        description: document.getElementById('description').value.trim() || null,
        price: parseFloat(document.getElementById('price').value),
        original_price: document.getElementById('original_price').value
          ? parseFloat(document.getElementById('original_price').value)
          : null,
        is_provisional: document.getElementById('is_provisional').checked,
        updated_at: new Date().toISOString(),
      };

      var id = idField.value;
      var query = id
        ? client.from('products').update(payload).eq('id', id)
        : client.from('products').insert(payload);

      query.then(function (res) {
        if (res.error) {
          formError.textContent = res.error.message;
          formError.hidden = false;
          return;
        }
        resetForm();
        loadProducts();
      });
    });

    cancelBtn.addEventListener('click', resetForm);

    loadProducts();

    // Tasks 9 and 10 append more code inside this same requireSession
    // callback below, so they can call loadProducts()/client directly via
    // closure — no global export needed.
  });
})();
```

- [ ] **Step 3: Manual verification**

After this task's files are part of a deployed preview (or once Task 10's publish flow includes `admin/`), log in at `/admin/` and confirm: adding a product with a name/category/price shows it in the Catalog table; clicking Edit repopulates the form and Save updates the row in place; Archive/Reactivate toggles the status column; Delete removes the row after confirmation.

- [ ] **Step 4: Commit**

```bash
git add admin/products/index.html assets/js/admin-products.js
git commit -m "Add admin product CRUD (create/edit/archive/delete)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 9: Image upload pipeline (WebP/AVIF via sharp)

**Files:**
- Create: `scripts/create-storage-bucket.js`
- Create: `api/admin/upload-image.js`
- Modify: `vercel.json` (add function config for `upload-image.js`)
- Modify: `admin/products/index.html` (fill the `IMAGE-UPLOAD-SLOT`)
- Modify: `assets/js/admin-products.js` (wire the upload button)
- Delete: `api/admin/.gitkeep`

**Interfaces:**
- Consumes: `requireAdmin` (Task 3), `getSupabaseAdmin` (Task 4).
- Produces: `POST /api/admin/upload-image?productId=<uuid>` — request body is the raw image bytes (`Content-Type` set to the image's real MIME type), `Authorization: Bearer <supabase access token>` header required. On success, returns `{ ok: true, image_path: "<productId>" }` and the `products.image_path` column is set to `<productId>`. Storage layout later tasks depend on: bucket `product-images`, objects at `<productId>/image.avif`, `<productId>/image.webp`, `<productId>/image.jpg`, all public-read.

- [ ] **Step 1: Create the storage bucket (one-off)**

Create `scripts/create-storage-bucket.js`:

```js
const { getSupabaseAdmin } = require('../api/_lib/supabaseAdmin');

async function main() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket('product-images', {
    public: true,
    fileSizeLimit: '5MB',
  });
  if (error && !/already exists/i.test(error.message)) {
    console.error('Failed to create bucket:', error.message);
    process.exit(1);
  }
  console.log('Bucket product-images ready.');
}

main();
```

Run it:

```bash
node scripts/create-storage-bucket.js
```

Expected: `Bucket product-images ready.`

- [ ] **Step 2: Write `api/admin/upload-image.js`**

```js
const sharp = require('sharp');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

const MAX_WIDTH = 1200;
const BUCKET = 'product-images';
const CACHE_MAX_AGE_SECONDS = String(60 * 60 * 24 * 365); // 1 year — filenames are stable per product, so it's safe to cache this long

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const productId = req.query.productId;
  if (!productId) {
    return res.status(400).json({ error: 'Missing productId query param' });
  }

  try {
    await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  let original;
  try {
    original = await readRawBody(req);
    if (!original.length) throw new Error('Empty request body');
  } catch (e) {
    return res.status(400).json({ error: `Could not read uploaded image: ${e.message}` });
  }

  let avifBuffer, webpBuffer, jpgBuffer;
  try {
    const pipeline = sharp(original).resize({ width: MAX_WIDTH, withoutEnlargement: true });
    [avifBuffer, webpBuffer, jpgBuffer] = await Promise.all([
      pipeline.clone().avif({ quality: 60 }).toBuffer(),
      pipeline.clone().webp({ quality: 80 }).toBuffer(),
      pipeline.clone().jpeg({ quality: 82 }).toBuffer(),
    ]);
  } catch (e) {
    return res.status(400).json({ error: `Could not process image: ${e.message}` });
  }

  const supabase = getSupabaseAdmin();
  const uploads = [
    { path: `${productId}/image.avif`, buffer: avifBuffer, contentType: 'image/avif' },
    { path: `${productId}/image.webp`, buffer: webpBuffer, contentType: 'image/webp' },
    { path: `${productId}/image.jpg`, buffer: jpgBuffer, contentType: 'image/jpeg' },
  ];

  for (const u of uploads) {
    const { error } = await supabase.storage.from(BUCKET).upload(u.path, u.buffer, {
      contentType: u.contentType,
      cacheControl: CACHE_MAX_AGE_SECONDS,
      upsert: true,
    });
    if (error) {
      return res.status(500).json({ error: `Storage upload failed for ${u.path}: ${error.message}` });
    }
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ image_path: productId, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (updateError) {
    return res.status(500).json({ error: `Product update failed: ${updateError.message}` });
  }

  return res.status(200).json({ ok: true, image_path: productId });
};
```

- [ ] **Step 3: Update `vercel.json`**

```json
{
  "functions": {
    "api/admin/upload-image.js": { "memory": 1024, "maxDuration": 30 }
  }
}
```

- [ ] **Step 4: Fill the `IMAGE-UPLOAD-SLOT` in `admin/products/index.html`**

Replace the line:
```html
        <!-- IMAGE-UPLOAD-SLOT: Task 9 adds a file input + upload button here -->
```
with:
```html
        <div class="admin-form-row">
          <label for="image-file">Product image (used only when editing an existing product — save it first)</label>
          <input id="image-file" type="file" accept="image/*">
          <button class="admin-btn admin-btn--ghost" type="button" id="upload-image-btn" disabled>Upload image</button>
          <p class="admin-note" id="upload-status"></p>
        </div>
```

- [ ] **Step 5: Wire the upload button in `assets/js/admin-products.js`**

In `fillForm(p)`, after `cancelBtn.hidden = false;`, add:
```js
      document.getElementById('upload-image-btn').disabled = false;
```

In `resetForm()`, after `formError.hidden = true;`, add:
```js
      document.getElementById('upload-image-btn').disabled = true;
      document.getElementById('upload-status').textContent = '';
```

Before the final `loadProducts();` call at the bottom of the file, add:
```js
    document.getElementById('upload-image-btn').addEventListener('click', function () {
      var id = idField.value;
      var fileInput = document.getElementById('image-file');
      var status = document.getElementById('upload-status');
      if (!id) { status.textContent = 'Save the product first, then upload its image.'; return; }
      if (!fileInput.files[0]) { status.textContent = 'Choose an image file first.'; return; }

      var file = fileInput.files[0];
      status.textContent = 'Uploading…';

      client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;
        fetch('/api/admin/upload-image?productId=' + encodeURIComponent(id), {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            Authorization: 'Bearer ' + token,
          },
          body: file,
        })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (json.error) { status.textContent = 'Error: ' + json.error; return; }
            status.textContent = 'Image uploaded.';
            loadProducts();
          })
          .catch(function (err) { status.textContent = 'Error: ' + err.message; });
      });
    });
```

- [ ] **Step 6: Manual verification**

Deploy a preview (see Task 10 for the deploy mechanism, or use the manual `vercel --yes` preview flow already validated this session), log into `/admin/products/`, create a test product, upload a small JPEG/PNG via the new file input, and confirm: `upload-status` shows "Image uploaded.", the Catalog table's Image column flips to "Yes", and `https://<supabase-url>/storage/v1/object/public/product-images/<productId>/image.webp` loads a resized image in a browser.

- [ ] **Step 7: Delete the placeholder and commit**

```bash
rm api/admin/.gitkeep
git add scripts/create-storage-bucket.js api/admin/upload-image.js vercel.json admin/products/index.html assets/js/admin-products.js
git commit -m "Add product image upload with WebP/AVIF/JPEG derivatives

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 10: Catalog template generator + Publish route

**Files:**
- Create: `api/_lib/templateProducts.js`
- Create: `test/templateProducts.test.js`
- Create: `api/_lib/vercelDeploy.js`
- Create: `api/admin/publish.js`
- Create: `scripts/seed-products-from-html.js`
- Modify: `products/index.html` (add catalogue markers; this is a one-time hand-edit, then the seed script's output supersedes the hardcoded cards)
- Modify: `vercel.json` (add function config + `includeFiles` for `publish.js`)
- Modify: `admin/products/index.html` and `assets/js/admin-products.js` (fill `PUBLISH-BUTTON-SLOT`)

**Interfaces:**
- Produces: `renderCatalogueHtml(products, supabaseUrl)` from `templateProducts.js` — pure function, returns the full `<div class="grid grid-auto mt-3" id="catalogue">...</div>` HTML string for a list of active product rows.
- Produces: `deployDirectory({ rootDir, token, teamId, projectId, projectName })` from `vercelDeploy.js` — async function that uploads every file under `rootDir` to Vercel and creates a new production deployment, polling until it's ready. Returns `{ url, id }` or throws.
- Produces: `POST /api/admin/publish` (admin-auth gated, no body needed) — regenerates `products/index.html`'s catalogue section from the DB and deploys it to production. Returns `{ ok: true, deployment: { url, id } }`.

- [ ] **Step 1: Write the failing tests for the template generator**

Create `test/templateProducts.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderCatalogueHtml, productCard } = require('../api/_lib/templateProducts');

const SUPABASE_URL = 'https://example.supabase.co';

test('renders a plain-price product with no image', () => {
  const html = productCard(
    { id: '1', name: 'Plain Thing', category: 'misc', subcategory: '', price: 100, status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /data-cat="misc"/);
  assert.match(html, /data-product-id="1"/);
  assert.match(html, /<h3 class="product-name">Plain Thing<\/h3>/);
  assert.match(html, /<span class="price">₹100<\/span>/);
  assert.doesNotMatch(html, /<picture>/);
});

test('renders a sale price with strikethrough original', () => {
  const html = productCard(
    { id: '2', name: 'Sale Thing', category: 'candles', price: 175, original_price: 199, status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /<s>₹199<\/s>₹175<em>Sale<\/em>/);
});

test('renders a provisional price note', () => {
  const html = productCard(
    { id: '3', name: 'TBD Thing', category: 'candles', price: 555, is_provisional: true, status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /₹555<em style="color:var\(--brown\)">price to confirm<\/em>/);
  assert.match(html, /data-provisional="1"/);
});

test('renders a picture element when image_path is set', () => {
  const html = productCard(
    { id: '4', name: 'Photographed Thing', category: 'candles', price: 100, image_path: '4', status: 'active' },
    SUPABASE_URL
  );
  assert.match(html, /<picture>/);
  assert.match(html, new RegExp(`${SUPABASE_URL}/storage/v1/object/public/product-images/4/image\\.avif`));
});

test('escapes HTML in product name', () => {
  const html = productCard(
    { id: '5', name: '<script>alert(1)</script>', category: 'misc', price: 1, status: 'active' },
    SUPABASE_URL
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('renderCatalogueHtml wraps all cards in the catalogue grid', () => {
  const html = renderCatalogueHtml(
    [
      { id: '1', name: 'A', category: 'misc', price: 1, status: 'active' },
      { id: '2', name: 'B', category: 'misc', price: 2, status: 'active' },
    ],
    SUPABASE_URL
  );
  assert.match(html, /id="catalogue"/);
  assert.match(html, /data-product-id="1"/);
  assert.match(html, /data-product-id="2"/);
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `node --test test/templateProducts.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `api/_lib/templateProducts.js`**

```js
function money(n) {
  const num = Number(n);
  return (
    '₹' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: num % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function mediaMarkup(product, supabaseUrl) {
  if (!product.image_path) return '';
  const base = `${supabaseUrl}/storage/v1/object/public/product-images/${product.image_path}`;
  return (
    '<picture>' +
    `<source srcset="${base}/image.avif" type="image/avif">` +
    `<source srcset="${base}/image.webp" type="image/webp">` +
    `<img src="${base}/image.jpg" alt="${escapeHtml(product.name)}" loading="lazy" width="400" height="400">` +
    '</picture>'
  );
}

function priceMarkup(product) {
  if (product.is_provisional) {
    return `<span class="price">${money(product.price)}<em style="color:var(--brown)">price to confirm</em></span>`;
  }
  if (product.original_price != null && Number(product.original_price) > Number(product.price)) {
    return `<span class="price"><s>${money(product.original_price)}</s>${money(product.price)}<em>Sale</em></span>`;
  }
  return `<span class="price">${money(product.price)}</span>`;
}

function productCard(product, supabaseUrl) {
  const name = escapeHtml(product.name);
  const label = escapeHtml(product.subcategory || '');
  const provisionalAttr = product.is_provisional ? ' data-provisional="1"' : '';

  return (
    `<article class="product" data-cat="${escapeHtml(product.category)}">` +
    '<div class="product-media">' +
    mediaMarkup(product, supabaseUrl) +
    (product.subcategory ? `<span class="product-tag">${label}</span>` : '') +
    `<button class="wish" type="button" data-wish="${name}" data-price="${product.price}" data-label="${label}" data-product-id="${product.id}"${provisionalAttr} aria-label="Save ${name} to wishlist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>` +
    '</div>' +
    '<div class="product-body">' +
    (product.subcategory ? `<p class="product-cat">${label}</p>` : '') +
    `<h3 class="product-name">${name}</h3>` +
    (product.description ? `<p class="product-desc">${escapeHtml(product.description)}</p>` : '') +
    '<div class="product-foot">' +
    priceMarkup(product) +
    `<button class="btn btn--ghost btn--sm" type="button" data-add-cart="${name}" data-price="${product.price}" data-label="${label}" data-product-id="${product.id}"${provisionalAttr}>Add</button>` +
    '</div>' +
    '</div>' +
    '</article>'
  );
}

function renderCatalogueHtml(products, supabaseUrl) {
  return (
    '<div class="grid grid-auto mt-3" id="catalogue">\n' +
    products.map((p) => productCard(p, supabaseUrl)).join('\n') +
    '\n</div>'
  );
}

module.exports = { renderCatalogueHtml, productCard, money, escapeHtml };
```

- [ ] **Step 4: Run the tests again**

Run: `node --test test/templateProducts.test.js`
Expected: 6 tests pass

- [ ] **Step 5: Add catalogue markers to the existing `products/index.html`**

Open `products/index.html` and find the line:
```html
      <div class="grid grid-auto mt-3" id="catalogue">
```
and its matching closing `</div>` (the one that closes this specific grid, immediately before the next `</section>` — in the current file this is the div that wraps all 84 `<article class="product">` cards). Wrap that whole block in markers:

```html
      <!-- CATALOGUE:START -->
      <div class="grid grid-auto mt-3" id="catalogue">
        ... (all 84 existing <article class="product">...</article> cards, unchanged for now) ...
      </div>
      <!-- CATALOGUE:END -->
```

Do not remove the 84 existing cards yet — Step 6 seeds them into the database, and the *next* Publish will regenerate this section from the DB anyway, so leaving them in place until then is harmless.

- [ ] **Step 6: Write the one-off seed script**

Create `scripts/seed-products-from-html.js`:

```js
const fs = require('fs');
const path = require('path');
const { getSupabaseAdmin } = require('../api/_lib/supabaseAdmin');

function parseProducts(html) {
  const articles = html.match(/<article class="product"[\s\S]*?<\/article>/g) || [];
  const products = [];
  const failures = [];

  for (const block of articles) {
    const category = (block.match(/data-cat="([^"]+)"/) || [])[1];
    const name = (block.match(/<h3 class="product-name">([^<]+)<\/h3>/) || [])[1];
    const subcategory = (block.match(/<p class="product-cat">([^<]+)<\/p>/) || [])[1];
    const description = (block.match(/<p class="product-desc">([^<]*)<\/p>/) || [])[1];
    const isProvisional = /data-provisional="1"/.test(block);

    const saleMatch = block.match(/<span class="price"><s>₹([\d.,]+)<\/s>₹([\d.,]+)<em>Sale<\/em><\/span>/);
    const plainMatch = block.match(/<span class="price">₹([\d.,]+)(?:<em[^>]*>[^<]*<\/em>)?<\/span>/);

    let price, originalPrice;
    if (saleMatch) {
      originalPrice = parseFloat(saleMatch[1].replace(/,/g, ''));
      price = parseFloat(saleMatch[2].replace(/,/g, ''));
    } else if (plainMatch) {
      price = parseFloat(plainMatch[1].replace(/,/g, ''));
      originalPrice = null;
    }

    if (!category || !name || price == null || Number.isNaN(price)) {
      failures.push({ name: name || '(unknown)', category: category || '(unknown)' });
      continue;
    }

    products.push({
      name,
      category,
      subcategory: subcategory || null,
      description: description || null,
      price,
      original_price: originalPrice || null,
      is_provisional: isProvisional,
      status: 'active',
    });
  }

  return { products, failures };
}

async function main() {
  const htmlPath = path.join(__dirname, '..', 'products', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { products, failures } = parseProducts(html);

  console.log(`Parsed ${products.length} products, ${failures.length} failures.`);
  if (failures.length) {
    console.log('Failed to parse (add these manually via the admin panel):');
    failures.forEach((f) => console.log(`  - ${f.name} (${f.category})`));
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('products').insert(products);
  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log(`Inserted ${products.length} products.`);
}

main();
```

- [ ] **Step 7: Run the seed script once**

```bash
node scripts/seed-products-from-html.js
```

Expected: `Parsed 84 products, 0 failures.` followed by `Inserted 84 products.` — if there are failures, note them and add those specific products by hand afterward via `/admin/products/` (this is expected to be rare given the regex targets the exact markup patterns seen in the file, but is not guaranteed to be zero across all 84 hand-written cards).

- [ ] **Step 8: Verify the row count**

```bash
node -e "
const { getSupabaseAdmin } = require('./api/_lib/supabaseAdmin');
getSupabaseAdmin().from('products').select('id', { count: 'exact', head: true })
  .then(r => console.log('count:', r.count));
"
```

Expected: `count: 84` (or `84 - failures.length` plus however many you added by hand)

- [ ] **Step 9: Write `api/_lib/vercelDeploy.js`**

```js
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');

const VERCEL_API = 'https://api.vercel.com';

function walkFiles(rootDir, relDir = '') {
  const entries = fs.readdirSync(path.join(rootDir, relDir), { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) {
      files = files.concat(walkFiles(rootDir, relPath));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

async function uploadFile(absPath, token) {
  const content = fs.readFileSync(absPath);
  const sha = crypto.createHash('sha1').update(content).digest('hex');
  const res = await fetch(`${VERCEL_API}/v2/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha,
    },
    body: content,
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(`File upload failed for ${absPath}: ${res.status} ${body}`);
  }
  return { sha, size: content.length };
}

async function deployDirectory({ rootDir, token, teamId, projectId, projectName }) {
  const relFiles = walkFiles(rootDir);
  const files = [];
  for (const rel of relFiles) {
    const { sha, size } = await uploadFile(path.join(rootDir, rel), token);
    files.push({ file: rel, sha, size });
  }

  const createRes = await fetch(`${VERCEL_API}/v13/deployments?teamId=${teamId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      target: 'production',
      files,
    }),
  });
  const deployment = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Deployment create failed: ${JSON.stringify(deployment)}`);
  }

  const deploymentId = deployment.id;
  const deadline = Date.now() + 55000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}?teamId=${teamId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusJson = await statusRes.json();
    if (statusJson.readyState === 'READY') {
      return { url: `https://${statusJson.url}`, id: deploymentId };
    }
    if (['ERROR', 'CANCELED', 'BLOCKED'].includes(statusJson.readyState)) {
      throw new Error(`Deployment ended in ${statusJson.readyState}: ${statusJson.errorMessage || ''}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Deployment did not become ready within 55s');
}

module.exports = { deployDirectory, walkFiles, uploadFile };
```

- [ ] **Step 10: Write `api/admin/publish.js`**

```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { renderCatalogueHtml } = require('../_lib/templateProducts');
const { deployDirectory } = require('../_lib/vercelDeploy');

const INCLUDED_TOP_LEVEL = [
  'index.html',
  'about',
  'admin',
  'artisoul-tribe',
  'assets',
  'cart',
  'checkout',
  'contact',
  'events',
  'faq',
  'gift-card',
  'legal',
  'members',
  'notice-board',
  'products',
  'services',
  'special-offer',
  'wishlist',
];

function copyIncluded(srcRoot, destRoot) {
  fs.mkdirSync(destRoot, { recursive: true });
  for (const name of INCLUDED_TOP_LEVEL) {
    const src = path.join(srcRoot, name);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(destRoot, name), { recursive: true });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('category')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });

  const catalogueHtml = renderCatalogueHtml(products, process.env.SUPABASE_URL);

  const tmpDir = path.join(os.tmpdir(), `publish-${Date.now()}`);
  copyIncluded(process.cwd(), tmpDir);

  const productsPagePath = path.join(tmpDir, 'products', 'index.html');
  const original = fs.readFileSync(productsPagePath, 'utf8');
  const start = original.indexOf('<!-- CATALOGUE:START -->');
  const end = original.indexOf('<!-- CATALOGUE:END -->');
  if (start === -1 || end === -1) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return res.status(500).json({ error: 'Catalogue markers not found in products/index.html' });
  }
  const updated =
    original.slice(0, start) +
    '<!-- CATALOGUE:START -->\n' +
    catalogueHtml +
    '\n' +
    original.slice(end);
  fs.writeFileSync(productsPagePath, updated, 'utf8');

  fs.mkdirSync(path.join(tmpDir, '.vercel'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.vercel', 'project.json'),
    JSON.stringify({
      projectId: process.env.VERCEL_PROJECT_ID,
      orgId: process.env.VERCEL_ORG_ID,
      projectName: 'shreyaahs-bliss-trails',
    })
  );

  try {
    const result = await deployDirectory({
      rootDir: tmpDir,
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_ORG_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      projectName: 'shreyaahs-bliss-trails',
    });
    return res.status(200).json({ ok: true, deployment: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
```

- [ ] **Step 11: Update `vercel.json`**

```json
{
  "functions": {
    "api/admin/upload-image.js": { "memory": 1024, "maxDuration": 30 },
    "api/admin/publish.js": {
      "maxDuration": 60,
      "includeFiles": "{index.html,about/**,admin/**,artisoul-tribe/**,assets/**,cart/**,checkout/**,contact/**,events/**,faq/**,gift-card/**,legal/**,members/**,notice-board/**,products/**,services/**,special-offer/**,wishlist/**}"
    }
  }
}
```

- [ ] **Step 12: Fill the `PUBLISH-BUTTON-SLOT` in `admin/products/index.html`**

Replace:
```html
    <!-- PUBLISH-BUTTON-SLOT: Task 10 adds a Publish button + status area here -->
```
with:
```html
    <div class="admin-card">
      <button class="admin-btn" id="publish-btn">Publish to live site</button>
      <p class="admin-note" id="publish-status"></p>
    </div>
```

- [ ] **Step 13: Wire the Publish button in `assets/js/admin-products.js`**

Add before the final `loadProducts();` call:

```js
    document.getElementById('publish-btn').addEventListener('click', function () {
      var btn = document.getElementById('publish-btn');
      var status = document.getElementById('publish-status');
      btn.disabled = true;
      status.textContent = 'Publishing… this can take up to a minute.';

      client.auth.getSession().then(function (sessionRes) {
        var token = sessionRes.data.session.access_token;
        fetch('/api/admin/publish', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            btn.disabled = false;
            if (json.error) { status.textContent = 'Error: ' + json.error; return; }
            status.textContent = 'Published: ' + json.deployment.url;
          })
          .catch(function (err) {
            btn.disabled = false;
            status.textContent = 'Error: ' + err.message;
          });
      });
    });
```

- [ ] **Step 14: Manual end-to-end verification**

Deploy this state to production once manually (using the same `vercel --prod --token ... --yes` flow from a git-free copy, validated earlier this session — this is the *last* manual deploy needed; every deploy after this one goes through the Publish button instead). Then: log into `/admin/products/`, edit an existing product's price, click "Publish to live site", wait for the status message, and confirm the live `/products/` page shows the updated price.

- [ ] **Step 15: Commit**

```bash
git add api/_lib/templateProducts.js test/templateProducts.test.js api/_lib/vercelDeploy.js api/admin/publish.js scripts/seed-products-from-html.js products/index.html vercel.json admin/products/index.html assets/js/admin-products.js
git commit -m "Add catalog publish pipeline: DB -> static HTML -> Vercel deploy

Seeds the 84 existing hardcoded products into the database, adds
catalogue markers to products/index.html so future publishes can
find and replace just that section, and wires an admin Publish
button that regenerates the page and deploys it via the Vercel API
directly (no git metadata, matching the technique already used to
unblock this project's stuck deployment).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 11: Checkout page + Razorpay payment

**Files:**
- Modify: `assets/js/main.js` (extend cart schema with `product_id`, expose cart reader for `checkout.js`)
- Create: `checkout/index.html`
- Create: `assets/js/checkout.js`
- Create: `api/checkout/create-order.js`
- Create: `api/checkout/verify-payment.js`
- Modify: `cart/index.html` (replace the "Checkout not connected" panel with a real "Proceed to checkout" link)
- Delete: `api/checkout/.gitkeep`

**Interfaces:**
- Consumes: `computeTotals`/`SHIPPING_FEE` (Task 4), `getSupabaseAdmin` (Task 4), `verifyPaymentSignature` (Task 5).
- Produces: `POST /api/checkout/create-order` — body `{ items: [{product_id, qty}], customer: {name, phone, email, address_line, city, state, pincode} }`, returns `{ razorpay_order_id, amount, key_id }` (amount in paise) or `{ error }`.
- Produces: `POST /api/checkout/verify-payment` — body `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, items, customer }`, returns `{ ok: true, order_id }` or `{ error }`.

- [ ] **Step 1: Extend the cart schema in `assets/js/main.js`**

In `itemOf(btn, attr)` (around line 167), change:
```js
  function itemOf(btn, attr) {
    var price = btn.getAttribute('data-price');
    return {
      name: btn.getAttribute(attr),
      price: price ? parseFloat(price.replace(/,/g, '')) : null,
      label: btn.getAttribute('data-label') || '',
      provisional: btn.getAttribute('data-provisional') === '1',
      qty: 1
    };
  }
```
to:
```js
  function itemOf(btn, attr) {
    var price = btn.getAttribute('data-price');
    return {
      id: btn.getAttribute('data-product-id') || null,
      name: btn.getAttribute(attr),
      price: price ? parseFloat(price.replace(/,/g, '')) : null,
      label: btn.getAttribute('data-label') || '',
      provisional: btn.getAttribute('data-provisional') === '1',
      qty: 1
    };
  }
```

Change `indexOfName` (around line 177) to match by `id` first, falling back to `name` for any cart entry saved before this change:
```js
  function indexOfName(list, item) {
    var id = typeof item === 'string' ? null : item.id;
    var name = typeof item === 'string' ? item : item.name;
    for (var i = 0; i < list.length; i++) {
      if (id && list[i].id === id) return i;
      if (!list[i].id && list[i].name === name) return i;
    }
    return -1;
  }
```

Update the three call sites that currently call `indexOfName(cart, item.name)` / `indexOfName(readWish(), name)` / `indexOfName(cart, it.name)` to pass the full item instead of just the name:
- In the `data-add-cart` click handler: `var i = indexOfName(cart, item);` (was `indexOfName(cart, item.name)`)
- In the `.wish` click handler: `var i = indexOfName(l, itemOf(btn, 'data-wish'));` (was `indexOfName(l, name)` — this now computes the item once and reuses it for both the lookup and the push)
- In the wishlist "move to cart" handler: `var i = indexOfName(cart, it);` (was `indexOfName(cart, it.name)`)

At the very end of the file, just before the closing `})();`, add:
```js
  window.SBTCart = { readCart: readCart, KEY_CART: KEY_CART };
```

- [ ] **Step 2: Write `api/checkout/create-order.js`**

```js
const Razorpay = require('razorpay');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { computeTotals } = require('../_lib/pricing');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, status')
    .in('id', items.map((i) => i.product_id));
  if (error) return res.status(500).json({ error: error.message });

  let totals;
  try {
    totals = computeTotals(items, products);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const amountInPaise = Math.round(totals.grandTotal * 100);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      notes: { source: 'shreyaahs-bliss-trails-checkout' },
    });
    return res.status(200).json({
      razorpay_order_id: order.id,
      amount: amountInPaise,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return res.status(500).json({ error: `Razorpay order creation failed: ${e.message}` });
  }
};
```

- [ ] **Step 2: Write `api/checkout/verify-payment.js`**

```js
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { computeTotals } = require('../_lib/pricing');
const { verifyPaymentSignature } = require('../_lib/razorpaySignature');

function isTestKey() {
  return (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    items,
    customer,
  } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing Razorpay payment fields' });
  }
  if (!customer || !customer.name || !customer.phone || !customer.address_line ||
      !customer.city || !customer.state || !customer.pincode) {
    return res.status(400).json({ error: 'Missing customer details' });
  }

  const validSignature = verifyPaymentSignature(
    { razorpay_order_id, razorpay_payment_id, razorpay_signature },
    process.env.RAZORPAY_KEY_SECRET
  );
  if (!validSignature) {
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, status')
    .in('id', items.map((i) => i.product_id));
  if (productsError) return res.status(500).json({ error: productsError.message });

  let totals;
  try {
    totals = computeTotals(items, products);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      is_test_payment: isTestKey(),
      status: 'placed',
      subtotal: totals.subtotal,
      shipping_fee: totals.shippingFee,
      grand_total: totals.grandTotal,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email || null,
      address_line: customer.address_line,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    })
    .select()
    .single();
  if (orderError) return res.status(500).json({ error: orderError.message });

  const orderItems = totals.lineItems.map((li) => ({
    order_id: order.id,
    product_id: li.product_id,
    product_name: li.name,
    unit_price: li.unit_price,
    qty: li.qty,
    line_total: li.line_total,
  }));
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  return res.status(200).json({ ok: true, order_id: order.id });
};
```

- [ ] **Step 3: Create `checkout/index.html`**

Copy `cart/index.html` lines 1–95 verbatim (the `<head>` through the end of `<main id="main">`'s opening — i.e. everything up to and including the `<aside class="drawer">` block), changing only the `<title>` (to `Checkout — Shreyaah's Bliss Trails`) and the `<meta name="description">` (to `Complete your order.`). Then use this as the page body, and copy lines 167–263 of `cart/index.html` verbatim as the footer/closing tags. Between them:

```html
  <!-- PAGE HEAD -->
  <section class="page-head">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="../">Home</a><span>/</span><a href="../cart/">Cart</a><span>/</span><span>Checkout</span>
      </nav>
      <p class="eyebrow">Almost There</p>
      <h1>Checkout</h1>
    </div>
  </section>

  <section class="section" style="padding-top:clamp(1.5rem,3vw,2.5rem)">
    <div class="wrap">
      <div class="empty" data-checkout-empty hidden>
        <h3>Your cart is empty</h3>
        <p>Add something from the collection before checking out.</p>
        <a class="btn btn--primary btn--sm" href="../products/">Browse the collection</a>
      </div>

      <div class="split split--cart" data-checkout-content hidden>
        <div>
          <div id="checkout-lines"></div>

          <div class="admin-card" style="margin-top:1.5rem">
            <h3 style="margin-top:0">Delivery details</h3>
            <form id="checkout-form">
              <div class="field-row">
                <div class="field">
                  <label>Full name <span class="req">*</span></label>
                  <input id="cf-name" required>
                </div>
                <div class="field">
                  <label>Phone <span class="req">*</span></label>
                  <input id="cf-phone" type="tel" required>
                </div>
              </div>
              <div class="field">
                <label>Email (optional)</label>
                <input id="cf-email" type="email">
              </div>
              <div class="field">
                <label>Address <span class="req">*</span></label>
                <textarea id="cf-address" rows="2" required></textarea>
              </div>
              <div class="field-row">
                <div class="field">
                  <label>City <span class="req">*</span></label>
                  <input id="cf-city" required>
                </div>
                <div class="field">
                  <label>State <span class="req">*</span></label>
                  <input id="cf-state" required>
                </div>
              </div>
              <div class="field">
                <label>Pincode <span class="req">*</span></label>
                <input id="cf-pincode" required>
              </div>
              <button class="btn btn--primary btn--block" type="submit" id="pay-btn">Pay <span id="pay-amount"></span></button>
              <p class="admin-error" id="checkout-error" hidden></p>
            </form>
          </div>
        </div>

        <aside class="cart-summary">
          <h3 style="font-size:1.2rem;margin-bottom:.75rem">Order summary</h3>
          <div class="summary-row"><span class="k">Subtotal</span><span class="v" id="co-subtotal">₹0</span></div>
          <div class="summary-row"><span class="k">Delivery</span><span class="v" id="co-shipping">₹300</span></div>
          <div class="summary-row"><span class="k">Grand total</span><span class="v" id="co-total">₹0</span></div>
        </aside>
      </div>

      <div data-checkout-success hidden style="text-align:center;padding:3rem 0">
        <h3>Thank you — your order is placed!</h3>
        <p>Order reference: <strong id="co-order-id"></strong></p>
        <a class="btn btn--primary btn--sm" href="../">Back to home</a>
      </div>
    </div>
  </section>
```

Also add, before `<script src="../assets/js/main.js"></script>`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```
and after it:
```html
<script src="../assets/js/checkout.js"></script>
```
and add `<link rel="stylesheet" href="../assets/css/admin.css">` to the `<head>` (reused here only for the `.admin-card`/`.admin-error` form styling, so the checkout form doesn't need its own duplicate CSS).

- [ ] **Step 4: Create `assets/js/checkout.js`**

```js
(function () {
  'use strict';

  var SUPABASE_URL = 'https://lektufytmhaumsltyfxf.supabase.co';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3R1Znl0bWhhdW1zbHR5ZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDU4ODcsImV4cCI6MjEwNDE4MTg4N30.NjFKO-hgk5PrdM-di5lOGbFYVXLWJtKpl24ye3GKAmk';
  var SHIPPING_FEE = 300; // display only — the server (api/_lib/pricing.js) is authoritative

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function money(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  var cart = (window.SBTCart ? window.SBTCart.readCart() : []).filter(function (it) {
    return it.id;
  });

  var emptyEl = document.querySelector('[data-checkout-empty]');
  var contentEl = document.querySelector('[data-checkout-content]');
  var successEl = document.querySelector('[data-checkout-success]');

  if (!cart.length) {
    emptyEl.hidden = false;
    return;
  }
  contentEl.hidden = false;

  var latestTotals = null;

  function renderLines(products) {
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });

    var linesHtml = cart
      .map(function (it) {
        var p = byId[it.id];
        if (!p) return '';
        return (
          '<div class="line line--simple">' +
          '<div class="line-media" aria-hidden="true"></div>' +
          '<div class="line-body">' +
          '<h3 class="product-name">' + p.name + '</h3>' +
          '<p class="price">' + money(p.price) + ' × ' + it.qty + '</p>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    document.getElementById('checkout-lines').innerHTML = linesHtml;

    var subtotal = cart.reduce(function (sum, it) {
      var p = byId[it.id];
      return p ? sum + p.price * it.qty : sum;
    }, 0);
    var grandTotal = subtotal + SHIPPING_FEE;

    document.getElementById('co-subtotal').textContent = money(subtotal);
    document.getElementById('co-shipping').textContent = money(SHIPPING_FEE);
    document.getElementById('co-total').textContent = money(grandTotal);
    document.getElementById('pay-amount').textContent = money(grandTotal);

    latestTotals = { subtotal: subtotal, grandTotal: grandTotal };
  }

  client
    .from('products')
    .select('id, name, price, original_price, is_provisional')
    .in('id', cart.map(function (it) { return it.id; }))
    .then(function (res) {
      if (res.error) {
        document.getElementById('checkout-error').textContent = res.error.message;
        document.getElementById('checkout-error').hidden = false;
        return;
      }
      renderLines(res.data);
    });

  document.getElementById('checkout-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('checkout-error');
    errorEl.hidden = true;

    var customer = {
      name: document.getElementById('cf-name').value.trim(),
      phone: document.getElementById('cf-phone').value.trim(),
      email: document.getElementById('cf-email').value.trim() || null,
      address_line: document.getElementById('cf-address').value.trim(),
      city: document.getElementById('cf-city').value.trim(),
      state: document.getElementById('cf-state').value.trim(),
      pincode: document.getElementById('cf-pincode').value.trim(),
    };
    var items = cart.map(function (it) { return { product_id: it.id, qty: it.qty || 1 }; });

    var payBtn = document.getElementById('pay-btn');
    payBtn.disabled = true;

    fetch('/api/checkout/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items, customer: customer }),
    })
      .then(function (r) { return r.json(); })
      .then(function (order) {
        if (order.error) throw new Error(order.error);

        var rzp = new Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: 'INR',
          name: "Shreyaah's Bliss Trails",
          order_id: order.razorpay_order_id,
          prefill: { name: customer.name, email: customer.email || '', contact: customer.phone },
          handler: function (response) {
            fetch('/api/checkout/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                items: items,
                customer: customer,
              }),
            })
              .then(function (r) { return r.json(); })
              .then(function (result) {
                payBtn.disabled = false;
                if (result.error) {
                  errorEl.textContent = result.error;
                  errorEl.hidden = false;
                  return;
                }
                localStorage.removeItem(window.SBTCart.KEY_CART);
                contentEl.hidden = true;
                successEl.hidden = false;
                document.getElementById('co-order-id').textContent = result.order_id;
              })
              .catch(function (err) {
                payBtn.disabled = false;
                errorEl.textContent = err.message;
                errorEl.hidden = false;
              });
          },
          modal: {
            ondismiss: function () { payBtn.disabled = false; },
          },
        });
        rzp.open();
      })
      .catch(function (err) {
        payBtn.disabled = false;
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      });
  });
})();
```

- [ ] **Step 5: Replace the "Checkout not connected" panel in `cart/index.html`**

Replace lines 143–153 of `cart/index.html`:
```html
          <div class="draft" data-editable>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
            <div><strong>Checkout not connected</strong><br>
            No payment system is set up yet, so this cart can't be checked out from
            the site. Shipping charges and taxes are therefore not calculated here
            either. Send your list on WhatsApp or by email and we'll confirm
            availability, the final total and delivery from there.</div>
          </div>

          <a class="btn btn--primary btn--block" href="https://wa.me/919836783088">Send this list on WhatsApp</a>
          <a class="btn btn--ghost btn--block mt-1" href="mailto:connectwdls@gmail.com">Email us instead</a>
```
with:
```html
          <a class="btn btn--primary btn--block" href="../checkout/">Proceed to checkout</a>
```

- [ ] **Step 6: Manual verification (real Razorpay test-mode purchase)**

This is the acceptance test for the whole payment flow — see Task 13, which repeats and extends it. For this task alone: deploy (via the admin Publish button, now that Task 10 is done), add a product to the cart on the live site, go to `/checkout/`, fill the delivery form, click Pay, complete the Razorpay test-mode modal using a Razorpay test card (e.g. card number `4111 1111 1111 1111`, any future expiry, any CVV — standard Razorpay test card, works only because `RAZORPAY_KEY_ID` starts with `rzp_test_`), and confirm the success screen shows an order id.

- [ ] **Step 7: Delete the placeholder and commit**

```bash
rm api/checkout/.gitkeep
git add assets/js/main.js checkout api/checkout cart/index.html
git commit -m "Add checkout page with server-validated pricing and Razorpay payment

Extends the cart schema to carry product IDs (needed to price
against the database rather than trusting localStorage), adds the
checkout page and its two API routes, and points the cart's
checkout button at the new page instead of WhatsApp/email.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 12: Admin order management UI

**Files:**
- Create: `admin/orders/index.html`
- Create: `assets/js/admin-orders.js`

**Interfaces:**
- Consumes: `window.SBTAdmin` (Task 7). Reads `orders` and `order_items` tables directly via the Supabase client (RLS allows authenticated select/update).

- [ ] **Step 1: Create `admin/orders/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orders — Admin</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="../../assets/img/logo-mark.png">
<link rel="stylesheet" href="../../assets/css/admin.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
</head>
<body class="admin-body">
  <header class="admin-header">
    <strong>Shreyaah's Bliss Trails — Admin</strong>
    <nav>
      <a href="../products/">Products</a>
      <a href="../orders/" class="is-active">Orders</a>
      <a href="#" id="logout-link">Log out</a>
    </nav>
  </header>

  <main class="admin-main">
    <div class="admin-card">
      <h2 style="margin-top:0">Orders</h2>
      <div id="orders-list"></div>
    </div>
  </main>

  <script src="../../assets/js/admin-common.js"></script>
  <script src="../../assets/js/admin-orders.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `assets/js/admin-orders.js`**

```js
(function () {
  'use strict';

  window.SBTAdmin.requireSession(function () {
    var client = window.SBTAdmin.client;

    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      window.SBTAdmin.logout();
    });

    function money(n) {
      return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    function statusBadge(status) {
      return '<span class="admin-status-badge admin-status-badge--' + status + '">' + status + '</span>';
    }

    function renderOrder(order, items) {
      var itemsHtml = items
        .map(function (li) {
          return '<li>' + li.qty + ' × ' + li.product_name + ' — ' + money(li.line_total) + '</li>';
        })
        .join('');

      return (
        '<div class="admin-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:start">' +
        '<div>' +
        '<strong>' + order.customer_name + '</strong> · ' + order.customer_phone +
        (order.customer_email ? ' · ' + order.customer_email : '') +
        (order.is_test_payment ? ' ' + statusBadge('test') : '') +
        '<p class="admin-note">' + order.address_line + ', ' + order.city + ', ' + order.state + ' — ' + order.pincode + '</p>' +
        '<p class="admin-note">Placed ' + new Date(order.created_at).toLocaleString('en-IN') + ' · Razorpay order ' + order.razorpay_order_id + '</p>' +
        '</div>' +
        '<div style="text-align:right">' +
        statusBadge(order.status) +
        '<p style="font-weight:600;margin:.4rem 0">' + money(order.grand_total) + '</p>' +
        '</div>' +
        '</div>' +
        '<ul>' + itemsHtml + '</ul>' +
        '<p class="admin-note">Subtotal ' + money(order.subtotal) + ' + delivery ' + money(order.shipping_fee) + '</p>' +
        '<div class="admin-form-row" style="max-width:220px">' +
        '<label>Status</label>' +
        '<select data-status-for="' + order.id + '">' +
        ['placed', 'cancelled', 'delivered']
          .map(function (s) {
            return '<option value="' + s + '"' + (s === order.status ? ' selected' : '') + '>' + s + '</option>';
          })
          .join('') +
        '</select>' +
        '</div>' +
        '</div>'
      );
    }

    function loadOrders() {
      client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .then(function (ordersRes) {
          if (ordersRes.error) { alert(ordersRes.error.message); return; }
          var orders = ordersRes.data;
          if (!orders.length) {
            document.getElementById('orders-list').innerHTML = '<p class="admin-note">No orders yet.</p>';
            return;
          }
          client
            .from('order_items')
            .select('*')
            .in('order_id', orders.map(function (o) { return o.id; }))
            .then(function (itemsRes) {
              if (itemsRes.error) { alert(itemsRes.error.message); return; }
              var itemsByOrder = {};
              itemsRes.data.forEach(function (li) {
                (itemsByOrder[li.order_id] = itemsByOrder[li.order_id] || []).push(li);
              });

              document.getElementById('orders-list').innerHTML = orders
                .map(function (o) { return renderOrder(o, itemsByOrder[o.id] || []); })
                .join('');

              Array.prototype.forEach.call(
                document.querySelectorAll('[data-status-for]'),
                function (select) {
                  select.addEventListener('change', function () {
                    client
                      .from('orders')
                      .update({ status: select.value, updated_at: new Date().toISOString() })
                      .eq('id', select.getAttribute('data-status-for'))
                      .then(function (res) {
                        if (res.error) { alert(res.error.message); return; }
                        loadOrders();
                      });
                  });
                }
              );
            });
        });
    }

    loadOrders();
  });
})();
```

- [ ] **Step 3: Manual verification**

After deploying (via Publish), place a test-mode order through `/checkout/` (per Task 11 Step 6), then log into `/admin/orders/` and confirm: the order appears with correct customer name/phone/address, correct line items and totals, an `is_test_payment` badge, and that changing the status dropdown to "delivered" and reloading the page keeps it as "delivered".

- [ ] **Step 4: Commit**

```bash
git add admin/orders/index.html assets/js/admin-orders.js
git commit -m "Add admin order list with customer details and status editor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSjjfvGBDLshdDRPmm9Uux"
```

---

## Task 13: End-to-end acceptance pass

**Files:** none (verification only — fix forward in whichever task's files are at fault if something here fails, then re-run this task)

- [ ] **Step 1: Run the full local test suite**

```bash
node --test test/
```

Expected: every test from Tasks 3, 4, 5, and 10 passes (auth, pricing, signature, template — 20 tests total across the four files).

- [ ] **Step 2: Confirm RLS actually blocks anonymous writes**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
c.from('products').insert({ name: 'should fail', category: 'x', price: 1 })
  .then(r => console.log('insert error (expected):', r.error && r.error.message));
c.from('orders').select('*').then(r => console.log('select error (expected):', r.error && r.error.message));
"
```

Expected: both print a permission-denied-shaped error message — an anonymous client must not be able to write products or read orders.

- [ ] **Step 3: Full manual purchase walkthrough on the live site**

1. On `/products/`, add two different items to the cart.
2. Go to `/cart/`, confirm both lines show, click "Proceed to checkout".
3. On `/checkout/`, confirm the subtotal matches the two items' current prices and the total is exactly subtotal + ₹300.
4. Fill the delivery form and pay with the Razorpay test card `4111 1111 1111 1111` (any future expiry/CVV/OTP `1111` if prompted, per Razorpay's standard test flow).
5. Confirm the success screen appears with an order id, and that `/cart/` is now empty.
6. Log into `/admin/orders/`, confirm the new order appears with the right customer details, both line items, correct totals, `status: placed`, and the test-payment badge.
7. Change its status to `delivered`, reload the page, confirm it stuck.
8. Change it to `cancelled`, reload, confirm that stuck too.

- [ ] **Step 4: Full manual catalog-edit walkthrough**

1. In `/admin/products/`, edit an existing product's price and upload an image for it.
2. Click "Publish to live site", wait for the success message with a deployment URL.
3. Reload `/products/` on the live domain and confirm the new price shows and the product card now renders a `<picture>` with the uploaded image instead of the plain placeholder.
4. Confirm a product with **no** uploaded image still renders exactly as it did before (illustrated placeholder, no broken `<img>`).

- [ ] **Step 5: Confirm egress goal — no Supabase reads from ordinary browsing**

Open browser devtools Network tab, hard-reload `/`, `/products/`, `/about/` with no cart activity. Confirm zero requests to `*.supabase.co` on any of those three pages. (`/checkout/` and `/admin/*` are expected to call Supabase — that's by design, not a regression.)

- [ ] **Step 6: Final commit (if Steps 3–5 required any fixes)**

If everything passed with no code changes, there is nothing to commit — this task is verification-only. If a fix was needed, commit it in the task whose files it touched, then re-run the relevant step here.

---

## Post-plan note for whoever picks this up next

Two follow-ups the spec explicitly deferred (see spec §2 "Non-goals"), worth a future plan of their own once this one is live and working: order confirmation emails/SMS, and multiple images per product. Neither blocks anything in this plan.
