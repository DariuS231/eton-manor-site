# Eton Manor Running Club Site — Design Spec

Date: 2026-09-19

## Overview

A marketing/content site for the Eton Manor running club, built with Astro
and Tailwind CSS v4, editable by non-technical club members through Sveltia
CMS (a git-backed, static admin UI). Content lives as Markdown/JSON files in
the repo; edits made in the CMS commit directly to `main` and trigger a
Netlify rebuild.

## Stack

- **Astro**, static output (`output: 'static'`) — no server runtime needed.
- **Tailwind CSS v4** via `@tailwindcss/vite`, theme tokens defined in
  `src/styles/global.css`:

  ```css
  @theme {
    --color-navy: #004681;
    --color-powder: #8fc3ea;
    --color-ink: #14181f;
    --color-paper: #faf7f0;

    --font-heading: "Barlow Condensed", sans-serif;
    --font-body: "Work Sans", sans-serif;
  }
  ```

  Fonts self-hosted via `@fontsource/barlow-condensed` and
  `@fontsource/work-sans` (no runtime dependency on Google Fonts CDN).
- **Sveltia CMS**, loaded as a static ES module bundle at
  `public/admin/index.html` (no npm dependency), configured via
  `public/admin/config.yml`.
- **Deployment**: Netlify. Auth backend: `git-gateway` + Netlify Identity
  (enabled in the Netlify dashboard post-deploy — this is a manual step, not
  scriptable from the repo).
- **Forms**: Netlify Forms for the contact form (static HTML form with
  `data-netlify="true"`, no JS/serverless function needed).

## Project structure

```
src/
  content/
    news/        (collection: markdown posts)
    events/      (collection: markdown events)
    team/        (collection: markdown team members)
    config.ts    (defineCollection schemas, Zod)
  data/
    home.json
    about.json
    contact.json
    settings.json
  layouts/
    BaseLayout.astro
  components/
    Header.astro
    Footer.astro
    EventCard.astro
    PostCard.astro
    TeamCard.astro
  pages/
    index.astro
    about.astro
    team.astro
    contact.astro
    events/index.astro
    events/[slug].astro
    news/index.astro
    news/[slug].astro
  styles/
    global.css
public/
  admin/
    index.html
    config.yml
  uploads/        (CMS media library target)
astro.config.mjs
```

## Content model

### Collections (folder-based, one file per entry, CMS "folder collection")

**News** — `src/content/news/*.md`
- `title: string`
- `date: date`
- `excerpt: string`
- `cover: image` (optional)
- `body: markdown`

Rendered at `/news` (reverse-chronological list) and `/news/[slug]`.

**Events** — `src/content/events/*.md`
- `title: string`
- `date: date`
- `time: string` (optional, free text e.g. "9:00am")
- `location: string`
- `eventType: enum("Club Run", "Race", "Social")`
- `description: markdown`
- `externalLink: string` (optional URL, e.g. race entry page)

Rendered at `/events` (split into upcoming/past based on `date`, sorted) and
`/events/[slug]`.

**Team** — `src/content/team/*.md`
- `name: string`
- `role: string` (e.g. "Chair", "Coach")
- `photo: image` (optional)
- `bio: markdown` (optional)

Rendered as cards on `/team`.

### Singletons (file-based, one JSON file each, CMS "file collection")

**`src/data/home.json`**
- `heroHeading: string`
- `heroSubheading: string`
- `heroCtaLabel: string`
- `heroCtaUrl: string`
- `introBody: string`

**`src/data/about.json`**
- `heading: string`
- `body: markdown`

**`src/data/contact.json`**
- `intro: string`
- `meetingPoint: string`
- `joinCtaLabel: string`
- `joinCtaUrl: string` (external membership signup link)

**`src/data/settings.json`**
- `siteTitle: string`
- `logo: image` (optional)
- `navLinks: [{ label: string, url: string }]`
- `footerText: string`
- `socials: [{ platform: enum(Instagram, Facebook, Strava, X), url: string }]`

Social links and nav are edited once in Settings and reused across
Header/Footer/Contact — not duplicated per-page.

## CMS configuration

`public/admin/config.yml`:
- `backend: { name: git-gateway, branch: main }`
- `media_folder: "public/uploads"`, `public_folder: "/uploads"`
- 3 folder collections (news, events, team) with fields matching the schemas
  above 1:1, typed so CMS edits can't produce data the Astro Zod schemas
  reject.
- 4 file collections (home, about, contact, settings) each pointing at its
  JSON file in `src/data/`.

`public/admin/index.html` loads Sveltia CMS via a pinned CDN module script
and the config.yml above; no local npm package required.

## Pages

- **Home** (`/`) — hero (heading/subheading/CTA from `home.json`), intro
  blurb, teaser of latest 3 news posts, teaser of next 2-3 upcoming events.
- **About** (`/about`) — club history/mission from `about.json`.
- **Team** (`/team`) — grid of team-collection cards.
- **Events** (`/events`, `/events/[slug]`) — upcoming/past split list, detail
  page per event.
- **News** (`/news`, `/news/[slug]`) — reverse-chron list, detail page per
  post.
- **Contact** (`/contact`) — intro + meeting point from `contact.json`,
  "Join the Club" external CTA, Netlify Forms contact form (name, email,
  message), socials pulled from `settings.json`.
- **Header/Footer** (global, in `BaseLayout.astro`) — nav links, site
  title/logo, footer text and socials from `settings.json`.

## Styling approach

Design around the actual palette rather than generic Tailwind grays: navy
for headers/primary UI, powder as an accent, paper as the page background,
ink for body text. Barlow Condensed for headings (club/sporting feel), Work
Sans for body copy.

## Testing / verification

- `npm run build` must succeed — this validates all content against the
  Zod schemas in `src/content/config.ts`.
- Seed each collection with 2-3 realistic sample entries (news posts,
  events, team members) plus filled-in singleton JSON files, so the build
  renders real content immediately rather than empty pages.
- Manual check: run `astro dev`, visually confirm each page renders with
  the correct theme colors/fonts, nav/footer populate from settings, and
  `/admin` loads the Sveltia CMS UI (auth against git-gateway won't fully
  work until Netlify Identity is enabled post-deploy, but the CMS UI and
  config should load without errors).
- No unit test framework — this is a static content site; build success +
  visual dev-server check is the verification bar.

## Out of scope / follow-ups

- Enabling Netlify Identity + Git Gateway in the Netlify dashboard (manual,
  post-first-deploy step, not scriptable here).
- Actual Netlify site creation/connection (user will need to connect the
  repo to Netlify).
- Any custom OAuth backend (not needed since we're using git-gateway).
