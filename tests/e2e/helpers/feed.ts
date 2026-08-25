import { expect, Page } from '@playwright/test'
import { dismissInterstitials } from './session'

export interface FeedVideo {
  index: number
  src: string
  rate: number
  /** Share of the viewport this video covers, 0–1. */
  coverage: number
  total: number
  duration: number
}

/**
 * The video covering most of the viewport. Feeds keep neighbouring posts
 * mounted, so DOM order says nothing about what the viewer is watching.
 * Returns null when nothing meets `minCoverage` — a photo post, or a
 * mid-scroll moment where no video is on screen.
 */
export async function dominantVideo(page: Page, minCoverage = 0): Promise<FeedVideo | null> {
  return page.evaluate(min => {
    const videos = Array.from(document.querySelectorAll('video'))
    let best: HTMLVideoElement | null = null
    let bestArea = 0
    for (const video of videos) {
      const r = video.getBoundingClientRect()
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
      const area = h * w
      if (area > bestArea) {
        bestArea = area
        best = video
      }
    }
    const coverage = bestArea / (innerWidth * innerHeight)
    return best && coverage >= min
      ? {
          index: videos.indexOf(best),
          src: best.currentSrc,
          rate: best.playbackRate,
          coverage,
          total: videos.length,
          duration: best.duration,
        }
      : null
  }, minCoverage)
}

export async function waitForDominantVideo(page: Page, minCoverage = 0): Promise<FeedVideo> {
  await expect
    .poll(async () => (await dominantVideo(page, minCoverage)) !== null, { timeout: 20000 })
    .toBe(true)
  return (await dominantVideo(page, minCoverage))!
}

/**
 * The host div is appended before React renders into its shadow root, so
 * waiting on #ig-ctrl-host alone can hand back an empty panel.
 */
export async function waitForPanel(page: Page) {
  await expect
    .poll(() => page.evaluate(() =>
      document.getElementById('ig-ctrl-host')?.shadowRoot?.querySelectorAll('.speed-btn').length ?? 0
    ), { message: 'panel never rendered its controls', timeout: 30000 })
    .toBeGreaterThan(0)
}

export async function clickSpeed(page: Page, label: string) {
  await expect
    .poll(() => page.evaluate(label => {
      const shadow = document.getElementById('ig-ctrl-host')?.shadowRoot
      if (!shadow) return false
      return Array.from(shadow.querySelectorAll('.speed-btn')).some(b => b.textContent?.trim() === label)
    }, label), { message: `panel speed button "${label}" never rendered`, timeout: 15000 })
    .toBe(true)

  await page.evaluate(label => {
    const shadow = document.getElementById('ig-ctrl-host')!.shadowRoot!
    const target = Array.from(shadow.querySelectorAll('.speed-btn')).find(
      b => b.textContent?.trim() === label
    ) as HTMLButtonElement
    target.click()
  }, label)
}

/**
 * The post being watched covers roughly a quarter of the viewport; a neighbour
 * peeking in from below stays well under a tenth. Photo posts leave neither.
 */
export const IN_VIEW = 0.15

/**
 * Scrolls past photo posts until a video other than `previousSrc` is in view.
 * A feed can open on nothing but photos, so the first video may take a while —
 * and until one exists there is no panel to assert anything about.
 */
export async function scrollToNextVideo(page: Page, previousSrc: string | null): Promise<FeedVideo> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await dismissInterstitials(page)
    const current = await dominantVideo(page, IN_VIEW)
    if (current && current.src !== previousSrc) return current
    await page.mouse.move(640, 450)
    await page.mouse.wheel(0, 700)
    await page.waitForTimeout(1800)
  }
  throw new Error(`no further video scrolled into view after ${previousSrc ?? 'the top of the feed'}`)
}
