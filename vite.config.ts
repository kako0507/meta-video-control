import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json')
        mkdirSync('dist/icons', { recursive: true })
        if (existsSync('icons')) {
          readdirSync('icons').forEach(f => copyFileSync(`icons/${f}`, `dist/icons/${f}`))
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: { content: resolve(__dirname, 'src/content/index.ts') },
      output: { format: 'iife', entryFileNames: '[name].js', inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})
