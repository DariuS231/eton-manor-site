export type StravaEmbedType = 'route' | 'activity';

// Matches the public web links Strava gives for routes and activities, e.g.
// https://www.strava.com/routes/3344556677889900 or https://strava.com/activities/123?share=1
export const STRAVA_URL_PATTERN = /^https?:\/\/(?:www\.)?strava\.com\/(routes|activities)\/(\d+)(?:[/?#].*)?$/;

export function parseStravaUrl(url: string): { type: StravaEmbedType; id: string } | null {
  const match = url.trim().match(STRAVA_URL_PATTERN);
  if (!match) return null;
  return { type: match[1] === 'routes' ? 'route' : 'activity', id: match[2] };
}
