import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const clientRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  build: {
    outDir: path.resolve(clientRoot, '../dist/client'),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:10000' }
  }
});
