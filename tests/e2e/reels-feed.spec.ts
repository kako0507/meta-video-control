import { expect } from '@playwright/test'
import { loggedInTest as test, credentials } from './helpers/logged-in'
import { dismissInterstitials } from './helpers/session'
import { waitForDominantVideo, dominantVideo, clickSpeed, waitForPanel } from './helpers/feed'

/** Scrolls one reel down and waits until a different video occupies the screen. */
async function scrollToNextReel(page: Parameters<typeof clickSpeed>[0], previousSrc: string) {
  await page.mouse.move(640, 450)
  await page.mouse.wheel(0, 900)
  await expect
    .poll(async () => (await dominantVideo(page))?.src ?? previousSrc, { timeout: 20000 })
    .not.toBe(previousSrc)
  await waitForPanel(page)
  return waitForDominantVideo(page)
}

test.describe('reels feed, logged in', () => {
  test.skip(!credentials, 'set IG_USERNAME and IG_PASSWORD in .env to run this suite')
  test.slow()

  test('controls the reel on screen after scrolling down two reels', async ({ page }) => {
    await page.goto('https://www.instagram.com/reels/', { waitUntil: 'domcontentloaded' })
    await waitForPanel(page)
    await dismissInterstitials(page)

    const first = await waitForDominantVideo(page)
    await clickSpeed(page, '2×')
    await expect
      .poll(async () => (await waitForDominantVideo(page)).rate, {
        message: 'panel should control the first reel',
        timeout: 8000,
      })
      .toBe(2)

    const second = await scrollToNextReel(page, first.src)
    expect(second.src).not.toBe(first.src)
    await clickSpeed(page, '1.5×')
    await expect
      .poll(async () => (await waitForDominantVideo(page)).rate, {
        message: 'panel should control the second reel',
        timeout: 8000,
      })
      .toBe(1.5)

    const third = await scrollToNextReel(page, second.src)
    expect(third.src).not.toBe(second.src)
    await clickSpeed(page, '2×')
    await expect
      .poll(async () => (await waitForDominantVideo(page)).rate, {
        message: 'panel should control the third reel',
        timeout: 8000,
      })
      .toBe(2)
  })
})
