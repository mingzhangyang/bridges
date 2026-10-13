import { manifest } from '../content/daily-manifest.js';
export function shanghaiDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
// The manifest is append-only: revising a day adds a higher revision and keeps the published
// entry, so challenges players already started stay resolvable. Today's challenge is the
// newest revision for today.
export function latestEntry(date, entries = manifest) {
  return entries
    .filter((e) => e.date === date)
    .reduce((best, e) => (!best || e.revision > best.revision ? e : best), null);
}
export function dailyEntry(now = new Date(), entries = manifest) {
  return latestEntry(shanghaiDate(now), entries);
}
export const dailyKey = (entry, type = 'walk') => `daily:${entry.date}:${entry.revision}:${type}`;
export const dailyHash = (entry, type = 'walk') => `daily/${entry.date}/${entry.revision}/${type}`;
