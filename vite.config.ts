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
      // Legacy frontend calls the CGI path; during dev forward these to the
      // import-based FastAPI adapter so the frontend works without changing
      // the client code. If you prefer the subprocess adapter, point this
      // to `/cgiserver` instead.
      '/ncplot7py/scripts/cgiserver.cgi': {
        // During local development route to the import adapter on 8001
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/ncplot7py/scripts/cgiserver.cgi', '/cgiserver_import'),
      },
      // Also provide path for the import-based adapter
      '/ncplot7py/scripts/cgiserver_import': {
        target: 'http://localhost:8001/cgiserver_import',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/ncplot7py/scripts/cgiserver_import', '/cgiserver_import'),
      },
    },
  },
});
