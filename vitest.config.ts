import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: { reporter: ['text', 'html'], include: ['src/features/**/*.ts'] },
  },
});
