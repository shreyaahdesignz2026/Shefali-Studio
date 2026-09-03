# Shreyaah's Bliss Trails — website

Static multi-page site. No build step, no dependencies. Every page is a plain
`index.html` sharing one stylesheet and one script.

## Running it

Open `index.html` in a browser, or for a local server:

```bash
node serve.js
```

Then visit `http://localhost:4321`.

## Structure

```
index.html                  Home
about/index.html            Studio, founder, Blissful Trails, Clubhouse, vision, impact, partners
services/index.html         Personal Journeys · Collective Circles · Custom Collaborations · booking · cancellation policy
events/index.html           Current · Upcoming · Past · registration
products/index.html         84 listings, filterable by category
notice-board/index.html     Studio Diary blog · Bulletin · Reviews
artisoul-tribe/index.html   Membership concept, benefits, slabs, join
members/index.html          Account dashboard (built to the supplied wireframe)
special-offer/index.html    QR/scan landing page — not in the main navigation
gift-card/index.html        E-Bliss Card
faq/index.html              Grouped by Brand, Services, Booking, Events, Products, Membership, Corporate, Wellbeing, Policies
contact/index.html          Individual and Corporate enquiry routes
legal/index.html            All policies and disclaimers

assets/css/style.css        Design system — colours, type, components
assets/js/main.js           Nav, drawer, search, accordions, tabs, filters, cart/wishlist
assets/img/                 Logo, paper texture, 18 watercolour illustrations
```

## Illustration placement

Each illustration from the supplied pack is placed by subject:

| Illustration | Where |
|---|---|
| The Wandering Trail (tree) | Home hero |
| Three Pathways signpost | Home — pathways section |
| The Ecosystem | About — the studio |
| The Maker's Desk | About — Shreyaah Dhiti Ssaha |
| The Regenerative Cycle | About — vision & mission |
| The Blissful Trail | About + Services — Blissful Trails Process |
| Inner Journey | Home + Services — Personal Journeys |
| The Many Ways We Gather | About + Services — Collective Circles |
| Moon Circle | Events — Alaap |
| Lessons from the Animal Kingdom | available for the workshop of that name |
| Little Treasures Table | Products |
| From Hands to Home | Products — philosophy |
| The Gathering Table | Home + Events |
| The Artisoul Constellation | The Artisoul Tribe |
| The Studio Diary | Notice Board |
| The Shared Table | Members Space |
| Leave a Little Space for Connection | Contact |
| The Shreyaah Designz Map | Home — explore your way |

Illustrations sit behind text at low opacity via the `.scenery` class, and as
feature images via `.illus`. They never sit under body copy at full strength.

## What still needs real content

Everything below renders as a visible dashed **DRAFT / to-be-confirmed** panel on the
page, so nothing unverified reads as fact. Search the source for `class="draft"` to
find them all.

**Services**
- The Blissful Trails Process — what happens across the 6–9 sessions, session length,
  spacing, fee, inclusions. Deliberately not invented.
- Blissful Enrichment Journey, Blissful Realignment Journey, Autography Writing,
  Diet Consultation — names confirmed, all other detail pending.
- Diet Consultation — practitioner credentials must be verified before it is bookable.
- Collective Circles — dates, durations, participant limits and fees.
- Custom Collaborations — no formal package or price list exists; quoted per project.

**Events**
- Six upcoming events show *date TBD*; the ₹0.00 in the source means "no fee set",
  which the page states explicitly.
- Past events — none on record yet.
- Venue accessibility for Legend and Legacy Café is unconfirmed.

**Products**
- No product photography supplied — cards show an illustrated placeholder.
- Six lines (journals, journalling kit, message jar, massage candles, DIY kits,
  affirmative stationery) have no price on record. Per the brief these show **₹555**,
  flagged *price to confirm*.
- Materials, dimensions, packaging and care info per product still to be documented.

**The Artisoul Tribe / Members Space**
- Membership slab names, pricing, duration and joining criteria undecided —
  including whether it is free or paid.
- Coins & rewards: earning rate, conversion rate, expiry and redemption rules unset.
  The wireframe's sample figures were deliberately not published as if confirmed.
- Members Space is a preview; no accounts exist. Sample names are placeholders.

**Notice Board**
- Bulletin — no content yet; members-only, intended quarterly.
- Reviews — no genuine testimonials were available. Left as an editable placeholder;
  nothing was written on a customer's behalf.

**About**
- Founder biography compiled from the published Studio Diary — confirm name spelling.
- Partners in Service — verify names, current relationships and permission to use them.
- SDG / impact claims researched and evidenced before publishing. No icon row was added.

**Legal**
- Only the Oracle Card Reading cancellation policy exists in full and is reproduced
  verbatim. Terms, Privacy, Cookies, Shipping and Refund policies exist as footer links
  on the live site and need their content brought across, then professional review.
- Membership and gift card terms cannot be written until those programmes are defined.

**Contact**
- `connectwdls@gmail.com` is the current address, and the source notes it will change.
  It appears in the page footers and on the contact page.

**Forms**
- No backend is connected. Every form confirms locally and directs the visitor to
  WhatsApp or email rather than silently failing.
- Cart and wishlist are stored in the visitor's own browser only.

## Facts used as supplied

Phone: +91-9830859755 · +91-9836783088
Studio: Designz Life Studio, Santoshpur Avenue, opposite Modern View Apartments,
Rani Rashmoni Bagan, Santoshpur, Kolkata, West Bengal
Social: Instagram / Facebook / Threads / X — designzlife8
Jurisdiction: courts in Kolkata, West Bengal

Confirmed prices are used exactly: consultations ₹500 / from ₹1,000 / ₹1,500;
Alaap ₹499; candles ₹199→₹175; notebooks ₹155→₹128.65; badges ₹75→₹57;
bookmarks ₹110→₹83.60; mouse pads ₹210→₹159.60; terracotta planters ₹2,000;
macramé planter ₹300→₹228; E-Bliss Card ₹250–₹2,500 or other amount.
