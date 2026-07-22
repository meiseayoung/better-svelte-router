import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [svelte()],
  resolve: {
    alias: {
      'better-svelte-router': path.resolve(root, '../../src/index.ts'),
    },
  },
  server: {
    port: 5177,
    open: true,
  },
});
