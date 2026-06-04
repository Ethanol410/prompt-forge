import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Par défaut: environnement Node (le core est pur, sans DOM).
    // Les tests nécessitant le DOM (adapters web) déclarent `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**', 'apps/**/src/**'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
