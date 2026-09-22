import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GITHUB_OWNER = 'DariuS231';
const GITHUB_REPO = 'eton-manor-site';
const GITHUB_BRANCH = 'main';
const EVENTS_DIR = 'src/content/events';
const GITHUB_API = 'https://api.github.com';
const SPOND_API = 'https://api.spond.com/core/v1/';
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export class SpondAuthenticationError extends Error {}

// spond-api (npm) and other unofficial clients drifted from Spond's current API;
// this mirrors the actively-maintained Olen/Spond (Python) implementation instead.
export async function spondLogin(email, password) {
  const res = await fetch(`${SPOND_API}auth2/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await res.json();
  const token = result?.accessToken?.token;
  if (!token) {
    throw new SpondAuthenticationError(`Spond login failed. Response received: ${JSON.stringify(result)}`);
  }
  return token;
}

export async function spondGetEvents(token, { groupId, minStart, maxEvents = 100, includeScheduled = false } = {}) {
  const url = new URL(`${SPOND_API}sponds/`);
  url.searchParams.set('max', String(maxEvents));
  url.searchParams.set('scheduled', String(includeScheduled));
  if (groupId) url.searchParams.set('groupId', groupId);
  if (minStart) url.searchParams.set('minStartTimestamp', minStart.toISOString());

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spond events fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const RACE_KEYWORDS = ['race', 'marathon', '5k', '10k', 'handicap', 'parkrun', 'championship', 'relay', 'time trial'];
const SOCIAL_KEYWORDS = ['social', 'party', 'quiz', 'christmas', 'bbq', 'dinner', 'drinks', 'awards', 'agm'];

export function inferEventType(title) {
  const lower = title.toLowerCase();
  if (RACE_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'Race';
  if (SOCIAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'Social';
  return 'Club Run';
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

export function formatLondonTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  }).format(date);
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

export function buildEventFile(spondEvent) {
  const start = new Date(spondEvent.startTimestamp);
  if (Number.isNaN(start.valueOf())) {
    throw new Error(`Spond event ${spondEvent.id} has an invalid startTimestamp`);
  }

  const title = (spondEvent.heading || 'Untitled Event').trim();
  const location = spondEvent.location?.feature || spondEvent.location?.address || 'TBC';
  const description = (spondEvent.description || '').trim();
  const slug = `spond-${slugify(title).slice(0, 40)}-${spondEvent.id.slice(0, 8)}`;

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `date: ${yamlString(start.toISOString())}`,
    `time: ${yamlString(formatLondonTime(start))}`,
    `location: ${yamlString(location)}`,
    `eventType: ${yamlString(inferEventType(title))}`,
    `spondId: ${yamlString(spondEvent.id)}`,
    '---',
    '',
    description,
    '',
  ].join('\n');

  return { slug, path: `${EVENTS_DIR}/${slug}.md`, content: frontmatter };
}

async function githubRequest(endpoint, token, options = {}) {
  const res = await fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  return res;
}

async function getExistingFile(filePath, token) {
  const res = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
    token
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub GET ${filePath} failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf-8') };
}

async function upsertFile(filePath, content, token, sha) {
  const res = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: sha ? `chore: update synced Spond event (${filePath})` : `chore: add synced Spond event (${filePath})`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub PUT ${filePath} failed: ${res.status} ${await res.text()}`);
  }
}

async function getLocalFile(filePath) {
  try {
    const content = await readFile(path.join(PROJECT_ROOT, filePath), 'utf-8');
    return { content };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function upsertLocalFile(filePath, content) {
  const absPath = path.join(PROJECT_ROOT, filePath);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, content, 'utf-8');
}

export default async () => {
  const { SPOND_EMAIL, SPOND_PASSWORD, SPOND_GROUP_ID, GITHUB_TOKEN } = process.env;
  const missing = ['SPOND_EMAIL', 'SPOND_PASSWORD', 'SPOND_GROUP_ID'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`sync-spond-events: missing required env vars: ${missing.join(', ')}`);
    return new Response(JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const useGithub = Boolean(GITHUB_TOKEN);
  if (!useGithub) {
    console.warn(
      'sync-spond-events: GITHUB_TOKEN not set — writing events to local files instead of committing to GitHub. ' +
        'This only makes sense in local dev (netlify dev); in a deployed function the filesystem is ephemeral and changes will be lost.'
    );
  }

  const summary = { mode: useGithub ? 'github' : 'local', created: 0, updated: 0, unchanged: 0, errors: [] };

  let events;
  try {
    const token = await spondLogin(SPOND_EMAIL, SPOND_PASSWORD);
    events = await spondGetEvents(token, { groupId: SPOND_GROUP_ID, minStart: new Date(), maxEvents: 100 });
  } catch (err) {
    console.error('sync-spond-events: failed to fetch events from Spond:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch events from Spond.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const spondEvent of events) {
    try {
      const file = buildEventFile(spondEvent);
      const existing = useGithub ? await getExistingFile(file.path, GITHUB_TOKEN) : await getLocalFile(file.path);

      if (existing && existing.content === file.content) {
        summary.unchanged += 1;
        continue;
      }

      if (useGithub) {
        await upsertFile(file.path, file.content, GITHUB_TOKEN, existing?.sha);
      } else {
        await upsertLocalFile(file.path, file.content);
      }
      if (existing) {
        summary.updated += 1;
      } else {
        summary.created += 1;
      }
    } catch (err) {
      console.error(`sync-spond-events: failed to sync event ${spondEvent.id}:`, err);
      summary.errors.push({ id: spondEvent.id, message: err.message });
    }
  }

  console.log('sync-spond-events summary:', summary);
  return new Response(JSON.stringify(summary), {
    status: summary.errors.length > 0 ? 207 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { schedule: '@hourly' };
