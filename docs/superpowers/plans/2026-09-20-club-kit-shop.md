# Club Kit Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the club's one-Payment-Link-per-item kit page with a real multi-item cart that checks out once via a single, dynamically-built Stripe Checkout Session.

**Architecture:** A new `kit` Astro content collection holds the product catalog (name, price, optional image, optional sizes). A small vanilla-JS module (`src/lib/cart.js`) manages a `sessionStorage`-backed cart, shared by a listing page, a cart-review page, and a header badge. Checkout is the one piece that can't be pure client-side (Stripe's client-only Checkout API was removed in September 2025): a Netlify Function receives the cart's `{id, size, quantity}` lines, re-derives every price/name itself from a build-time-generated trusted catalog JSON (never trusting client-submitted prices), and creates the Stripe Checkout Session server-side. The Astro site itself stays `output: 'static'` — the Function is deployed by Netlify independently, the same way Netlify Forms and Identity already work without any Astro-side server config.

**Tech Stack:** Astro content collections (existing pattern), vanilla JS (existing pattern — no framework), `stripe` (new, Netlify Function only), `gray-matter` (new, build-time catalog script only), Netlify Functions (V2, `export default` + `Response`).

**Spec:** `docs/superpowers/specs/2026-09-20-club-kit-shop-design.md`

## Global Constraints

- Cart storage is `sessionStorage` (not `localStorage`) — explicit choice, cart clears when the tab closes.
- The Netlify Function must never trust a client-submitted price or name — it always looks up the real price from its own bundled catalog by `id`, and validates `size` against that item's own allowed sizes.
- No shipping address collection in Stripe Checkout — kit is collected through the club, not mailed (explicit decision).
- No pre-created Stripe Price objects — line items use inline `price_data`, so the Stripe account itself needs zero product/catalog configuration.
- Astro stays `output: 'static'` — no adapter change, no SSR.
- No unit test framework in this project. Verification = `npm run build` succeeds, plus temporary Node scripts (written, run, then deleted — not committed) for the two pieces of real logic (`cart.js`, `create-checkout.mjs`'s `buildCheckoutParams`) that benefit from automated checks beyond a build/grep pass.
- `STRIPE_SECRET_KEY` is a Netlify environment variable, never committed. No task in this plan can exercise a real Stripe API call — that verification is a manual step for the site owner after deployment (documented in Task 9), since only they hold real credentials.

---

### Task 1: Kit content collection, CMS config, seed content

**Files:**
- Modify: `src/content.config.ts`
- Modify: `public/admin/config.yml`
- Create: `src/content/kit/club-vest.md`
- Create: `src/content/kit/club-hoodie.md`
- Create: `src/content/kit/neck-warmer.md`
- Create: `public/uploads/kit/placeholder-vest.svg`

**Interfaces:**
- Produces: `getCollection('kit')` entries typed `{ name: string, description?: string, image?: string, priceGBP: number, sizes?: string[] }`, entry `id` = filename without extension (e.g. `club-vest`). Consumed by Tasks 4, 5, 6, 7.

- [ ] **Step 1: Add the `kit` collection to `src/content.config.ts`**

Add this collection definition (alongside the existing `news`/`events`/`team`/`sponsors`/`contentPages` ones) and add `kit` to the final `export const collections = { ... }` object:

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

- [ ] **Step 2: Write the placeholder vest image**

`public/uploads/kit/placeholder-vest.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#004681"/>
  <text x="100" y="105" font-family="sans-serif" font-size="18" fill="#faf7f0" text-anchor="middle">Club Vest</text>
</svg>
```

- [ ] **Step 3: Write the three seed kit entries**

`src/content/kit/club-vest.md`:

```markdown
---
name: "Club Vest"
description: "The classic Eton Manor racing vest."
image: "/uploads/kit/placeholder-vest.svg"
priceGBP: 20
sizes: ["XS", "S", "M", "L", "XL"]
---
```

`src/content/kit/club-hoodie.md`:

```markdown
---
name: "Club Hoodie"
description: "Warm up and cool down in club colours."
priceGBP: 20
sizes: ["XS", "S", "M", "L", "XL"]
---
```

`src/content/kit/neck-warmer.md`:

```markdown
---
name: "Neck Warmer"
description: "One size, keeps the chill off on early starts."
priceGBP: 7
---
```

- [ ] **Step 4: Add the `kit` collection to `public/admin/config.yml`**

Add this as a new top-level collection entry (following the same shape as the existing `sponsors`/`content-pages` collections — own `media_folder`/`public_folder` subfolder, `identifier_field` since there's no `title` field):

```yaml
  - name: "kit"
    label: "Club Kit"
    folder: "src/content/kit"
    create: true
    slug: "{{slug}}"
    identifier_field: "name"
    media_folder: "{{media_folder}}/kit"
    public_folder: "{{public_folder}}/kit"
    fields:
      - { label: "Name", name: "name", widget: "string" }
      - { label: "Description", name: "description", widget: "text", required: false }
      - { label: "Image", name: "image", widget: "image", required: false }
      - { label: "Price (GBP)", name: "priceGBP", widget: "number", value_type: "float" }
      - label: "Sizes"
        name: "sizes"
        widget: "list"
        required: false
        field: { label: "Size", name: "size", widget: "string" }
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: exits 0 — Astro's content layer validates all three seed entries against the Zod schema (a schema mismatch would fail here).

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts public/admin/config.yml src/content/kit public/uploads/kit
git commit -m "Add kit content collection, CMS config, and seed items"
```

---

### Task 2: Cart module (`src/lib/cart.js`)

**Files:**
- Create: `src/lib/cart.js`

**Interfaces:**
- Produces (all plain functions, no default export):
  - `getCart(): {id: string, size: string|null, quantity: number}[]`
  - `addToCart(id: string, size: string|null, quantity: number): void`
  - `removeFromCart(id: string, size: string|null): void`
  - `updateQuantity(id: string, size: string|null, quantity: number): void` (quantity `<= 0` removes the line)
  - `clearCart(): void`
  - `getCartCount(): number`
  - Every mutating function dispatches `document.dispatchEvent(new CustomEvent('cart:change', { detail: { items } }))` after writing to `sessionStorage`.
  - Consumed by Tasks 3, 4, 5, 6.

- [ ] **Step 1: Write `src/lib/cart.js`**

```js
const CART_KEY = 'etonManorCart';

export function getCart() {
  const raw = sessionStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent('cart:change', { detail: { items } }));
}

export function addToCart(id, size, quantity) {
  const items = getCart();
  const existing = items.find((item) => item.id === id && item.size === size);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ id, size, quantity });
  }
  saveCart(items);
}

export function removeFromCart(id, size) {
  const items = getCart().filter((item) => !(item.id === id && item.size === size));
  saveCart(items);
}

export function updateQuantity(id, size, quantity) {
  const items = getCart();
  const existing = items.find((item) => item.id === id && item.size === size);
  if (!existing) return;
  if (quantity <= 0) {
    removeFromCart(id, size);
    return;
  }
  existing.quantity = quantity;
  saveCart(items);
}

export function clearCart() {
  sessionStorage.removeItem(CART_KEY);
  document.dispatchEvent(new CustomEvent('cart:change', { detail: { items: [] } }));
}

export function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}
```

- [ ] **Step 2: Write a temporary verification script and run it**

Write `scripts/_verify-cart.mjs` (temporary — deleted in Step 3):

```js
globalThis.sessionStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
})();
globalThis.document = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent {
  constructor(type, opts) {
    this.type = type;
    this.detail = opts?.detail;
  }
};

const { getCart, addToCart, removeFromCart, updateQuantity, clearCart, getCartCount } =
  await import('../src/lib/cart.js');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok: ${message}`);
}

assert(JSON.stringify(getCart()) === '[]', 'empty cart should be []');

addToCart('vest', 'M', 2);
assert(getCartCount() === 2, 'count should be 2 after adding 2');

addToCart('vest', 'M', 1);
assert(getCartCount() === 3, 'count should be 3 after incrementing same id+size');
assert(getCart().length === 1, 'same id+size should still be 1 line item');

addToCart('vest', 'L', 1);
assert(getCart().length === 2, 'different size should be a separate line item');

updateQuantity('vest', 'M', 5);
assert(getCart().find((i) => i.id === 'vest' && i.size === 'M').quantity === 5, 'updateQuantity should set quantity to 5');

updateQuantity('vest', 'L', 0);
assert(getCart().length === 1, 'updateQuantity to 0 should remove the line item');

addToCart('neck-warmer', null, 1);
removeFromCart('vest', 'M');
assert(getCart().length === 1 && getCart()[0].id === 'neck-warmer', 'removeFromCart should leave only neck-warmer');

clearCart();
assert(getCart().length === 0, 'clearCart should empty the cart');

console.log('All cart.js checks passed');
```

Run: `node scripts/_verify-cart.mjs`
Expected: prints each `ok: ...` line, ending with `All cart.js checks passed`, exit code 0.

- [ ] **Step 3: Delete the temporary verification script**

```bash
rm scripts/_verify-cart.mjs
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/cart.js
git commit -m "Add sessionStorage-backed cart module"
```

---

### Task 3: Cart badge in the header

**Files:**
- Modify: `src/components/Header.astro`

**Interfaces:**
- Consumes: `getCartCount()` from `src/lib/cart.js` (Task 2).
- Produces: nothing new consumed elsewhere — this is a leaf UI change.

- [ ] **Step 1: Add the cart link between the desktop `</nav>` and the burger `<button id="nav-toggle"`**

In `src/components/Header.astro`, insert this immediately after the closing `</nav>` on line 81 (the one that closes `<nav class="hidden sm:block">`) and before the `<button id="nav-toggle"` on line 83:

```astro
    <a
      href="/club-kit/cart"
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-powder/20"
      aria-label="View cart"
    >
      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.994-4.693 2.615-7.151.16-.633-.32-1.249-.972-1.249H4.756m3.132 8.4l-.94-3.526M6.75 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
      <span
        id="cart-count"
        class="absolute -right-0.5 -top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-powder text-xs font-semibold text-ink"
      >
        0
      </span>
    </a>

```

- [ ] **Step 2: Add the badge-update script**

In the existing `<script>` block at the bottom of the file (the one starting `const toggle = document.getElementById('nav-toggle');`), add this import at the very top of the script and this code at the very end (after the existing `document.addEventListener('click', () => closeAllDropdowns());` line):

Add as the first line of the `<script>` block:
```js
import { getCartCount } from '../lib/cart.js';
```

Add as the last lines of the `<script>` block:
```js
function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
  badge.classList.toggle('flex', count > 0);
}

updateCartBadge();
document.addEventListener('cart:change', updateCartBadge);
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: exits 0.

Run: `grep -o 'id="cart-count"' dist/index.html`
Expected: prints `id="cart-count"` (confirms the badge markup renders on a real page).

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.astro
git commit -m "Add cart badge to header"
```

---

### Task 4: Club Kit listing page

**Files:**
- Create: `src/pages/club-kit/index.astro`

**Interfaces:**
- Consumes: `getCollection('kit')` (Task 1), `addToCart` from `src/lib/cart.js` (Task 2), `BaseLayout` (existing, `{title, description?}` props).
- Produces: `/club-kit` route — no other task depends on this file.

- [ ] **Step 1: Write `src/pages/club-kit/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

const kit = await getCollection('kit');
---
<BaseLayout title="Club Kit — Eton Manor Running Club">
  <section class="mx-auto max-w-5xl px-6 py-16">
    <h1 class="mb-8 text-4xl uppercase tracking-wide">Club Kit</h1>
    <div class="grid gap-6 sm:grid-cols-3">
      {kit.map((item) => (
        <div class="flex flex-col rounded-xl bg-paper p-4 shadow-card">
          {item.data.image && (
            <img
              src={item.data.image}
              alt={item.data.name}
              class="mb-4 aspect-square w-full rounded-lg object-cover"
            />
          )}
          <h2 class="font-[family-name:--font-heading] text-xl">{item.data.name}</h2>
          {item.data.description && <p class="mt-1 text-sm">{item.data.description}</p>}
          <p class="mt-2 font-semibold">£{item.data.priceGBP.toFixed(2)}</p>
          <form class="add-to-cart-form mt-4 flex flex-col gap-2" data-id={item.id}>
            {item.data.sizes && item.data.sizes.length > 0 && (
              <select name="size" class="rounded-lg border border-navy/40 px-3 py-2" required>
                <option value="" disabled selected>Select size</option>
                {item.data.sizes.map((size) => <option value={size}>{size}</option>)}
              </select>
            )}
            <input
              type="number"
              name="quantity"
              value="1"
              min="1"
              class="rounded-lg border border-navy/40 px-3 py-2"
            />
            <button
              type="submit"
              class="rounded-full bg-navy px-4 py-2 font-semibold uppercase tracking-wide text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-navy/80"
            >
              Add to Cart
            </button>
          </form>
        </div>
      ))}
    </div>
  </section>
</BaseLayout>

<script>
  import { addToCart } from '../../lib/cart.js';

  document.querySelectorAll('.add-to-cart-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const id = form.dataset.id;
      const formData = new FormData(form);
      const size = formData.get('size') || null;
      const quantity = Number(formData.get('quantity')) || 1;
      addToCart(id, size, quantity);
    });
  });
</script>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/club-kit/index.html` exists.

Run: `grep -c 'Club Vest\|Club Hoodie\|Neck Warmer' dist/club-kit/index.html`
Expected: a count of 3 (all three seeded items appear).

Run: `grep -o '<select name="size"' dist/club-kit/index.html | wc -l`
Expected: `2` (Club Vest and Club Hoodie have sizes; Neck Warmer doesn't, so only 2 `<select>` elements should exist).

- [ ] **Step 3: Commit**

```bash
git add src/pages/club-kit/index.astro
git commit -m "Add club kit listing page with add-to-cart"
```

---

### Task 5: Cart review page

**Files:**
- Create: `src/pages/club-kit/cart.astro`

**Interfaces:**
- Consumes: `getCollection('kit')` (Task 1, for name/price lookups), `getCart`/`removeFromCart` from `src/lib/cart.js` (Task 2), `BaseLayout` (existing).
- Calls the checkout contract Task 8 implements: `POST /api/checkout` with JSON body `{ items: {id, size, quantity}[] }`, expecting `200 { url: string }` on success or `4xx/5xx { error: string }` on failure.
- Produces: `/club-kit/cart` route — no other task depends on this file.

- [ ] **Step 1: Write `src/pages/club-kit/cart.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

const kit = await getCollection('kit');
const catalog = kit.map((item) => ({
  id: item.id,
  name: item.data.name,
  priceGBP: item.data.priceGBP,
}));
---
<BaseLayout title="Your Cart — Eton Manor Running Club">
  <section class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="mb-8 text-4xl uppercase tracking-wide">Your Cart</h1>
    <div id="cart-empty" class="hidden">
      <p>Your cart is empty. <a href="/club-kit" class="underline">Browse Club Kit</a>.</p>
    </div>
    <div id="cart-contents" class="hidden">
      <ul id="cart-lines" class="flex flex-col gap-4"></ul>
      <p class="mt-6 text-lg font-semibold">Subtotal: £<span id="cart-subtotal">0.00</span></p>
      <button
        id="checkout-button"
        type="button"
        class="mt-4 rounded-full bg-navy px-6 py-3 font-semibold uppercase tracking-wide text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-navy/80 hover:shadow-card-hover"
      >
        Checkout
      </button>
      <p id="checkout-error" class="mt-2 hidden text-sm text-red-700"></p>
    </div>
  </section>
</BaseLayout>

<script type="application/json" id="kit-catalog" set:html={JSON.stringify(catalog)} />

<script>
  import { getCart, removeFromCart } from '../../lib/cart.js';

  const catalogEl = document.getElementById('kit-catalog');
  const catalog = JSON.parse(catalogEl.textContent);

  function render() {
    const items = getCart();
    const emptyEl = document.getElementById('cart-empty');
    const contentsEl = document.getElementById('cart-contents');
    const linesEl = document.getElementById('cart-lines');
    const subtotalEl = document.getElementById('cart-subtotal');

    if (items.length === 0) {
      emptyEl.classList.remove('hidden');
      contentsEl.classList.add('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    contentsEl.classList.remove('hidden');

    linesEl.innerHTML = '';
    let subtotal = 0;
    for (const item of items) {
      const product = catalog.find((p) => p.id === item.id);
      if (!product) continue;
      const lineTotal = product.priceGBP * item.quantity;
      subtotal += lineTotal;

      const li = document.createElement('li');
      li.className = 'flex items-center justify-between rounded-xl bg-paper p-4 shadow-card';
      li.innerHTML = `
        <div>
          <p class="font-[family-name:--font-heading] text-xl">${product.name}${item.size ? ' — ' + item.size : ''}</p>
          <p class="text-sm">£${product.priceGBP.toFixed(2)} × ${item.quantity} = £${lineTotal.toFixed(2)}</p>
        </div>
        <button type="button" class="remove-line rounded-full px-3 py-1.5 text-sm uppercase hover:bg-navy/10" data-id="${item.id}" data-size="${item.size ?? ''}">
          Remove
        </button>
      `;
      linesEl.appendChild(li);
    }
    subtotalEl.textContent = subtotal.toFixed(2);

    linesEl.querySelectorAll('.remove-line').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeFromCart(btn.dataset.id, btn.dataset.size || null);
        render();
      });
    });
  }

  render();
  document.addEventListener('cart:change', render);

  document.getElementById('checkout-button')?.addEventListener('click', async () => {
    const errorEl = document.getElementById('checkout-error');
    errorEl.classList.add('hidden');
    const items = getCart();
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }
      window.location.href = data.url;
    } catch (err) {
      errorEl.textContent = 'Something went wrong, please try again.';
      errorEl.classList.remove('hidden');
    }
  });
</script>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/club-kit/cart/index.html` exists.

Run: `grep -o 'id="kit-catalog"' dist/club-kit/cart/index.html`
Expected: prints `id="kit-catalog"`.

Run: `grep -o 'Club Vest' dist/club-kit/cart/index.html`
Expected: prints `Club Vest` (confirms the catalog JSON, containing the seeded item names, is embedded in the page).

- [ ] **Step 3: Commit**

```bash
git add src/pages/club-kit/cart.astro
git commit -m "Add cart review page with checkout call"
```

---

### Task 6: Order success page

**Files:**
- Create: `src/pages/club-kit/success.astro`

**Interfaces:**
- Consumes: `clearCart` from `src/lib/cart.js` (Task 2), `BaseLayout` (existing).
- Produces: `/club-kit/success` route, referenced as the Stripe Checkout `success_url` by Task 8.

- [ ] **Step 1: Write `src/pages/club-kit/success.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
---
<BaseLayout title="Order Confirmed — Eton Manor Running Club">
  <section class="mx-auto max-w-3xl px-6 py-16 text-center">
    <h1 class="mb-4 text-4xl uppercase tracking-wide">Thanks for your order!</h1>
    <p>Your payment was successful. The kit coordinator will be in touch about collection.</p>
  </section>
</BaseLayout>

<script>
  import { clearCart } from '../../lib/cart.js';
  clearCart();
</script>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/club-kit/success/index.html` exists.

Run: `grep -o 'Thanks for your order' dist/club-kit/success/index.html`
Expected: prints `Thanks for your order`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/club-kit/success.astro
git commit -m "Add order success page"
```

---

### Task 7: Trusted catalog generation script

**Files:**
- Create: `scripts/generate-kit-catalog.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `src/content/kit/*.md` frontmatter directly (Task 1's seed files) — parsed independently of Astro's content-layer pipeline, since a Netlify Function can't import the `astro:content` virtual module.
- Produces: `netlify/functions/kit-catalog.json`, an array of `{ id: string, name: string, priceGBP: number, sizes: string[] }` (one entry per `src/content/kit/*.md` file, `sizes` defaulting to `[]` when absent). Consumed by Task 8.

- [ ] **Step 1: Add the `gray-matter` dependency**

Run: `npm install gray-matter`

- [ ] **Step 2: Write `scripts/generate-kit-catalog.mjs`**

```js
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const KIT_DIR = 'src/content/kit';
const OUTPUT_PATH = 'netlify/functions/kit-catalog.json';

const files = readdirSync(KIT_DIR).filter((file) => file.endsWith('.md'));

const catalog = files.map((file) => {
  const id = file.replace(/\.md$/, '');
  const raw = readFileSync(join(KIT_DIR, file), 'utf-8');
  const { data } = matter(raw);
  return {
    id,
    name: data.name,
    priceGBP: data.priceGBP,
    sizes: data.sizes ?? [],
  };
});

mkdirSync('netlify/functions', { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2) + '\n');

console.log(`Generated ${OUTPUT_PATH} with ${catalog.length} kit item(s).`);
```

- [ ] **Step 3: Wire it as a `prebuild` npm script**

In `package.json`'s `"scripts"` block, add:

```json
    "prebuild": "node scripts/generate-kit-catalog.mjs",
```

(npm automatically runs `prebuild` before `build` whenever `npm run build` is invoked — no other wiring needed.)

- [ ] **Step 4: Ignore the generated catalog file**

Add to `.gitignore`:

```gitignore
netlify/functions/kit-catalog.json
```

- [ ] **Step 5: Run and verify**

Run: `npm run build`
Expected: exits 0. Build output includes a line like `Generated netlify/functions/kit-catalog.json with 3 kit item(s).` before the Astro build steps.

Run: `cat netlify/functions/kit-catalog.json`
Expected: a JSON array of 3 objects — `club-vest` (priceGBP 20, sizes with 5 entries), `club-hoodie` (priceGBP 20, sizes with 5 entries), `neck-warmer` (priceGBP 7, sizes `[]`).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-kit-catalog.mjs package.json package-lock.json .gitignore
git commit -m "Add build-time trusted kit catalog generator"
```

---

### Task 8: Netlify Function — Stripe Checkout Session creation

**Files:**
- Create: `netlify/functions/create-checkout.mjs`
- Modify: `package.json`
- Modify: `netlify.toml`

**Interfaces:**
- Consumes: `netlify/functions/kit-catalog.json` (Task 7's generated shape), the `POST /api/checkout` contract Task 5's client code already calls.
- Produces: `POST /api/checkout` — request body `{ items: {id, size, quantity}[] }`; response `200 { url: string }` on success, `400 { error: string }` for any invalid cart content, `500 { error: string }` for a Stripe API failure. Exports `buildCheckoutParams(cartItems, catalogData, origin)` and `ValidationError` for direct testing (see Step 3).

- [ ] **Step 1: Add the `stripe` dependency**

Run: `npm install stripe`

- [ ] **Step 2: Write `netlify/functions/create-checkout.mjs`**

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Stripe from 'stripe';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(__dirname, 'kit-catalog.json'), 'utf-8'));

export class ValidationError extends Error {}

export function buildCheckoutParams(cartItems, catalogData, origin) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new ValidationError('Cart is empty.');
  }

  const line_items = cartItems.map((cartItem) => {
    const product = catalogData.find((p) => p.id === cartItem.id);
    if (!product) {
      throw new ValidationError(`Unknown item: ${cartItem.id}`);
    }

    const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
    if (hasSizes && !product.sizes.includes(cartItem.size)) {
      throw new ValidationError(`Invalid size for ${product.name}.`);
    }
    if (!hasSizes && cartItem.size) {
      throw new ValidationError(`${product.name} does not have sizes.`);
    }

    const quantity = Number(cartItem.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ValidationError(`Invalid quantity for ${product.name}.`);
    }

    return {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: cartItem.size ? `${product.name} — ${cartItem.size}` : product.name,
        },
        unit_amount: Math.round(product.priceGBP * 100),
      },
      quantity,
    };
  });

  return {
    mode: 'payment',
    line_items,
    success_url: `${origin}/club-kit/success`,
    cancel_url: `${origin}/club-kit/cart`,
  };
}

export default async (req) => {
  const origin = new URL(req.url).origin;
  const jsonHeaders = { 'Content-Type': 'application/json' };

  let items;
  try {
    const body = await req.json();
    items = body.items;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  let params;
  try {
    params = buildCheckoutParams(items, catalog, origin);
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    throw err;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create(params);
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
};

export const config = { path: '/api/checkout' };
```

- [ ] **Step 3: Write a temporary verification script and run it**

This exercises `buildCheckoutParams` directly — the security-critical validation logic — with zero real Stripe calls or credentials, since `buildCheckoutParams` only builds parameters, it never calls Stripe itself.

Write `scripts/_verify-checkout.mjs` (temporary — deleted in Step 4):

```js
const { buildCheckoutParams, ValidationError } = await import(
  '../netlify/functions/create-checkout.mjs'
);

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok: ${message}`);
}

function assertThrowsValidationError(fn, message) {
  try {
    fn();
    throw new Error(`FAIL: ${message} (did not throw)`);
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    console.log(`ok: ${message}`);
  }
}

const catalog = [
  { id: 'vest', name: 'Club Vest', priceGBP: 20, sizes: ['S', 'M', 'L'] },
  { id: 'neck-warmer', name: 'Neck Warmer', priceGBP: 7, sizes: [] },
];

const params1 = buildCheckoutParams(
  [{ id: 'vest', size: 'M', quantity: 2 }],
  catalog,
  'https://example.com',
);
assert(params1.line_items[0].quantity === 2, 'sized item: quantity should be 2');
assert(params1.line_items[0].price_data.unit_amount === 2000, 'sized item: unit_amount should be 2000 pence');
assert(params1.success_url === 'https://example.com/club-kit/success', 'success_url should use the given origin');
assert(params1.cancel_url === 'https://example.com/club-kit/cart', 'cancel_url should use the given origin');

const params2 = buildCheckoutParams(
  [{ id: 'neck-warmer', size: null, quantity: 1 }],
  catalog,
  'https://example.com',
);
assert(params2.line_items[0].price_data.unit_amount === 700, 'unsized item: unit_amount should be 700 pence');

assertThrowsValidationError(
  () => buildCheckoutParams([{ id: 'nope', size: null, quantity: 1 }], catalog, 'https://example.com'),
  'unknown item id should be rejected',
);

assertThrowsValidationError(
  () => buildCheckoutParams([{ id: 'vest', size: 'XXL', quantity: 1 }], catalog, 'https://example.com'),
  'invalid size for a sized item should be rejected',
);

assertThrowsValidationError(
  () => buildCheckoutParams([{ id: 'neck-warmer', size: 'M', quantity: 1 }], catalog, 'https://example.com'),
  'a size on an unsized item should be rejected',
);

assertThrowsValidationError(
  () => buildCheckoutParams([{ id: 'vest', size: null, quantity: 1 }], catalog, 'https://example.com'),
  'a missing size on a sized item should be rejected',
);

assertThrowsValidationError(
  () => buildCheckoutParams([{ id: 'vest', size: 'M', quantity: 0 }], catalog, 'https://example.com'),
  'a zero quantity should be rejected',
);

assertThrowsValidationError(
  () => buildCheckoutParams([], catalog, 'https://example.com'),
  'an empty cart should be rejected',
);

console.log('All create-checkout validation checks passed');
```

Run: `node scripts/_verify-checkout.mjs`
Expected: prints each `ok: ...` line, ending with `All create-checkout validation checks passed`, exit code 0. This requires `netlify/functions/kit-catalog.json` to already exist — if it doesn't, run `npm run build` first (Task 7's `prebuild` script generates it).

- [ ] **Step 4: Delete the temporary verification script**

```bash
rm scripts/_verify-checkout.mjs
```

- [ ] **Step 5: Add the Netlify functions directory to `netlify.toml`**

Current `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Replace with:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  included_files = ["netlify/functions/kit-catalog.json"]
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: exits 0 (this only builds the static site; the Function itself is verified by Step 3's script, not by `astro build`).

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/create-checkout.mjs package.json package-lock.json netlify.toml
git commit -m "Add Netlify Function to create Stripe Checkout Sessions"
```

---

### Task 9: README setup docs and final full-site verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new — final wrap-up and full-site smoke test of every route from Tasks 1–8.
- Produces: setup documentation — nothing else depends on this task.

- [ ] **Step 1: Add a "Club Kit shop" section to `README.md`**

Add this new section (placed after the existing "Editing content via Sveltia CMS" section):

```markdown
## Club Kit shop

Kit items are managed via `/admin` → Club Kit, same as any other
collection. Checkout is a Netlify Function
(`netlify/functions/create-checkout.mjs`) that creates a Stripe Checkout
Session server-side — it never trusts prices from the browser, only the
`id`/`size`/`quantity` a shopper picked, re-pricing everything from a
catalog file generated at build time (`npm run build` regenerates
`netlify/functions/kit-catalog.json` automatically via the `prebuild`
script — never edit that file by hand).

**One-time setup, outside this repo:**

1. Create a Stripe account (if you don't already have one) and grab a
   secret key from the Stripe dashboard (test-mode key while developing,
   live-mode key before accepting real orders).
2. In Netlify: **Site configuration → Environment variables** → add
   `STRIPE_SECRET_KEY` with that value. It's never committed to this repo.
3. To test locally before deploying: run `netlify dev` (requires the
   [Netlify CLI](https://docs.netlify.com/cli/get-started/)), with a local
   `.env` file (git-ignored) containing `STRIPE_SECRET_KEY=sk_test_...`.
   Add a kit item or two via the CMS or by hand in `src/content/kit/`, add
   one to the cart at `/club-kit`, and check out — you should land on a
   real Stripe test-mode Checkout page. Use
   [Stripe's documented test card number](https://docs.stripe.com/testing)
   to complete a test payment and confirm you're redirected back to
   `/club-kit/success` with the cart cleared afterward.
4. No code in this repo can exercise a real Stripe API call without your
   own key — the check in step 3 is the one piece of this feature that
   only you can verify.
```

- [ ] **Step 2: Full build and route-by-route verification**

Run: `npm run build`
Expected: exits 0.

Run:
```bash
for f in dist/club-kit/index.html dist/club-kit/cart/index.html dist/club-kit/success/index.html dist/index.html; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```
Expected: every line printed as `OK: <path>`, none as `MISSING`.

Run: `cat netlify/functions/kit-catalog.json`
Expected: valid JSON, 3 entries, matches the seeded kit items.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document club kit shop setup in README"
```

---

## Self-Review Notes

- **Spec coverage:** content model (Task 1), cart module + sessionStorage
  (Task 2), header badge (Task 3), listing page (Task 4), cart review +
  checkout call (Task 5), success page + cart clearing (Task 6), trusted
  catalog generation (Task 7), the Function itself with server-side
  price/size validation (Task 8), manual Stripe setup docs (Task 9) —
  every section of the spec maps to a task. The three rejected
  alternatives (Payment Links only, Snipcart) don't need tasks — they're
  documented as rejected in the spec.
- **Placeholder scan:** no TBD/TODO; every step has full file contents or
  runnable commands. The two "write a temp script, run it, delete it"
  steps (Tasks 2 and 8) are a deliberate, explicit pattern — not a
  placeholder — chosen because this project has no test framework and
  these two pieces of logic (cart state transitions, checkout
  validation) are complex enough to warrant real automated checks beyond
  a build+grep pass, the same way earlier work in this project used
  temporary seed/test entries for content collections.
- **Type consistency:** `cart.js`'s function names/signatures
  (`getCart`, `addToCart(id, size, quantity)`, `removeFromCart(id, size)`,
  `updateQuantity(id, size, quantity)`, `clearCart`, `getCartCount`) are
  used identically across Tasks 3, 4, 5, 6. The `/api/checkout` request/
  response contract in Task 5 (`{items: {id,size,quantity}[]}` →
  `{url}`/`{error}`) matches exactly what Task 8's Function implements.
  `buildCheckoutParams`'s catalog item shape (`{id, name, priceGBP,
  sizes}`) matches exactly what Task 7's script generates.
