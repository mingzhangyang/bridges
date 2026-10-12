import { manifest } from '../content/daily-manifest.js';
export function shanghaiDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function dailyEntry(now = new Date()) {
  return manifest.find((d) => d.date === shanghaiDate(now)) ?? null;
}
export const dailyKey = (entry, type = 'walk') => `daily:${entry.date}:${entry.revision}:${type}`;
