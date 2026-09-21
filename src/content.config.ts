import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Sveltia's select widget writes '' (not null/undefined) for a blank optional field.
const focalPointField = () =>
  z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.enum(['top', 'center', 'bottom']).nullish()
  );

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageFocalPoint: focalPointField(),
    gallery: z.array(z.string()).optional(),
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
    externalLink: z.union([z.string().url(), z.literal('')]).optional(),
    heroImage: z.string().optional(),
    heroImageFocalPoint: focalPointField(),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/team' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    photo: z.string().optional(),
    photoFocalPoint: focalPointField(),
    order: z.number().nullish(),
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

const contentPages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/content-pages' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageFocalPoint: focalPointField(),
    gallery: z.array(z.string()).optional(),
  }),
});

const documents = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/documents' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    file: z.string(),
  }),
});

const meetingMinutes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/meeting-minutes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    file: z.string(),
  }),
});

const fixtures = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/fixtures' }),
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    distance: z.enum(['5K', '5 Miles', '10K', '10 Miles', 'Half Marathon', 'Marathon', 'Ultra']),
  }),
});

const results = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/results' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    links: z.array(
      z.object({
        label: z.string(),
        file: z.string(),
      })
    ),
  }),
});

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

export const collections = {
  news,
  events,
  team,
  sponsors,
  contentPages,
  documents,
  meetingMinutes,
  fixtures,
  results,
  kit,
};
