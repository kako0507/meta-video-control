import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from 'fs'

import { resolveVersion } from './scripts/version.mjs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        // The git tag, not the checked-in manifest, decides the version.
        const version = resolveVersion()
        const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
        if (version) manifest.version = version
        writeFileSync('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
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
