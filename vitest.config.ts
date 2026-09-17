import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['shared/**/*.{ts,js}', 'server/**/*.{ts,js}', 'client/src/**/*.{js,jsx}'],
      exclude: [
        '**/node_modules/**',
        'tests/**',
        'server/index.ts',
        'client/src/main.*',
        'shared/dto/index.ts',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
