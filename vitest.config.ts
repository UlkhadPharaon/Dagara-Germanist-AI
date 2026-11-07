import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest configuration.
 *
 * `environment: 'jsdom'` gives React Testing Library a DOM; `globals: true`
 * lets tests use `describe/it/expect` without imports (matching the
 * project's preference for readable specs). Setup file registers
 * @testing-library/jest-dom matchers and resets localStorage between tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'android/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**/*.ts', 'src/hooks/**/*.ts'],
      thresholds: {
        // Fail CI if the parsing/validation core regresses below coverage.
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
