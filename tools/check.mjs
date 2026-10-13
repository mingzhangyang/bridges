import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? files(`${dir}/${e.name}`) : `${dir}/${e.name}`,
      ),
    )
  ).flat();
}
for (const file of [
  ...(await files('src')),
  ...(await files('tools')),
  ...(await files('tests')),
].filter((f) => /\.m?js$/.test(f))) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status) {
    console.error(r.stderr);
    process.exit(1);
  }
  if (file.startsWith('src/')) {
    const text = await readFile(file, 'utf8');
    if (/https?:\/\//.test(text.replaceAll('http://www.w3.org/2000/svg', '')))
      throw new Error(`Unexpected runtime network dependency: ${file}`);
  }
}
console.log('JavaScript syntax and local runtime boundary: passed');
