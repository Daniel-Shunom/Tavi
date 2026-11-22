import { defineConfig } from 'vitest/config';
import { testScopes } from './tools/ci/scopes.ts';
export default defineConfig({
  test: {
    maxWorkers: 4,
    projects: testScopes.map((name) => ({
      test: { name, include: [`tests/${name}/**/*.test.ts`] },
    })),
  },
});
