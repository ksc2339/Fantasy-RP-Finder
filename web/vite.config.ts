import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages (project pages) friendly relative asset paths
  base: './',
  plugins: [preact()],
})
