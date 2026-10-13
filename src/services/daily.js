import { manifest } from '../content/daily-manifest.js';
export function shanghaiDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
// The manifest is append-only: revising a day adds a higher revision and keeps the published
// entry, so challenges players already started stay resolvable. Today's challenge is the
// newest revision for today.
export function entriesFor(date, entries = manifest) {
  return entries.filter((e) => e.date === date).sort((a, b) => b.revision - a.revision);
}
export function latestEntry(date, entries = manifest) {
  return entriesFor(date, entries)[0] ?? null;
}
export function dailyEntry(now = new Date(), entries = manifest) {
  return latestEntry(shanghaiDate(now), entries);
}
export const dailyKey = (entry, type = 'walk') => `daily:${entry.date}:${entry.revision}:${type}`;
export const dailyHash = (entry, type = 'walk') => `daily/${entry.date}/${entry.revision}/${type}`;
