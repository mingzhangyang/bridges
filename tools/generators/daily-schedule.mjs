// Append-only schedule. Published entries, including older revisions of a revised day, are kept
// verbatim so challenges players already started stay resolvable; only missing dates are added.
// Builds never use random or the current date.
export function extendSchedule(existing, { walks, commissions, start = '2026-10-12', days = 366 }) {
  const rows = [...existing],
    dates = new Set(existing.map((e) => e.date));
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000),
      iso = date.toISOString().slice(0, 10),
      day = date.getUTCDay();
    if (dates.has(iso)) continue;
    rows.push({
      date: iso,
      revision: 1,
      walk: walks[(i * 7 + Math.floor(i / 7)) % walks.length].id,
      repair: day === 0 || day === 6 ? commissions[(Math.floor(i / 7) + day) % 8].id : null,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.revision - b.revision);
}
