import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@murray-fsm/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@murray-fsm/services': path.resolve(__dirname, 'packages/services/src'),
    },
  },
});
