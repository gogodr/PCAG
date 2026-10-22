import { mkdir, copyFile, writeFile } from 'node:fs/promises';

const output = 'apps/creator/public/player-template';
await mkdir(output, { recursive: true });
for (const file of ['player.js', 'player.css']) {
  await copyFile(`dist/player/${file}`, `${output}/${file}`);
}
await writeFile(`${output}/index.html`, `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Adventure</title><link rel="stylesheet" href="./player.css"></head><body><main id="player"></main><script defer src="./player.js"></script></body></html>`);
console.log('Prepared offline player template for creator exports.');
