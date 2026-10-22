import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'apps/creator',
  base: './',
  plugins: [react()],
  server: { fs: { allow: ['../..'] } },
  build: { outDir: '../../dist/creator', emptyOutDir: true },
});
