import { expect, Page } from '@playwright/test'
import { loggedInTest as test, credentials } from './helpers/logged-in'
import { dismissInterstitials } from './helpers/session'
import { dominantVideo, waitForDominantVideo, clickSpeed, waitForPanel, FeedVideo } from './helpers/feed'

// The post being watched covers roughly a quarter of the viewport; a neighbour
// peeking in from below stays well under a tenth. Photo posts leave neither.
const IN_VIEW = 0.15

/**
 * Scrolls past photo posts until a video other than `previousSrc` is in view.
 * The top of the feed is often all photos, so the first video can take a while.
 */
async function scrollToNextVideo(page: Page, previousSrc: string | null): Promise<FeedVideo> {
  for (let attempt = 0; attempt < 15; attempt++) {
    await dismissInterstitials(page)
    const current = await dominantVideo(page, IN_VIEW)
    if (current && current.src !== previousSrc) return current
    await page.mouse.move(640, 450)
    await page.mouse.wheel(0, 700)
    await page.waitForTimeout(1800)
  }
  throw new Error(`no further video scrolled into view after ${previousSrc ?? 'the top of the feed'}`)
}

test.describe('home feed, logged in', () => {
  test.skip(!credentials, 'set IG_USERNAME and IG_PASSWORD in .env to run this suite')
  test.slow()

  test('controls each video scrolled onto, across the photo posts between them', async ({ page }) => {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' })
    await dismissInterstitials(page)

    // The panel only exists once a video does, and the feed may open on photos,
    // so scroll a video into view before expecting it.
    const first = await scrollToNextVideo(page, null)
    await waitForPanel(page)
    await clickSpeed(page, '2×')
    await expect
      .poll(async () => (await waitForDominantVideo(page, IN_VIEW)).rate, {
        message: 'panel should control the first video in the feed',
        timeout: 8000,
      })
      .toBe(2)

    const second = await scrollToNextVideo(page, first.src)
    expect(second.src).not.toBe(first.src)
    await waitForPanel(page)
    await clickSpeed(page, '1.5×')
    await expect
      .poll(async () => (await waitForDominantVideo(page, IN_VIEW)).rate, {
        message: 'panel should control the second video once it is on screen',
        timeout: 8000,
      })
      .toBe(1.5)
  })
})
