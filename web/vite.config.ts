import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages (project pages) friendly relative asset paths
  base: './',
  plugins: [preact()],
  // Some environments block native minifiers (e.g. lightningcss binaries),
  // so disable minification to keep production builds working reliably.
  build: { minify: false },
})
