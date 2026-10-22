import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./apps/creator', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./node_modules/.vite/creator', import.meta.url)),
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL('./dist/creator', import.meta.url)),
    emptyOutDir: true,
  },
});
