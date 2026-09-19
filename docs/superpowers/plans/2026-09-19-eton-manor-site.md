# Eton Manor Running Club Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Astro + Tailwind CSS v4 site for the Eton Manor running club, with all content (news, events, team, and site-wide singletons) editable through a git-backed Sveltia CMS admin UI at `/admin`.

**Architecture:** Astro static site (`output: 'static'`) with three Astro content collections (news, events, team) validated by Zod schemas, plus four JSON "singleton" data files (home, about, contact, settings) for page/site copy. A shared `BaseLayout` + `Header`/`Footer` render nav and footer from `settings.json`. Sveltia CMS is a static admin bundle in `public/admin/` that edits the same files directly via git-gateway, so no separate CMS API or database exists.

**Tech Stack:** Astro (latest 5.x), Tailwind CSS v4 (`@tailwindcss/vite`), `@fontsource/barlow-condensed`, `@fontsource/work-sans`, Sveltia CMS (loaded via CDN module script, no npm dependency), Netlify (hosting + Identity/git-gateway auth + Forms).

**Spec:** `docs/superpowers/specs/2026-09-19-eton-manor-site-design.md`

## Global Constraints

- Static output only — no Astro server islands/SSR adapter.
- Tailwind v4 theme tokens must match the spec exactly:
  `--color-navy: #004681`, `--color-powder: #8fc3ea`, `--color-ink: #14181f`,
  `--color-paper: #faf7f0`, `--font-heading: "Barlow Condensed", sans-serif`,
  `--font-body: "Work Sans", sans-serif`.
- Fonts are self-hosted via `@fontsource/*` packages, not a Google Fonts
  runtime `<link>`.
- Sveltia CMS backend is `git-gateway` on branch `main` — no custom OAuth
  app or serverless function.
- Contact form uses Netlify Forms (static `data-netlify="true"` HTML form,
  no JS, no serverless function).
- No unit test framework. Verification per task = `npm run build` succeeds
  + grep the built HTML in `dist/` for expected content. Astro's content
  layer validates all seeded collection entries against their Zod schema
  on every `build`/`dev`, so a schema mismatch fails the build.
- "Today" for seed content purposes is 2026-09-19 (news dates are on/before
  it; events include a mix of before/after it) — verification checks
  content presence, not date-bucket membership, since a later execution
  date would shift which events are "upcoming".
- Node.js and npm are assumed already installed; the plan does not install
  them.

---

### Task 1: Project scaffolding, Tailwind v4 theme, base build

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/styles/global.css`
- Create: `src/pages/index.astro` (placeholder, replaced in Task 5)

**Interfaces:**
- Produces: working `npm run dev` / `npm run build` / `npm run preview`
  scripts; `src/styles/global.css` containing the `@theme` block (imported
  by later layout work in Task 4); Tailwind v4 available project-wide via
  the `@tailwindcss/vite` plugin registered in `astro.config.mjs`.

- [ ] **Step 1: Write `.gitignore`**

```gitignore
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "eton-manor-site",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install astro @tailwindcss/vite tailwindcss @fontsource/barlow-condensed @fontsource/work-sans`

Expected: installs succeed, `package.json` now has a `dependencies` block,
and `package-lock.json` / `node_modules/` are created. This also pulls in
`astro`'s own CLI, so `npm run dev`/`build`/`preview` become valid.

- [ ] **Step 4: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

- [ ] **Step 6: Write `src/styles/global.css`**

```css
@import "tailwindcss";

@theme {
  --color-navy: #004681;
  --color-powder: #8fc3ea;
  --color-ink: #14181f;
  --color-paper: #faf7f0;

  --font-heading: "Barlow Condensed", sans-serif;
  --font-body: "Work Sans", sans-serif;
}

body {
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-body);
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-heading);
}
```

- [ ] **Step 7: Write placeholder `src/pages/index.astro`**

```astro
---
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Eton Manor Running Club</title>
  </head>
  <body>
    <h1>Eton Manor Running Club — scaffolding in progress</h1>
  </body>
</html>
```

- [ ] **Step 8: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/index.html` exists.

Run: `grep -o "scaffolding in progress" dist/index.html`
Expected: prints `scaffolding in progress`.

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json package-lock.json astro.config.mjs tsconfig.json src/styles/global.css src/pages/index.astro
git commit -m "Scaffold Astro project with Tailwind v4 theme"
```

---

### Task 2: Content collections (news, events, team) with seed content

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/news/welcome-new-season.md`
- Create: `src/content/news/club-championship-results.md`
- Create: `src/content/news/new-coaching-team.md`
- Create: `src/content/events/summer-handicap.md`
- Create: `src/content/events/autumn-club-run.md`
- Create: `src/content/events/london-10k.md`
- Create: `src/content/team/jane-whitfield.md`
- Create: `src/content/team/marcus-obi.md`
- Create: `src/content/team/priya-nair.md`

**Interfaces:**
- Consumes: none beyond Astro itself (installed in Task 1).
- Produces: three collections queryable via `getCollection('news' | 'events'
  | 'team')` from `astro:content`, and single entries via `render(entry)`
  from `astro:content` for markdown body rendering. Schemas:
  - `news`: `{ title: string, date: Date, excerpt: string }` + markdown body.
  - `events`: `{ title: string, date: Date, time?: string, location: string,
    eventType: 'Club Run' | 'Race' | 'Social', externalLink?: string }` +
    markdown body.
  - `team`: `{ name: string, role: string }` + optional markdown body (bio).
  - Entry `id` (used as the route slug) is the filename without extension,
    e.g. `welcome-new-season`, `autumn-club-run`, `jane-whitfield`.

- [ ] **Step 1: Write `src/content/config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    time: z.string().optional(),
    location: z.string(),
    eventType: z.enum(['Club Run', 'Race', 'Social']),
    externalLink: z.string().url().optional(),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/team' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
  }),
});

export const collections = { news, events, team };
```

- [ ] **Step 2: Write the three news entries**

`src/content/news/welcome-new-season.md`:

```markdown
---
title: "Welcoming In The New Season"
date: 2026-09-01
excerpt: "Track sessions resume this week as we kick off the autumn training block."
---

Our autumn track season is officially underway! Tuesday and Thursday sessions resume this week at Quarter Mile Lane, with coached groups for every pace from beginner to sub-3-hour marathoners.

New to the club? Just turn up to a Tuesday session and introduce yourself to a coach — no booking required for your first three visits.
```

`src/content/news/club-championship-results.md`:

```markdown
---
title: "Club Championship 5K: Results Are In"
date: 2026-08-15
excerpt: "Over sixty members took on the club championship 5K in warm conditions."
---

Sixty-two members lined up for this year's club championship 5K, and the times were superb despite the August heat.

Congratulations to all finishers, and a special mention to our age-category winners who will be presented with medals at the next club social.
```

`src/content/news/new-coaching-team.md`:

```markdown
---
title: "Introducing Our Expanded Coaching Team"
date: 2026-07-20
excerpt: "Three new UKA-qualified coaches join the club ahead of the autumn block."
---

We're delighted to welcome three newly qualified coaches to the Eton Manor coaching team ahead of the busy autumn season.

Head over to the Team page to meet them and find out which sessions they'll be leading.
```

- [ ] **Step 3: Write the three event entries**

`src/content/events/summer-handicap.md`:

```markdown
---
title: "Summer Handicap Race"
date: 2026-06-06
time: "7:00pm"
location: "Quarter Mile Lane Track"
eventType: "Race"
---

Our annual staggered-start handicap race, open to all members regardless of pace. Marshals and post-race refreshments provided.
```

`src/content/events/autumn-club-run.md`:

```markdown
---
title: "Autumn Social Club Run"
date: 2026-10-04
time: "9:00am"
location: "Clubhouse, Quarter Mile Lane"
eventType: "Club Run"
---

An easy-paced, no-drop social run through the Queen Elizabeth Olympic Park followed by coffee at the clubhouse.
```

`src/content/events/london-10k.md`:

```markdown
---
title: "London Borough 10K"
date: 2026-11-15
time: "10:30am"
location: "Victoria Park"
eventType: "Race"
externalLink: "https://www.runbritain.com/"
---

Club-organised group entry for the London Borough 10K. Contact the committee if you'd like to run in club colours.
```

- [ ] **Step 4: Write the three team entries**

`src/content/team/jane-whitfield.md`:

```markdown
---
name: "Jane Whitfield"
role: "Chair"
---

Jane has led the club since 2019 and runs everything from parkrun to ultramarathons.
```

`src/content/team/marcus-obi.md`:

```markdown
---
name: "Marcus Obi"
role: "Head Coach"
---

UKA Level 3 coach specialising in middle-distance training. Leads Tuesday track sessions.
```

`src/content/team/priya-nair.md`:

```markdown
---
name: "Priya Nair"
role: "Club Coach"
---

Priya coaches our beginner and improver groups, helping new runners build confidence and consistency.
```

- [ ] **Step 5: Build and verify schema validation**

Run: `npm run build`
Expected: exits 0. Astro's content layer sync validates every seeded entry
against its Zod schema during build — a type mismatch (e.g. a bad
`eventType` value) would fail the build here.

- [ ] **Step 6: Commit**

```bash
git add src/content/config.ts src/content/news src/content/events src/content/team
git commit -m "Add news, events, and team content collections with seed content"
```

---

### Task 3: Site-wide singleton data (home, about, contact, settings)

**Files:**
- Create: `src/data/home.json`
- Create: `src/data/about.json`
- Create: `src/data/contact.json`
- Create: `src/data/settings.json`

**Interfaces:**
- Produces: four JSON files importable directly (e.g.
  `import settings from '../data/settings.json'`) with these exact shapes:
  - `home.json`: `{ heroHeading, heroSubheading, heroCtaLabel, heroCtaUrl,
    introBody }` (all strings).
  - `about.json`: `{ heading: string, body: string }` — `body` is plain
    text with `\n\n`-separated paragraphs (not markdown).
  - `contact.json`: `{ intro, meetingPoint, joinCtaLabel, joinCtaUrl }`
    (all strings).
  - `settings.json`: `{ siteTitle: string, navLinks: {label: string, url:
    string}[], footerText: string, socials: {platform: string, url:
    string}[] }`.

- [ ] **Step 1: Write `src/data/home.json`**

```json
{
  "heroHeading": "Run With Eton Manor",
  "heroSubheading": "A friendly running club for all paces, based in East London since 1946.",
  "heroCtaLabel": "Join a Session",
  "heroCtaUrl": "/contact",
  "introBody": "Eton Manor is a community running club welcoming runners of every ability. Whether you're chasing a marathon PB or joining your first ever run, our coached sessions and social runs will help you get there."
}
```

- [ ] **Step 2: Write `src/data/about.json`**

```json
{
  "heading": "About Eton Manor",
  "body": "Eton Manor Running Club was founded to give East London runners a welcoming, well-coached home track. What started as a handful of members training on Tuesday evenings has grown into a club of over two hundred runners of every ability.\n\nToday we train year-round at Quarter Mile Lane, with coached track sessions, social club runs, and a full calendar of races. Whether you're aiming for your first 5K or chasing a championship time, there's a group here running at your pace.\n\nWe're proud of our community as much as our results — post-run coffee, club socials, and a genuinely welcoming atmosphere are as much a part of Eton Manor as the training itself."
}
```

- [ ] **Step 3: Write `src/data/contact.json`**

```json
{
  "intro": "Got a question about training, membership, or just want to say hello? Get in touch below.",
  "meetingPoint": "Eton Manor Running Track, Quarter Mile Lane, London E10 7QB — sessions meet at the clubhouse entrance.",
  "joinCtaLabel": "Join the Club",
  "joinCtaUrl": "https://www.runbritain.com/"
}
```

- [ ] **Step 4: Write `src/data/settings.json`**

```json
{
  "siteTitle": "Eton Manor Running Club",
  "navLinks": [
    { "label": "Home", "url": "/" },
    { "label": "About", "url": "/about" },
    { "label": "Team", "url": "/team" },
    { "label": "Events", "url": "/events" },
    { "label": "News", "url": "/news" },
    { "label": "Contact", "url": "/contact" }
  ],
  "footerText": "© 2026 Eton Manor Running Club. All rights reserved.",
  "socials": [
    { "platform": "Instagram", "url": "https://instagram.com/etonmanorrc" },
    { "platform": "Strava", "url": "https://strava.com/clubs/etonmanor" },
    { "platform": "Facebook", "url": "https://facebook.com/etonmanorrc" }
  ]
}
```

- [ ] **Step 5: Verify JSON is well-formed**

Run: `node -e "['home','about','contact','settings'].forEach(f => JSON.parse(require('fs').readFileSync('src/data/'+f+'.json','utf-8'))); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 6: Commit**

```bash
git add src/data
git commit -m "Add site-wide singleton data files"
```

---

### Task 4: BaseLayout, Header, Footer

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`
- Modify: `src/pages/index.astro` (swap placeholder for BaseLayout usage, proving the wiring — Task 5 replaces this file's body content again)

**Interfaces:**
- Consumes: `src/data/settings.json` shape from Task 3; `src/styles/global.css`
  from Task 1.
- Produces: `BaseLayout.astro` accepting props `{ title: string, description?:
  string }` and a default slot, rendering `<Header />` then `<slot />` then
  `<Footer />` inside `<html>/<body>`. Later page tasks import this layout as
  `import BaseLayout from '../layouts/BaseLayout.astro'` (adjust relative
  depth per page location) and pass `title`.

- [ ] **Step 1: Write `src/components/Header.astro`**

```astro
---
import settings from '../data/settings.json';
---
<header class="bg-navy text-paper">
  <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
    <a href="/" class="font-[family-name:--font-heading] text-2xl font-semibold uppercase tracking-wide">
      {settings.siteTitle}
    </a>
    <nav>
      <ul class="flex gap-6 font-[family-name:--font-body] text-sm uppercase tracking-wide">
        {settings.navLinks.map((link) => (
          <li>
            <a href={link.url} class="hover:text-powder">{link.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: Write `src/components/Footer.astro`**

```astro
---
import settings from '../data/settings.json';
---
<footer class="bg-ink text-paper">
  <div class="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-8 text-sm">
    <ul class="flex gap-4">
      {settings.socials.map((social) => (
        <li>
          <a href={social.url} class="hover:text-powder">{social.platform}</a>
        </li>
      ))}
    </ul>
    <p>{settings.footerText}</p>
  </div>
</footer>
```

- [ ] **Step 3: Write `src/layouts/BaseLayout.astro`**

```astro
---
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Eton Manor Running Club' } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body class="bg-paper text-ink">
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4: Wire the placeholder home page to the new layout**

Replace `src/pages/index.astro` with:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Eton Manor Running Club">
  <p class="p-6">Home page content coming in the next task.</p>
</BaseLayout>
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: exits 0.

Run: `grep -o "Eton Manor Running Club" dist/index.html | head -1`
Expected: prints `Eton Manor Running Club` (confirms `settings.siteTitle`
rendered via `Header`).

Run: `grep -o "Strava" dist/index.html`
Expected: prints `Strava` (confirms `Footer` rendered socials).

- [ ] **Step 6: Commit**

```bash
git add src/layouts src/components/Header.astro src/components/Footer.astro src/pages/index.astro
git commit -m "Add BaseLayout, Header, and Footer wired to site settings"
```

---

### Task 5: Home page

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 4), `src/data/home.json` (Task 3),
  `getCollection('news' | 'events')` (Task 2).
- Produces: final home page content — no other task depends on this file.

- [ ] **Step 1: Replace `src/pages/index.astro` with the full home page**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import home from '../data/home.json';

const news = (await getCollection('news'))
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  .slice(0, 3);

const now = new Date();
const events = (await getCollection('events'))
  .filter((e) => e.data.date >= now)
  .sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf())
  .slice(0, 3);
---
<BaseLayout title={home.heroHeading}>
  <section class="bg-navy text-paper px-6 py-20 text-center">
    <h1 class="text-5xl font-semibold uppercase tracking-wide">{home.heroHeading}</h1>
    <p class="mx-auto mt-4 max-w-2xl text-lg">{home.heroSubheading}</p>
    <a
      href={home.heroCtaUrl}
      class="mt-8 inline-block bg-powder px-6 py-3 font-semibold uppercase tracking-wide text-ink hover:bg-white"
    >
      {home.heroCtaLabel}
    </a>
  </section>

  <section class="mx-auto max-w-3xl px-6 py-12 text-center">
    <p>{home.introBody}</p>
  </section>

  <section class="mx-auto max-w-5xl px-6 py-12">
    <h2 class="mb-6 text-3xl uppercase tracking-wide">Latest News</h2>
    <ul class="grid gap-6 sm:grid-cols-3">
      {news.map((post) => (
        <li class="border border-navy/20 p-4">
          <a href={`/news/${post.id}`} class="font-[family-name:--font-heading] text-xl">{post.data.title}</a>
          <p class="mt-2 text-sm">{post.data.excerpt}</p>
        </li>
      ))}
    </ul>
  </section>

  <section class="mx-auto max-w-5xl px-6 py-12">
    <h2 class="mb-6 text-3xl uppercase tracking-wide">Upcoming Events</h2>
    <ul class="grid gap-6 sm:grid-cols-3">
      {events.map((event) => (
        <li class="border border-navy/20 p-4">
          <a href={`/events/${event.id}`} class="font-[family-name:--font-heading] text-xl">{event.data.title}</a>
          <p class="mt-2 text-sm">{event.data.location}</p>
        </li>
      ))}
    </ul>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: exits 0.

Run: `grep -o "Run With Eton Manor" dist/index.html`
Expected: prints `Run With Eton Manor`.

Run: `grep -c "Welcoming In The New Season\|Club Championship 5K: Results Are In\|Introducing Our Expanded Coaching Team" dist/index.html`
Expected: a count of at least 1 (at least one seeded news title present —
all three are expected since only 3 exist and we slice 3).

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "Build home page with hero, intro, news and events teasers"
```

---

### Task 6: About page

**Files:**
- Create: `src/pages/about.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 4), `src/data/about.json` (Task 3).
- Produces: `/about` route — no other task depends on this file.

- [ ] **Step 1: Write `src/pages/about.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import about from '../data/about.json';

const paragraphs = about.body.split('\n\n');
---
<BaseLayout title={`${about.heading} — Eton Manor Running Club`}>
  <section class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="mb-6 text-4xl uppercase tracking-wide">{about.heading}</h1>
    {paragraphs.map((paragraph) => (
      <p class="mb-4">{paragraph}</p>
    ))}
  </section>
</BaseLayout>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/about/index.html` exists.

Run: `grep -o "About Eton Manor" dist/about/index.html`
Expected: prints `About Eton Manor`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "Add about page"
```

---

### Task 7: Team page and TeamCard

**Files:**
- Create: `src/components/TeamCard.astro`
- Create: `src/pages/team.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 4), `getCollection('team')` (Task 2).
- Produces: `TeamCard.astro` accepting props `{ name: string, role: string
  }` — no other task depends on this file.

- [ ] **Step 1: Write `src/components/TeamCard.astro`**

```astro
---
interface Props {
  name: string;
  role: string;
}

const { name, role } = Astro.props;
---
<div class="border border-navy/20 p-6 text-center">
  <h3 class="text-2xl uppercase tracking-wide">{name}</h3>
  <p class="mt-1 text-sm uppercase tracking-wide text-navy">{role}</p>
</div>
```

- [ ] **Step 2: Write `src/pages/team.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import TeamCard from '../components/TeamCard.astro';

const team = await getCollection('team');
---
<BaseLayout title="Meet the Team — Eton Manor Running Club">
  <section class="mx-auto max-w-5xl px-6 py-16">
    <h1 class="mb-8 text-4xl uppercase tracking-wide">Meet the Team</h1>
    <div class="grid gap-6 sm:grid-cols-3">
      {team.map((member) => (
        <TeamCard name={member.data.name} role={member.data.role} />
      ))}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/team/index.html` exists.

Run: `grep -o "Jane Whitfield" dist/team/index.html`
Expected: prints `Jane Whitfield`.

- [ ] **Step 4: Commit**

```bash
git add src/components/TeamCard.astro src/pages/team.astro
git commit -m "Add team page and TeamCard component"
```

---

### Task 8: Events pages (list + detail) and EventCard

**Files:**
- Create: `src/components/EventCard.astro`
- Create: `src/pages/events/index.astro`
- Create: `src/pages/events/[slug].astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 4), `getCollection('events')` and `render`
  from `astro:content` (Task 2).
- Produces: `EventCard.astro` accepting props `{ title: string, date: Date,
  time?: string, location: string, eventType: string, href: string }` — no
  other task depends on this file.

- [ ] **Step 1: Write `src/components/EventCard.astro`**

```astro
---
interface Props {
  title: string;
  date: Date;
  time?: string;
  location: string;
  eventType: string;
  href: string;
}

const { title, date, time, location, eventType, href } = Astro.props;
const formattedDate = date.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
---
<a href={href} class="block border border-navy/20 p-4 hover:border-navy">
  <span class="text-xs font-semibold uppercase tracking-wide text-navy">{eventType}</span>
  <h3 class="font-[family-name:--font-heading] text-xl">{title}</h3>
  <p class="mt-1 text-sm">{formattedDate}{time ? ` · ${time}` : ''}</p>
  <p class="text-sm">{location}</p>
</a>
```

- [ ] **Step 2: Write `src/pages/events/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import EventCard from '../../components/EventCard.astro';

const allEvents = await getCollection('events');
const now = new Date();
const upcoming = allEvents
  .filter((e) => e.data.date >= now)
  .sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
const past = allEvents
  .filter((e) => e.data.date < now)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---
<BaseLayout title="Events — Eton Manor Running Club">
  <section class="mx-auto max-w-5xl px-6 py-16">
    <h1 class="mb-8 text-4xl uppercase tracking-wide">Upcoming Events</h1>
    <div class="grid gap-6 sm:grid-cols-3">
      {upcoming.map((event) => (
        <EventCard
          title={event.data.title}
          date={event.data.date}
          time={event.data.time}
          location={event.data.location}
          eventType={event.data.eventType}
          href={`/events/${event.id}`}
        />
      ))}
    </div>

    <h2 class="mb-8 mt-16 text-3xl uppercase tracking-wide">Past Events</h2>
    <div class="grid gap-6 sm:grid-cols-3">
      {past.map((event) => (
        <EventCard
          title={event.data.title}
          date={event.data.date}
          time={event.data.time}
          location={event.data.location}
          eventType={event.data.eventType}
          href={`/events/${event.id}`}
        />
      ))}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 3: Write `src/pages/events/[slug].astro`**

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const events = await getCollection('events');
  return events.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
const formattedDate = entry.data.date.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
---
<BaseLayout title={`${entry.data.title} — Eton Manor Running Club`}>
  <article class="mx-auto max-w-3xl px-6 py-16">
    <span class="text-xs font-semibold uppercase tracking-wide text-navy">{entry.data.eventType}</span>
    <h1 class="mb-2 text-4xl uppercase tracking-wide">{entry.data.title}</h1>
    <p class="mb-1 text-sm">{formattedDate}{entry.data.time ? ` · ${entry.data.time}` : ''}</p>
    <p class="mb-6 text-sm">{entry.data.location}</p>
    <div class="prose">
      <Content />
    </div>
    {entry.data.externalLink && (
      <a href={entry.data.externalLink} class="mt-6 inline-block bg-navy px-6 py-3 font-semibold uppercase text-paper hover:bg-navy/80">
        Event Details
      </a>
    )}
  </article>
</BaseLayout>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/events/index.html` and
`dist/events/london-10k/index.html` exist.

Run: `grep -c "Summer Handicap Race\|Autumn Social Club Run\|London Borough 10K" dist/events/index.html`
Expected: a count of 3 (all three seeded events appear across the
upcoming/past sections).

Run: `grep -o "Club-organised group entry" dist/events/london-10k/index.html`
Expected: prints `Club-organised group entry` (confirms the markdown body
rendered on the detail page).

- [ ] **Step 5: Commit**

```bash
git add src/components/EventCard.astro src/pages/events
git commit -m "Add events list and detail pages with EventCard"
```

---

### Task 9: News pages (list + detail) and PostCard

**Files:**
- Create: `src/components/PostCard.astro`
- Create: `src/pages/news/index.astro`
- Create: `src/pages/news/[slug].astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 4), `getCollection('news')` and `render`
  from `astro:content` (Task 2).
- Produces: `PostCard.astro` accepting props `{ title: string, date: Date,
  excerpt: string, href: string }` — no other task depends on this file.

- [ ] **Step 1: Write `src/components/PostCard.astro`**

```astro
---
interface Props {
  title: string;
  date: Date;
  excerpt: string;
  href: string;
}

const { title, date, excerpt, href } = Astro.props;
const formattedDate = date.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
---
<a href={href} class="block border border-navy/20 p-4 hover:border-navy">
  <p class="text-xs font-semibold uppercase tracking-wide text-navy">{formattedDate}</p>
  <h3 class="font-[family-name:--font-heading] text-xl">{title}</h3>
  <p class="mt-1 text-sm">{excerpt}</p>
</a>
```

- [ ] **Step 2: Write `src/pages/news/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostCard from '../../components/PostCard.astro';

const posts = (await getCollection('news')).sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
);
---
<BaseLayout title="News — Eton Manor Running Club">
  <section class="mx-auto max-w-5xl px-6 py-16">
    <h1 class="mb-8 text-4xl uppercase tracking-wide">Club News</h1>
    <div class="grid gap-6 sm:grid-cols-3">
      {posts.map((post) => (
        <PostCard
          title={post.data.title}
          date={post.data.date}
          excerpt={post.data.excerpt}
          href={`/news/${post.id}`}
        />
      ))}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 3: Write `src/pages/news/[slug].astro`**

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('news');
  return posts.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
const formattedDate = entry.data.date.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
---
<BaseLayout title={`${entry.data.title} — Eton Manor Running Club`}>
  <article class="mx-auto max-w-3xl px-6 py-16">
    <p class="mb-1 text-sm">{formattedDate}</p>
    <h1 class="mb-6 text-4xl uppercase tracking-wide">{entry.data.title}</h1>
    <div class="prose">
      <Content />
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/news/index.html` and
`dist/news/welcome-new-season/index.html` exist.

Run: `grep -c "Welcoming In The New Season\|Club Championship 5K: Results Are In\|Introducing Our Expanded Coaching Team" dist/news/index.html`
Expected: a count of 3.

Run: `grep -o "no booking required" dist/news/welcome-new-season/index.html`
Expected: prints `no booking required` (confirms markdown body rendered).

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCard.astro src/pages/news
git commit -m "Add news list and detail pages with PostCard"
```

---

### Task 10: Contact page with Netlify Forms

**Files:**
- Create: `src/pages/contact.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 4), `src/data/contact.json` and
  `src/data/settings.json` (Task 3).
- Produces: `/contact` route — no other task depends on this file.

- [ ] **Step 1: Write `src/pages/contact.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import contact from '../data/contact.json';
import settings from '../data/settings.json';
---
<BaseLayout title="Contact — Eton Manor Running Club">
  <section class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="mb-4 text-4xl uppercase tracking-wide">Get In Touch</h1>
    <p class="mb-2">{contact.intro}</p>
    <p class="mb-6 text-sm">{contact.meetingPoint}</p>

    <a
      href={contact.joinCtaUrl}
      class="mb-10 inline-block bg-navy px-6 py-3 font-semibold uppercase tracking-wide text-paper hover:bg-navy/80"
    >
      {contact.joinCtaLabel}
    </a>

    <form name="contact" method="POST" data-netlify="true" class="grid gap-4">
      <input type="hidden" name="form-name" value="contact" />
      <label class="grid gap-1">
        <span class="text-sm font-semibold uppercase tracking-wide">Name</span>
        <input type="text" name="name" required class="border border-navy/40 px-3 py-2" />
      </label>
      <label class="grid gap-1">
        <span class="text-sm font-semibold uppercase tracking-wide">Email</span>
        <input type="email" name="email" required class="border border-navy/40 px-3 py-2" />
      </label>
      <label class="grid gap-1">
        <span class="text-sm font-semibold uppercase tracking-wide">Message</span>
        <textarea name="message" rows="5" required class="border border-navy/40 px-3 py-2"></textarea>
      </label>
      <button type="submit" class="justify-self-start bg-navy px-6 py-3 font-semibold uppercase tracking-wide text-paper hover:bg-navy/80">
        Send Message
      </button>
    </form>

    <ul class="mt-10 flex gap-4 text-sm">
      {settings.socials.map((social) => (
        <li><a href={social.url} class="hover:text-navy">{social.platform}</a></li>
      ))}
    </ul>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/contact/index.html` exists.

Run: `grep -o 'data-netlify="true"' dist/contact/index.html`
Expected: prints `data-netlify="true"`.

Run: `grep -o "Join the Club" dist/contact/index.html`
Expected: prints `Join the Club`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/contact.astro
git commit -m "Add contact page with Netlify Forms and join CTA"
```

---

### Task 11: Sveltia CMS admin

**Files:**
- Create: `public/admin/index.html`
- Create: `public/admin/config.yml`
- Create: `public/uploads/.gitkeep`

**Interfaces:**
- Consumes: field names/shapes from Task 2 (news/events/team schemas) and
  Task 3 (home/about/contact/settings JSON shapes) — the CMS config must
  match them exactly so CMS-produced edits stay valid against the Zod
  schemas.
- Produces: `/admin` route serving the Sveltia CMS UI — no other task
  depends on these files.

- [ ] **Step 1: Write `public/admin/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Manager — Eton Manor Running Club</title>
  </head>
  <body>
    <script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js" type="module"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `public/admin/config.yml`**

```yaml
backend:
  name: git-gateway
  branch: main

media_folder: "public/uploads"
public_folder: "/uploads"

collections:
  - name: "news"
    label: "News"
    folder: "src/content/news"
    create: true
    slug: "{{slug}}"
    fields:
      - { label: "Title", name: "title", widget: "string" }
      - { label: "Date", name: "date", widget: "datetime" }
      - { label: "Excerpt", name: "excerpt", widget: "text" }
      - { label: "Body", name: "body", widget: "markdown", body: true }

  - name: "events"
    label: "Events"
    folder: "src/content/events"
    create: true
    slug: "{{slug}}"
    fields:
      - { label: "Title", name: "title", widget: "string" }
      - { label: "Date", name: "date", widget: "datetime" }
      - { label: "Time", name: "time", widget: "string", required: false }
      - { label: "Location", name: "location", widget: "string" }
      - label: "Event Type"
        name: "eventType"
        widget: "select"
        options: ["Club Run", "Race", "Social"]
      - { label: "External Link", name: "externalLink", widget: "string", required: false }
      - { label: "Description", name: "body", widget: "markdown", body: true }

  - name: "team"
    label: "Team"
    folder: "src/content/team"
    create: true
    slug: "{{slug}}"
    fields:
      - { label: "Name", name: "name", widget: "string" }
      - { label: "Role", name: "role", widget: "string" }
      - { label: "Bio", name: "body", widget: "markdown", body: true, required: false }

  - name: "pages"
    label: "Pages"
    files:
      - name: "home"
        label: "Home Page"
        file: "src/data/home.json"
        fields:
          - { label: "Hero Heading", name: "heroHeading", widget: "string" }
          - { label: "Hero Subheading", name: "heroSubheading", widget: "text" }
          - { label: "Hero Button Label", name: "heroCtaLabel", widget: "string" }
          - { label: "Hero Button Link", name: "heroCtaUrl", widget: "string" }
          - { label: "Intro Text", name: "introBody", widget: "text" }
      - name: "about"
        label: "About Page"
        file: "src/data/about.json"
        fields:
          - { label: "Heading", name: "heading", widget: "string" }
          - { label: "Body", name: "body", widget: "text" }
      - name: "contact"
        label: "Contact Page"
        file: "src/data/contact.json"
        fields:
          - { label: "Intro Text", name: "intro", widget: "text" }
          - { label: "Meeting Point", name: "meetingPoint", widget: "text" }
          - { label: "Join Button Label", name: "joinCtaLabel", widget: "string" }
          - { label: "Join Button Link", name: "joinCtaUrl", widget: "string" }
      - name: "settings"
        label: "Site Settings"
        file: "src/data/settings.json"
        fields:
          - { label: "Site Title", name: "siteTitle", widget: "string" }
          - label: "Navigation Links"
            name: "navLinks"
            widget: "list"
            fields:
              - { label: "Label", name: "label", widget: "string" }
              - { label: "URL", name: "url", widget: "string" }
          - { label: "Footer Text", name: "footerText", widget: "string" }
          - label: "Social Links"
            name: "socials"
            widget: "list"
            fields:
              - label: "Platform"
                name: "platform"
                widget: "select"
                options: ["Instagram", "Facebook", "Strava", "X"]
              - { label: "URL", name: "url", widget: "string" }
```

- [ ] **Step 3: Add a `.gitkeep` for the uploads folder**

```
```
(empty file at `public/uploads/.gitkeep`, since git does not track empty
directories)

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: exits 0, `dist/admin/index.html` and `dist/admin/config.yml`
exist (Astro copies `public/` verbatim into `dist/`).

Run: `grep -o "git-gateway" dist/admin/config.yml`
Expected: prints `git-gateway`.

Run: `grep -o "sveltia-cms.js" dist/admin/index.html`
Expected: prints `sveltia-cms.js`.

- [ ] **Step 5: Commit**

```bash
git add public/admin public/uploads
git commit -m "Add Sveltia CMS admin config for all collections and singletons"
```

---

### Task 12: Netlify config, README, full-site verification

**Files:**
- Create: `netlify.toml`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing new — this task is a final wrap-up and full-site
  smoke test of every route produced by Tasks 1–11.
- Produces: deploy config and setup docs — nothing else depends on this
  task.

- [ ] **Step 1: Write `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

- [ ] **Step 2: Write `README.md`**

```markdown
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

## Editing content via Sveltia CMS

The CMS admin UI is served at `/admin` (`public/admin/index.html` +
`config.yml`), backed by git-gateway. Before it can authenticate editors,
enable **Identity** and **Git Gateway** for this site in the Netlify
dashboard (Site configuration → Identity → Enable, then Identity →
Services → Git Gateway → Enable). This is a one-time, manual step in the
Netlify UI — it cannot be scripted from the repo.

## Deployment

Connect this repository to Netlify. `netlify.toml` sets the build command
(`npm run build`) and publish directory (`dist`). The contact form on
`/contact` uses Netlify Forms and requires no extra configuration beyond
the standard Netlify deploy.
```

- [ ] **Step 3: Full build and route-by-route verification**

Run: `npm run build`
Expected: exits 0.

Run:
```bash
for f in dist/index.html dist/about/index.html dist/team/index.html dist/events/index.html dist/news/index.html dist/contact/index.html dist/admin/index.html; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```
Expected: every line printed as `OK: <path>`, none as `MISSING`.

Run: `npm run preview &` then fetch `http://localhost:4321/` (or the port
`astro preview` prints) with `curl -s http://localhost:4321/ | grep -o "Run With Eton Manor"`, then stop the preview server.
Expected: prints `Run With Eton Manor`, confirming the built site serves
correctly end to end.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml README.md
git commit -m "Add Netlify build config and README with CMS setup notes"
```

---

## Self-Review Notes

- **Spec coverage:** stack/theme (Task 1), news/events/team collections
  (Task 2), home/about/contact/settings singletons (Task 3),
  Header/Footer/BaseLayout from settings (Task 4), Home/About/Team/Events/
  News/Contact pages (Tasks 5–10), Sveltia CMS config matching every
  collection and singleton 1:1 (Task 11), Netlify build config + README
  documenting the manual Identity/Git Gateway step (Task 12) — every spec
  section maps to a task.
- **Placeholder scan:** no TBD/TODO markers; every step has runnable
  commands or full file contents.
- **Type consistency:** `EventCard` props (`title, date, time?, location,
  eventType, href`) match how Task 8's `events/index.astro` and
  `events/[slug].astro` call it; `PostCard` props match Task 9's usage;
  `entry.id` is used consistently as the route slug across Tasks 5, 8, 9;
  `getCollection`/`render` imports from `astro:content` match the loader-
  based collections defined in Task 2.
