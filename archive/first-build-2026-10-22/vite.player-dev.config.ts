import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/player',
  server: { port: 5174, fs: { allow: ['../..'] } },
});
