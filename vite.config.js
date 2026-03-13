import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [cloudflare()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
    allowedHosts: true,
  },
});
