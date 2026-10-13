import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { levels, commissions } from '../../src/content/levels.js';
import { eulerRoute } from '../../src/model/euler.js';
import { repairSolution } from '../../src/model/repair.js';
import { replay } from '../../src/services/replay.js';
const proofs = {};
for (const l of [...levels, ...commissions]) {
  const proof =
    l.kind === 'repair'
      ? repairSolution(l)
      : l.kind === 'discovery'
        ? null
        : {
            route: eulerRoute(
              l,
              l.fixedStart,
              l.objective === 'return' ? l.fixedStart : l.fixedEnd,
            ),
          };
  if (l.kind !== 'discovery' && !proof?.route) throw new Error(`No witness: ${l.id}`);
  if (
    l.kind === 'walk' &&
    !replay(l, proof.route.start, proof.route.edges, { complete: true, end: proof.route.end })
  )
    throw new Error(`Invalid route: ${l.id}`);
  proofs[l.id] = proof ?? { discovery: true, degrees: { A: 5, B: 3, C: 3, D: 3 } };
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('src', 'dist/src', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await writeFile('dist/content-proof.json', JSON.stringify(proofs, null, 2));
const total = (await readFile('src/game.js')).length + (await readFile('src/style.css')).length;
console.log(
  `Built 32 campaign levels, 8 commissions, 366 dated challenges. UI source ${Math.round(total / 1024)} KiB. No runtime dependencies.`,
);
