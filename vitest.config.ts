import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Client component tests need browser svelte exports (not SSR stubs).
  resolve: process.env.VITEST
    ? {
        conditions: ['browser'],
      }
    : undefined,
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
