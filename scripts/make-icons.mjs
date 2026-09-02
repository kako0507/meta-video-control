// Regenerates icons/icon<size>.png from one SVG, using the Chromium that
// Playwright already installs for the e2e suite.
//
//   npm run icons
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const SIZES = [16, 32, 48, 128]
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../icons')

// The panel's Instagram gradient (src/panel/panel.css), as a 45deg fill.
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#f09433"/>
      <stop offset="0.25" stop-color="#e6683c"/>
      <stop offset="0.5" stop-color="#dc2743"/>
      <stop offset="0.75" stop-color="#cc2366"/>
      <stop offset="1" stop-color="#bc1888"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <path d="M54 42 L90 64 L54 86 Z" fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>
</svg>`

const browser = await chromium.launch()
const page = await browser.newPage()

for (const size of SIZES) {
  await page.setContent(
    `<style>html,body{margin:0;background:none}</style>${svg(size)}`,
    { waitUntil: 'load' }
  )
  const png = await page.locator('svg').screenshot({ omitBackground: true })
  const file = resolve(outDir, `icon${size}.png`)
  writeFileSync(file, png)
  console.log(`wrote ${file} (${png.length} bytes)`)
}

await browser.close()
