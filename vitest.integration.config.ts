import { defineConfig } from 'vitest/config';

// Pruebas contra el Supabase local (RLS, Storage y Edge Functions).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
