import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public',
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        test: resolve(__dirname, 'test.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Forward legacy CGI path to local FastAPI adapter during development
      '/ncplot7py/scripts/cgiserver.cgi': {
        target: 'http://localhost:8000/cgiserver',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/ncplot7py/scripts/cgiserver.cgi', '/cgiserver'),
      },
      // Also provide path for the import-based adapter
      '/ncplot7py/scripts/cgiserver_import': {
        target: 'http://localhost:8000/cgiserver_import',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/ncplot7py/scripts/cgiserver_import', '/cgiserver_import'),
      },
    },
  },
});
