import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 5199 },
  preview: { host: true, port: 5199 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
