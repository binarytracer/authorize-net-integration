import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// swc emits the decorator metadata Nest's dependency injection needs.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
