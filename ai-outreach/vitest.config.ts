import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // `server-only` throws outside a React Server Component graph; the modules
      // under test are server modules, so stub it out for the test runner.
      { find: /^server-only$/, replacement: fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
