import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('./apps/player', import.meta.url)),
  cacheDir: fileURLToPath(new URL(`./node_modules/.vite/player/${mode}`, import.meta.url)),
  base: './',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL('./dist/player', import.meta.url)),
    emptyOutDir: true,
  },
}));
