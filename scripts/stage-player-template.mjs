import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const workspace = resolve('.');
const source = resolve('dist/player');
const target = resolve('apps/creator/public/player-template');
if (!target.startsWith(workspace + sep)) throw new Error('Player template target is outside the workspace.');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(relative(target, path).replaceAll('\\', '/'));
  }
  return result;
}
await writeFile(join(target, 'manifest.json'), JSON.stringify({ files: (await files(target)).sort() }, null, 2));
