import { expect, Page } from '@playwright/test'
import fs from 'fs'
import { loggedInTest as test, credentials } from './helpers/logged-in'
import { waitForPanel } from './helpers/feed'

// A public reel, reachable both as a reel and as a regular post. If it is ever
// taken down these tests need a new one.
const SHORTCODE = 'DcQ7XESu_Yy'
const AS_REEL = `https://www.instagram.com/reel/${SHORTCODE}/`
const AS_POST = `https://www.instagram.com/p/${SHORTCODE}/`

/**
 * Clicks the panel's download control and returns what the browser saved. The
 * video element is backed by MediaSource and cannot be fetched, so anything
 * arriving here proves the CDN url was resolved from the page's media JSON.
 */
async function saveVideo(page: Page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
  await page.evaluate(() => {
    const shadow = document.getElementById('ig-ctrl-host')!.shadowRoot!
    const button = shadow.querySelector('.download-btn') as HTMLButtonElement | null
    if (!button) throw new Error('panel rendered no download button')
    button.click()
  })
  const download = await downloadPromise
  return {
    filename: download.suggestedFilename(),
    buffer: fs.readFileSync(await download.path()),
  }
}

function expectPlayableMp4(buffer: Buffer) {
  expect(buffer.byteLength).toBeGreaterThan(100_000)
  // An MP4 opens with an ftyp box; the handler types prove both tracks
  // survived, which is what separates this from the raw MSE segments.
  expect(buffer.subarray(4, 8).toString('latin1')).toBe('ftyp')
  const head = buffer.subarray(0, 3_000_000).toString('latin1')
  expect(head.includes('vide'), 'expected a video track').toBe(true)
  expect(head.includes('soun'), 'expected an audio track').toBe(true)
}

test.describe('downloading a video', () => {
  test.skip(!credentials, 'set IG_USERNAME and IG_PASSWORD in .env to run this suite')
  test.slow()

  test('saves a reel permalink as a playable mp4 with its audio intact', async ({ page }) => {
    await page.goto(AS_REEL, { waitUntil: 'domcontentloaded' })
    await waitForPanel(page)

    const saved = await saveVideo(page)

    expect(saved.filename).toBe(`${SHORTCODE}.mp4`)
    expectPlayableMp4(saved.buffer)
  })

  test('saves a regular post permalink, which never redirects to the reel view', async ({ page }) => {
    await page.goto(AS_POST, { waitUntil: 'domcontentloaded' })
    expect(new URL(page.url()).pathname).toBe(`/p/${SHORTCODE}/`)
    await waitForPanel(page)

    const saved = await saveVideo(page)

    expect(saved.filename).toBe(`${SHORTCODE}.mp4`)
    expectPlayableMp4(saved.buffer)
  })

  /**
   * The document keeps the media JSON it was loaded with, and offers no way to
   * tell which block belongs to the reel now on screen. Scrolling on must
   * therefore withdraw the button rather than risk saving the wrong video.
   */
  test('withdraws the download once the feed scrolls to another reel', async ({ page }) => {
    await page.goto('https://www.instagram.com/reels/', { waitUntil: 'domcontentloaded' })
    await waitForPanel(page)

    const hasButton = () =>
      page.evaluate(
        () => !!document.getElementById('ig-ctrl-host')?.shadowRoot?.querySelector('.download-btn')
      )
    const reelPath = () => page.evaluate(() => location.pathname)

    expect(await hasButton(), 'the reel the feed opened on is downloadable').toBe(true)
    const openedOn = await reelPath()

    await page.mouse.move(640, 450)
    await page.mouse.wheel(0, 900)
    await expect.poll(reelPath, { timeout: 20000 }).not.toBe(openedOn)
    await waitForPanel(page)

    await expect
      .poll(hasButton, { message: 'a scrolled-to reel must not offer a download', timeout: 10000 })
      .toBe(false)
  })
})
