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

const sponsors = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/sponsors' }),
  schema: z.object({
    name: z.string(),
    url: z.string().url(),
    logo: z.string(),
  }),
});

export const collections = { news, events, team, sponsors };
