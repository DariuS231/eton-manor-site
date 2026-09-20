# Club Kit Shop — Design Spec

Date: 2026-09-20

## Overview

Replace the club's current "one Stripe Payment Link per product" kit page
(see reference: the live `eton-manor.com/club-kit/` page, which lists ~8
items — vests, t-shirts, hoodies, a neck warmer — each with its own
separate Stripe Payment Link) with a real shopping-cart experience: browse
kit items (some with size options, some without, some with a photo, some
without), add several to a cart, review the cart, and pay for the whole
order in one Stripe Checkout redirect.

Stripe's client-only Checkout integration (`stripe.redirectToCheckout()`
with client-supplied price IDs) was deprecated and removed by Stripe in
September 2025. Today, a dynamically-assembled multi-item Stripe Checkout
Session can only be created server-side (Stripe's secret key can never be
exposed to a browser). This spec therefore adds exactly one small
server-side piece — a Netlify serverless Function — while keeping
everything else in this project exactly as static and client-side as
before.

Two alternatives were considered and rejected:
- **Per-item Stripe Payment Links, no backend at all**: this is what the
  current live site already does, and cannot combine multiple different
  items into a single payment — the specific thing this project exists to
  fix.
- **Snipcart** (hosted cart + checkout widget): genuinely zero backend
  code, but costs the club $10/month plus a 2% transaction fee on top of
  Stripe's own processing fees, indefinitely. Rejected in favor of a
  one-time-build, no-recurring-cost custom Function.

## Stack additions

- `stripe` (official Node SDK) — new dependency, used only inside the
  Netlify Function.
- A Netlify Function at `netlify/functions/create-checkout.ts` (or `.mjs`
  — final extension decided at implementation time based on Netlify's
  current TypeScript function support in this project's Netlify build
  image; plain `.mjs` is the safe fallback if TS functions need extra
  config).
- `netlify.toml` gains a `[functions]` block declaring the functions
  directory.
- A build-time codegen script that regenerates a trusted product-catalog
  JSON file the Function reads (see "Trusted pricing" below).
- No change to `astro.config.mjs` — the Astro site remains
  `output: 'static'`. The Function is deployed by Netlify independently of
  the Astro build, the same way Netlify Forms and Identity already work
  without any Astro-side configuration.

## Content model

### New collection: `kit` (folder collection, `src/content/kit/`)

Schema (`src/content.config.ts`):

```ts
const kit = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/kit' }),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    priceGBP: z.number().positive(),
    sizes: z.array(z.string()).optional(),
  }),
});
```

- `priceGBP` is stored as a decimal pounds value (e.g. `20` for £20.00) —
  CMS-friendly; converted to integer pence only at the point Stripe is
  called.
- `sizes` is a free-text list per item (not a shared enum), matching the
  real catalog's mixed conventions: adult vests/tees use women's 6–18 /
  men's XS–XL, children's tees use ages 5–14, a neck warmer has no sizes
  at all.
- Entry `id` (filename, e.g. `adult-vest`) is the stable product
  identifier used everywhere (cart line items, the trusted catalog, the
  Function).

CMS config (`public/admin/config.yml`), following the same pattern as
every other collection in this project (own `media_folder`/`public_folder`
subfolder, `identifier_field: "name"`):

- Folder collection `kit`, fields: Name (string), Description (text,
  optional), Image (image, optional), Price GBP (number), Sizes (list of
  plain string values, optional).

## Cart

- Client-side only, vanilla JS (no framework — consistent with the rest
  of the site), stored in `sessionStorage` under a single key holding a
  JSON array: `{ id: string, size?: string, quantity: number }[]`.
  `sessionStorage` (not `localStorage`) per explicit choice — the cart
  clears when the browser tab/window closes rather than persisting
  indefinitely.
- A small cart-count badge in `Header.astro`, updated on page load and
  whenever the cart changes (a custom `CustomEvent` dispatched by the cart
  helper after every mutation, listened for by the header's own inline
  script — avoids a page reload to reflect an added item).
- Cart mutation logic (add/remove/update-quantity, event dispatch) lives
  in one shared module, `src/lib/cart.ts`, imported by both `/club-kit`
  (add-to-cart buttons) and `/club-kit/cart` (the review page) so the
  logic isn't duplicated between the two pages.

## Pages

- **`/club-kit`** — every `kit` entry as a card: image (if set), name,
  price, a size `<select>` (only rendered if the item has `sizes`), a
  quantity stepper (default 1), an "Add to Cart" button. Clicking Add
  calls the shared cart module, no page reload.
- **`/club-kit/cart`** — reads the cart from `sessionStorage` at render
  time (client-side, since `sessionStorage` isn't available during
  Astro's build/SSR step), re-displays each line (name/size looked up
  from the same `kit` collection data passed down as a script-embedded
  JSON, quantity editable, a remove control), a computed subtotal, and a
  "Checkout" button. An empty cart shows a plain "Your cart is empty, go
  to Club Kit" message instead of the summary/checkout button.
- **`/club-kit/success`** — static confirmation page ("Thanks — your order
  is confirmed. The kit coordinator will be in touch about collection.").
  A small inline script clears the `sessionStorage` cart key on load, so
  a completed order doesn't linger in the cart.

## Checkout flow

1. On the cart page, "Checkout" reads the current cart from
   `sessionStorage` and `fetch()`s `/.netlify/functions/create-checkout`
   (via a `netlify.toml` redirect, exposed at the friendlier path
   `/api/checkout`) with `{ items: [{ id, size, quantity }] }` as the JSON
   body.
2. **The Function never trusts client-submitted prices or names.** It
   reads `kit-catalog.json` (see "Trusted pricing" below), and for each
   submitted cart line:
   - Looks up the item by `id` in the trusted catalog — rejects the
     request (400) if not found.
   - If the item defines `sizes`, requires `size` to be one of them —
     rejects (400) otherwise. If the item has no `sizes`, requires `size`
     to be absent.
   - Uses the catalog's own `priceGBP` (converted to integer pence) —
     the client's cart entry never carries a price at all, only
     `id`/`size`/`quantity`, so there's nothing to tamper with on this
     axis.
3. The Function creates a Stripe Checkout Session (`mode: 'payment'`),
   one `line_items` entry per cart line using `price_data` (inline price,
   no pre-created Stripe Price objects needed — keeps the Stripe side
   config-free beyond the account itself), `product_data.name` set to
   `"${item.name}${size ? ' — ' + size : ''}"`, `success_url` pointing at
   `/club-kit/success`, `cancel_url` back at `/club-kit/cart`. No
   `shipping_address_collection` — kit is collected through the club, not
   mailed (per explicit decision).
4. Returns `{ url: session.url }` (200) or `{ error: string }` (400/500).
   The cart page redirects via `window.location.href = url` on success,
   or shows an inline error message (e.g. "Something went wrong, please
   try again") on failure — no broken/blank-page redirect.

## Trusted pricing (build-time catalog generation)

A Netlify Function is bundled independently of Astro's Vite pipeline, so
it cannot `import { getCollection } from 'astro:content'` directly (that's
a virtual module Astro's own build resolves, not available to a plain
esbuild-bundled function). Instead:

- `scripts/generate-kit-catalog.mjs` — a small Node script (using
  `gray-matter`, a new lightweight dependency, to parse frontmatter) that
  reads every `src/content/kit/*.md` file and writes
  `netlify/functions/kit-catalog.json`: an array of
  `{ id, name, priceGBP, sizes }` (no `description`/`image` — the Function
  only needs what pricing/validation requires).
- Wired as an npm `prebuild` script (`package.json`:
  `"prebuild": "node scripts/generate-kit-catalog.mjs"`) — npm's
  lifecycle convention runs this automatically before `npm run build`,
  so the catalog is regenerated on every build (local or Netlify) and can
  never drift from what's actually in the CMS content.
- The Function imports this JSON directly (`import catalog from
  './kit-catalog.json'`), so Netlify's function bundler includes it as a
  static local file — no runtime fetch, no extra latency.

## Environment / manual setup (outside this repo)

- You create a Stripe account (if not already done) and obtain a secret
  key.
- In the Netlify dashboard: Site configuration → Environment variables →
  add `STRIPE_SECRET_KEY` (test-mode key while developing, live-mode key
  before real orders are accepted). Never committed to the repo.
- `netlify dev` (run locally) picks up the same environment variable from
  a local `.env` file (git-ignored) for local testing against Stripe's
  test mode before deploying.

## Testing / verification

- `npm run build` succeeds, including the `prebuild` catalog-generation
  step — verify the generated `kit-catalog.json` contains exactly the
  seeded kit entries with correct prices/sizes.
- Seed 2-3 realistic kit items (matching the real catalog's shape: one
  with sizes and an image, one with sizes and no image, one with no sizes
  at all — e.g. a neck warmer) so the build exercises every optional-field
  combination.
- `netlify dev` locally, exercise the full flow by hand against Stripe
  test mode: add items (including a sized item) to the cart, view the
  cart, checkout, land on Stripe's real test-mode Checkout page, complete
  a test payment (Stripe's documented test card number), confirm redirect
  to `/club-kit/success` and that the cart is cleared afterward.
- Verify the Function's server-side validation directly (not just via the
  UI): a request with a tampered/non-existent `id`, an invalid `size` for
  an item, or a size omitted for an item that requires one, must each be
  rejected with 400 — confirms client-submitted data is never trusted for
  pricing.
- No unit test framework, consistent with the rest of this project — the
  above manual/build-time checks are the verification bar, same pattern
  used throughout.

## Out of scope

- Inventory/stock tracking (unlimited availability assumed, matching the
  current site's behavior).
- Shipping address collection (explicit decision — pickup through the
  club only).
- Order history, customer accounts, or any persistence of completed
  orders beyond what Stripe itself records.
- Migrating the real `eton-manor.com` content into this project's seed
  data — seeding uses representative example items only, real kit
  entries are added via the CMS once this ships.
