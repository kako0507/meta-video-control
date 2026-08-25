import { expect, Page } from '@playwright/test'
import fs from 'fs'
import { loggedInTest as test, credentials } from './helpers/logged-in'
import { waitForPanel, scrollToNextVideo } from './helpers/feed'

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

const hasDownloadButton = (page: Page) =>
  page.evaluate(
    () => !!document.getElementById('ig-ctrl-host')?.shadowRoot?.querySelector('.download-btn')
  )

/** Reads the duration out of an MP4's mvhd box. */
function mp4Duration(buffer: Buffer): number {
  const at = buffer.indexOf(Buffer.from('mvhd', 'latin1'))
  if (at < 0) return NaN
  const base = at + 8
  return buffer.readUInt32BE(base + 12) / buffer.readUInt32BE(base + 8)
}

test.describe('downloading a video', () => {
  test.skip(!credentials, 'set IG_USERNAME and IG_PASSWORD in .env to run this suite')
  test.slow()

  /**
   * Also the regression test for the replay handshake: this permalink's
   * media is harvested at DOMContentLoaded, before content.js's index has
   * been created (and before it has announced itself ready), so the only
   * way this entry can reach the panel is via the harvester replaying its
   * buffer once the index's MVC_MEDIA_READY message arrives — the old
   * permalink-only resolution path that didn't need replay was deleted. Do
   * not "simplify" this back to a plain load-and-download test.
   */
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
   * Scrolling must re-bind the download to the reel now on screen. This test
   * once asserted the opposite — that the button withdrew — because resolution
   * then depended on a permalink anchor the reels player does not render, so
   * only the reel the page was loaded with could ever resolve. Falling back to
   * the URL path removed that limitation, and the filename is what proves the
   * re-bind: it must name the new reel, not the one we scrolled away from.
   */
  test('re-binds the download to the reel the feed scrolls to', async ({ page }) => {
    await page.goto('https://www.instagram.com/reels/', { waitUntil: 'domcontentloaded' })
    await waitForPanel(page)

    const reelPath = () => page.evaluate(() => location.pathname)
    const shortcode = async () => (await reelPath()).split('/').filter(Boolean)[1]

    // The button appears only once the element's metadata and the harvested
    // entry have both arrived, so it is genuinely asynchronous — poll for it.
    await expect
      .poll(() => hasDownloadButton(page), { message: 'the reel the feed opened on is downloadable', timeout: 20000 })
      .toBe(true)
    const openedOn = await reelPath()

    await page.mouse.move(640, 450)
    await page.mouse.wheel(0, 900)
    await expect.poll(reelPath, { timeout: 20000 }).not.toBe(openedOn)
    await waitForPanel(page)

    await expect
      .poll(() => hasDownloadButton(page), { message: 'the scrolled-to reel is downloadable too', timeout: 20000 })
      .toBe(true)

    const saved = await saveVideo(page)
    expect(saved.filename).toBe(`${await shortcode()}.mp4`)
    expectPlayableMp4(saved.buffer)
  })

  /**
   * The only test that exercises interception and correlation together: nothing
   * about a feed video is in the document, so a saved file that matches the
   * element's duration can only have come through the harvester.
   */
  test('saves a video scrolled to in the home feed', async ({ page }) => {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' })
    const onScreen = await scrollToNextVideo(page, null).catch(() => null)
    test.skip(!onScreen, 'this load of the feed surfaced no video to save')
    await waitForPanel(page)

    await expect.poll(() => hasDownloadButton(page), { timeout: 20000 }).toBe(true)
    const saved = await saveVideo(page)

    expectPlayableMp4(saved.buffer)
    expect(Math.abs(mp4Duration(saved.buffer) - onScreen!.duration)).toBeLessThan(0.5)
  })
})
