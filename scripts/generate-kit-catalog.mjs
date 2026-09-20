import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const KIT_DIR = 'src/content/kit';
const OUTPUT_PATH = 'netlify/functions/kit-catalog.json';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function generateCatalog() {
  if (!existsSync(KIT_DIR)) {
    return [];
  }

  const files = readdirSync(KIT_DIR).filter((file) => file.endsWith('.md'));

  return files.map((file) => {
    const id = file.replace(/\.md$/, '');
    if (!ID_PATTERN.test(id)) {
      throw new Error(
        `Kit item filename "${file}" is not a valid slug (lowercase letters, digits, and hyphens only). ` +
          `Astro's content collection id generation may not match this catalog's id derivation otherwise — rename the file.`,
      );
    }

    const raw = readFileSync(join(KIT_DIR, file), 'utf-8');
    const { data } = matter(raw);

    if (typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error(`Kit item "${file}" is missing a valid name.`);
    }
    if (typeof data.priceGBP !== 'number' || !Number.isFinite(data.priceGBP) || data.priceGBP <= 0) {
      throw new Error(`Kit item "${file}" has an invalid priceGBP (must be a positive number).`);
    }
    if (data.sizes !== undefined && !Array.isArray(data.sizes)) {
      throw new Error(`Kit item "${file}" has a "sizes" field that isn't a list.`);
    }

    return {
      id,
      name: data.name,
      priceGBP: data.priceGBP,
      sizes: data.sizes ?? [],
    };
  });
}

const catalog = generateCatalog();

mkdirSync('netlify/functions', { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2) + '\n');

console.log(`Generated ${OUTPUT_PATH} with ${catalog.length} kit item(s).`);
