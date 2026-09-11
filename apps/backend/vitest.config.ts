import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*spec.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
});
