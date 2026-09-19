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
