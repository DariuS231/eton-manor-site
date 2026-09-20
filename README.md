# Eton Manor Running Club

Astro + Tailwind CSS v4 site for Eton Manor Running Club, with content
editable via Sveltia CMS.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Content

- `src/content/news`, `src/content/events`, `src/content/team` — Astro
  content collections, one Markdown file per entry.
- `src/data/*.json` — site-wide singletons (home, about, contact, nav/
  footer/social settings).
- Collection schemas are defined in `src/content.config.ts` (this
  project's installed Astro version requires this flat path, not the
  nested `src/content/config.ts` path used in some Astro docs/examples).

## Editing content via Sveltia CMS

The CMS admin UI is served at `/admin` (`public/admin/index.html` +
`config.yml`), backed by the `github` backend (Sveltia CMS does not
support Netlify Identity + Git Gateway). Setup, one-time and outside the
repo:

> **Local dev note:** Astro's dev server (`npm run dev`) does not resolve
> `/admin` or `/admin/` to `public/admin/index.html` — this is a known,
> won't-fix Astro limitation ([withastro/astro#14800](https://github.com/withastro/astro/issues/14800)).
> Use `http://localhost:PORT/admin/index.html` while running `npm run dev`.
> `npm run build && npm run preview`, and the deployed Netlify site, both
> resolve plain `/admin` correctly.

1. Update `public/admin/config.yml`'s `repo:` field to the actual
   `owner/repo-name` before deploying.
2. Register a GitHub OAuth App at
   https://github.com/settings/developers ("New OAuth App"). The
   Homepage URL can be the site's URL; the **Authorization callback URL
   must be exactly `https://api.netlify.com/auth/done`**.
3. Note the OAuth App's Client ID and Client Secret.
4. In Netlify: **Project configuration → Access & security → OAuth**
   (labeled "Access control → OAuth" in some Netlify UI versions), under
   Authentication Providers, select **Install provider**, choose
   **GitHub**, and enter the Client ID and Client Secret. Save.
5. Editors must have push/write access to the GitHub repository (added
   as a collaborator, or as an org member with write access) — Sveltia
   CMS commits directly via the GitHub API using their authenticated
   permissions.

This is still a one-time, manual setup step outside the repo, same as
before — just a different provider.

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

## Deployment

Connect this repository to Netlify. `netlify.toml` sets the build command
(`npm run build`) and publish directory (`dist`). The contact form on
`/contact` uses Netlify Forms via static HTML detection. Form detection
must be enabled once in the Netlify UI: **Site configuration → Forms →
enable detection** — before submissions will be captured.
