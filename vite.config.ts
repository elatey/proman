import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` keeps the build portable: it works on GitHub Pages sub-paths,
// Netlify, Vercel, Cloudflare Pages or any static host. Routing uses the URL hash,
// so no server rewrite rules are needed.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 2500 },
});
