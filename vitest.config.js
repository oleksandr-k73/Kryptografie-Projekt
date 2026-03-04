import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/vitest/setup.js'],
    include: ['tests/vitest/**/*.test.{js,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'scripts/**',
        'docs/**',
        '*.config.{js,mjs}'
      ]
    }
  }
});