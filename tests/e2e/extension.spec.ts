import { test as base, expect, chromium, BrowserContext, Page } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'

const distDir = path.resolve(process.cwd(), 'dist')

// Content scripts only run on URLs matching the manifest, so the fixture is
// served from instagram.com via request interception instead of file://.
const PAGE_URL = 'https://www.instagram.com/reel/TESTREEL/'
const PAGE_HTML = `<!doctype html>
<html><head><title>fixture</title></head>
<body><div id="app"><video id="video-a"></video></div></body></html>`

interface ExtensionFixtures {
  context: BrowserContext
  page: Page
}

const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvc-ext-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${distDir}`,
        `--load-extension=${distDir}`,
      ],
    })
    await context.route('https://www.instagram.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: PAGE_HTML })
    )
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage())
    await use(page)
  },
})

test.describe('loaded as a real Chrome extension', () => {
  test('mounts the panel on a page with a video', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached({ timeout: 10000 })
  })

  test('panel survives a browser Back navigation while the video stays in the DOM', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached({ timeout: 10000 })

    await page.evaluate(() => history.pushState({}, '', '/reel/SECOND/'))
    await page.goBack()

    await expect(page.locator('video')).toBeAttached()
    await expect(page.locator('#ig-ctrl-host')).toBeAttached({ timeout: 10000 })
  })

  test('rebinds to the current video after the page navigates via pushState', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached({ timeout: 10000 })

    // Instagram keeps the previous reel's <video> mounted, so a new one shows
    // up ahead of it in the DOM while the old element is still there.
    await page.evaluate(() => {
      const next = document.createElement('video')
      next.id = 'video-b'
      document.getElementById('app')!.prepend(next)
      history.pushState({}, '', '/reel/SECOND/')
    })
    await page.waitForTimeout(1000)

    await page.evaluate(() => {
      const shadow = document.getElementById('ig-ctrl-host')!.shadowRoot!
      const buttons = Array.from(shadow.querySelectorAll('.speed-btn'))
      const btn2x = buttons.find(b => b.textContent?.includes('2')) as HTMLButtonElement
      btn2x.click()
    })

    const rates = await page.evaluate(() => ({
      a: (document.getElementById('video-a') as HTMLVideoElement).playbackRate,
      b: (document.getElementById('video-b') as HTMLVideoElement).playbackRate,
    }))
    expect(rates).toEqual({ a: 1, b: 2 })
  })
})
