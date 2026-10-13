import { writeFile } from 'node:fs/promises';
import { levels, commissions } from '../../src/content/levels.js';
import { manifest } from '../../src/content/daily-manifest.js';
import { extendSchedule } from './daily-schedule.mjs';
// Revise a published day by adding an entry with the next revision; never edit or delete one.
const rows = extendSchedule(manifest, {
  walks: levels.filter((l) => l.kind === 'walk'),
  commissions,
});
await writeFile(
  new URL('../../src/content/daily-manifest.js', import.meta.url),
  `// Offline schedule: ${rows[0].date} through ${rows.at(-1).date}. Append-only; verified by the content suite.\nexport const manifest = ${JSON.stringify(rows, null, 2)};\n`,
);
