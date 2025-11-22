import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cgiProxy } from './dev-cgi-proxy.js';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [cgiProxy()],
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
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
  server: {
    port: 3000,
    open: false,
    fs: {
      allow: ['.'],
      deny: ['originalCode/**'],
    },
  },
  optimizeDeps: {
    exclude: ['originalCode', 'ncplot7py'],
  },
});
