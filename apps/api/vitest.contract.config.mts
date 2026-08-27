import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.mjs';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/contract/**/*.spec.ts'],
      passWithNoTests: true,
    },
  }),
);
