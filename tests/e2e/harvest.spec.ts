import { test as base, expect, chromium, BrowserContext, Page } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'

const distDir = path.resolve(process.cwd(), 'dist')
const PAGE_URL = 'https://www.instagram.com/'
const PAGE_HTML = fs.readFileSync(
  path.resolve(process.cwd(), 'tests/e2e/fixtures/harvest.html'),
  'utf-8'
)
const VIDEO_BYTES = fs.readFileSync(
  path.resolve(process.cwd(), 'tests/e2e/fixtures/assets/harvest.mp4')
)

const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvc-harvest-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
      viewport: { width: 1280, height: 900 },
    })
    await context.route('https://www.instagram.com/**', route => {
      const url = route.request().url()
      if (url.endsWith('.mp4')) {
        return route.fulfill({ status: 200, contentType: 'video/mp4', body: VIDEO_BYTES })
      }
      return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE_HTML })
    })
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()))
  },
})

const hasButton = (page: Page) =>
  page.evaluate(
    () => !!document.getElementById('ig-ctrl-host')?.shadowRoot?.querySelector('.download-btn')
  )

/**
 * The fixture's `<video>` has a real source rather than a JS-overridden
 * `.duration`: content.js reads `video.duration` from its own isolated
 * world, and a plain-data-property override set from this page-world
 * `evaluate` only shadows the getter on the main world's wrapper for the
 * element — the isolated world's wrapper for the same node still sees the
 * native getter (and NaN, for a sourceless video). Waiting for the browser
 * to compute a genuine duration from real media bytes is what makes both
 * worlds agree, exactly as they must for real Instagram video elements.
 */
async function waitForRealDuration(page: Page): Promise<number> {
  const readDuration = () =>
    page.evaluate(() => (document.getElementById('v') as HTMLVideoElement).duration)
  await expect
    .poll(async () => Number.isFinite(await readDuration()), {
      message: 'fixture video never reported a finite duration',
      timeout: 10000,
    })
    .toBe(true)
  return readDuration()
}

/** Speaks the bridge from the page world, exactly as the harvester does. */
async function harvest(page: Page, duration: number) {
  await page.evaluate(duration => {
    window.postMessage(
      {
        marker: 'MVC_MEDIA',
        // The bridge only accepts entries whose URL resolves to Instagram's
        // real CDN hosts (see isValidMediaEntry in src/harvest/bridge.ts).
        entries: [{ code: 'FIXTURE1', url: 'https://scontent.cdninstagram.com/f.mp4', duration }],
      },
      window.location.origin
    )
  }, duration)
}

test.describe('harvested media reaching the panel', () => {
  test('a video becomes downloadable once its media is harvested', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached({ timeout: 10000 })
    const duration = await waitForRealDuration(page)
    expect(await hasButton(page)).toBe(false)

    // A genuine cross-world postMessage: this page.evaluate runs in the same
    // MAIN world as harvest.js, and content.js's media-index listens for it
    // from the isolated world. jsdom never populates MessageEvent.source, so
    // no unit test can prove the index's `event.source === window` guard
    // actually holds for a real cross-world delivery — only this real
    // browser round trip can.
    await harvest(page, duration)

    await expect.poll(() => hasButton(page), { timeout: 10000 }).toBe(true)
  })

  test('media whose duration disagrees is not offered', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached({ timeout: 10000 })
    const duration = await waitForRealDuration(page)

    await harvest(page, duration + 10)

    await page.waitForTimeout(1500)
    expect(await hasButton(page)).toBe(false)
  })
})
