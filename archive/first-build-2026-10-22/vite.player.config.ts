import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/player',
    emptyOutDir: true,
    lib: {
      entry: 'apps/player/src/main.ts',
      name: 'PCAGPlayer',
      formats: ['iife'],
      fileName: () => 'player.js',
      cssFileName: 'player',
    },
  },
});
