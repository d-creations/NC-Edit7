import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@domain': resolve(__dirname, './src/domain'),
      '@services': resolve(__dirname, './src/services'),
      '@components': resolve(__dirname, './src/components'),
      '@adapters': resolve(__dirname, './src/adapters'),
      '@workers': resolve(__dirname, './src/workers'),
    },
  },
});
