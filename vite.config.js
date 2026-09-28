import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: resolve('play/index.html') }, chunkSizeWarningLimit: 2400 },
  plugins: [{
    name: 'preserve-static-site',
    closeBundle() {
      for (const path of ['index.html', 'stylesheet.css', 'script.js', 'assets', 'images', 'projects', 'play/glass-orb.html']) {
        if (existsSync(path)) cpSync(path, `dist/${path}`, { recursive: true });
      }
    },
  }],
});
