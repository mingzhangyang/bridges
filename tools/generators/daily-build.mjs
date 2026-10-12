import { writeFile } from 'node:fs/promises';
import { levels, commissions } from '../../src/content/levels.js';
// Explicit, versioned schedule. Builds never use random or the current date.
const pool = levels.filter((l) => l.kind === 'walk');
const rows = [];
for (let i = 0; i < 366; i++) {
  const date = new Date(Date.UTC(2026, 9, 12 + i)),
    day = date.getUTCDay();
  rows.push({
    date: date.toISOString().slice(0, 10),
    revision: 1,
    walk: pool[(i * 7 + Math.floor(i / 7)) % pool.length].id,
    repair: day === 0 || day === 6 ? commissions[(Math.floor(i / 7) + day) % 8].id : null,
  });
}
await writeFile(
  new URL('../../src/content/daily-manifest.js', import.meta.url),
  `// Offline schedule: 2026-10-12 through 2027-10-12. Verified by the content suite.\nexport const manifest = ${JSON.stringify(rows, null, 2)};\n`,
);
