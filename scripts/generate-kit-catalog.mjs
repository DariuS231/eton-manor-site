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
