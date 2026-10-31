import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { watch } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electron = require('electron');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Start the creator with npm run dev.');
const port = Number(process.env.PCAG_CREATOR_DEV_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PCAG_CREATOR_DEV_PORT must be a valid port.');

await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', error => reject(new Error(`Creator port ${port} is unavailable: ${error.message}`)));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});

function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit' });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with ${signal ?? `code ${code}`}.`));
    });
  });
}

await run(process.execPath, [npmCli, 'run', 'build:player']);
await run(process.execPath, [npmCli, 'run', 'stage:player']);

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.creator.config.ts', '--port', String(port)], { stdio: 'inherit' });
let desktop;

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Creator server stopped before Electron started.');
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Creator server did not start.');
}

try {
  await waitForServer();
  const env = { ...process.env, PCAG_CREATOR_DEV_URL: `http://127.0.0.1:${port}/` };
  delete env.ELECTRON_RUN_AS_NODE;
  const electronDirectory = path.resolve('apps/creator/electron');
  let restartTimer;
  let restartRequested = false;
  let stopping = false;
  const watcher = watch(electronDirectory, (_event, filename) => {
    if (filename !== 'main.cjs' && filename !== 'preload.cjs') return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (stopping) return;
      restartRequested = true;
      desktop?.kill();
    }, 150);
  });
  try {
    await new Promise((resolve, reject) => {
      const launch = () => {
        desktop = spawn(electron, ['.'], { stdio: 'inherit', env });
        desktop.once('error', reject);
        desktop.once('exit', (code, signal) => {
          if (restartRequested && !stopping) {
            restartRequested = false;
            console.log('Restarting Creator after Electron code changed.');
            launch();
          } else if (code === 0) resolve();
          else reject(new Error(`Electron exited with ${signal ?? `code ${code}`}.`));
        });
      };
      launch();
    });
  } finally {
    stopping = true;
    clearTimeout(restartTimer);
    watcher.close();
  }
} finally {
  server.kill();
  desktop?.kill();
}
