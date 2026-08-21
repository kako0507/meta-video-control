import { expect } from '@playwright/test'
import { loggedInTest as test, credentials } from './helpers/logged-in'
import { waitForDominantVideo, clickSpeed, waitForPanel, scrollToNextVideo, IN_VIEW } from './helpers/feed'

test.describe('home feed, logged in', () => {
  test.skip(!credentials, 'set IG_USERNAME and IG_PASSWORD in .env to run this suite')
  test.slow()

  test('controls each video scrolled onto, across the photo posts between them', async ({ page }) => {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' })

    // The panel only exists once a video does, and the feed may open on photos,
    // so scroll a video into view before expecting it.
    // What the feed serves is out of our hands; a load with no video in reach
    // cannot exercise this behaviour, so skip rather than report a failure.
    const first = await scrollToNextVideo(page, null).catch(() => null)
    test.skip(!first, 'this load of the feed surfaced no video to control')
    await waitForPanel(page)
    await clickSpeed(page, '2×')
    await expect
      .poll(async () => (await waitForDominantVideo(page, IN_VIEW)).rate, {
        message: 'panel should control the first video in the feed',
        timeout: 8000,
      })
      .toBe(2)

    const second = await scrollToNextVideo(page, first!.src)
    expect(second.src).not.toBe(first!.src)
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
