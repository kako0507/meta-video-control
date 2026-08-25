import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: { harvest: resolve(__dirname, 'src/harvest/main.ts') },
      output: { format: 'iife', entryFileNames: 'harvest.js', inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
})
