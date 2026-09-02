import { test, expect, Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

import {
  readCredentials,
  launchExtensionContext,
  ensureLoggedIn,
  dismissInterstitials,
  sessionFile,
} from './helpers/session'
import { waitForPanel, waitForDominantVideo } from './helpers/feed'

/**
 * Records the README demo against the real site. Not an assertion suite: it
 * drives the panel through a scripted sequence and leaves a webm behind for
 * scripts/make-demo-gif.mjs to turn into docs/demo.gif.
 *
 *   npm run demo
 */

declare global {
  interface Window {
    __demoMove: (x: number, y: number) => void
    __demoPress: (x: number, y: number) => void
  }
}

const REELS = 'https://www.instagram.com/instagram/reels/'
const VIDEO_DIR = path.resolve(process.cwd(), 'docs/.demo-video')
const SIZE = { width: 1100, height: 980 }
const PAD = 12 // breathing room around the video in the cropped gif

const credentials = readCredentials()

/**
 * Playwright's video has no pointer in it, so clicks would look like the panel
 * moving on its own. This draws one and keeps it on the real mouse position.
 */
function installCursor() {
  if (typeof window.__demoMove === 'function') return

  const dot = document.createElement('div')
  const arrow =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
    "<path d='M5 2 L5 20 L9.5 15.5 L12.5 22 L15.5 20.5 L12.5 14.5 L19 14.5 Z' " +
    "fill='white' stroke='rgba(0,0,0,.55)' stroke-width='1.2'/></svg>"
  dot.style.cssText =
    'position:fixed;left:0;top:0;width:22px;height:22px;margin:-2px 0 0 -2px;' +
    'pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px);' +
    'background:no-repeat center/contain url("data:image/svg+xml;utf8,' + arrow + '")'

  const ring = document.createElement('div')
  ring.style.cssText =
    'position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;' +
    'border-radius:50%;pointer-events:none;z-index:2147483646;' +
    'border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.35);' +
    'opacity:0;transform:translate(-100px,-100px) scale(.4)'

  const attach = () => document.documentElement.append(ring, dot)
  if (document.documentElement) attach()
  else document.addEventListener('DOMContentLoaded', attach)

  window.__demoMove = (x, y) => {
    dot.style.transform = 'translate(' + x + 'px,' + y + 'px)'
  }
  window.__demoPress = (x, y) => {
    ring.style.transition = 'none'
    ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(.4)'
    ring.style.opacity = '1'
    requestAnimationFrame(() => {
      ring.style.transition = 'opacity .45s ease, transform .45s ease'
      ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(1)'
      ring.style.opacity = '0'
    })
  }
}

interface Point {
  x: number
  y: number
}

class Cursor {
  private at: Point = { x: SIZE.width / 2, y: SIZE.height - 60 }

  constructor(private page: Page) {}

  /** Moves in small steps so the recording shows travel, not teleporting. */
  async glide(to: Point, steps = 18) {
    await this.page.evaluate(installCursor)
    const from = this.at
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      // ease-in-out, so the pointer accelerates away and settles on the target
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const x = from.x + (to.x - from.x) * e
      const y = from.y + (to.y - from.y) * e
      await this.page.mouse.move(x, y)
      await this.page.evaluate(([x, y]) => window.__demoMove(x, y), [x, y])
      await this.page.waitForTimeout(12)
    }
    this.at = to
  }

  async press() {
    await this.page.evaluate(([x, y]) => window.__demoPress(x, y), [this.at.x, this.at.y])
  }

  async click(to: Point) {
    await this.glide(to)
    await this.press()
    await this.page.mouse.click(to.x, to.y)
  }

  /** Press, travel, release — how the panel's sliders expect to be used. */
  async drag(from: Point, to: Point) {
    await this.glide(from)
    await this.press()
    await this.page.mouse.down()
    await this.glide(to, 20)
    await this.page.mouse.up()
  }
}

/** Centre of a panel control, which lives inside the panel's shadow root. */
async function control(page: Page, selector: string, text?: string): Promise<Point> {
  const box = await page.evaluate(
    ({ selector, text }) => {
      const shadow = document.getElementById('ig-ctrl-host')?.shadowRoot
      if (!shadow) return null
      const all = Array.from(shadow.querySelectorAll(selector))
      const el = text ? all.find(e => e.textContent?.trim() === text) : all[0]
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    },
    { selector, text }
  )
  if (!box) throw new Error(`panel control not found: ${selector}${text ? ` "${text}"` : ''}`)
  return box
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

async function panelRect(page: Page): Promise<Rect> {
  const rect = await page.evaluate(() => {
    const panel = document.getElementById('ig-ctrl-host')?.shadowRoot?.querySelector('.ig-panel')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
  if (!rect) throw new Error('panel is not on screen')
  return rect
}

/** The video the panel is driving: the one covering most of the viewport. */
async function videoRect(page: Page): Promise<Rect> {
  const rect = await page.evaluate(() => {
    let best: DOMRect | null = null
    for (const video of document.querySelectorAll('video')) {
      const r = video.getBoundingClientRect()
      if (!best || r.width * r.height > best.width * best.height) best = r
    }
    return best && { x: best.left, y: best.top, w: best.width, h: best.height }
  })
  if (!rect) throw new Error('no video on screen')
  return rect
}

/** A point along a slider track, 0 to 1 from its left edge. */
async function alongTrack(page: Page, selector: string, fraction: number): Promise<Point> {
  const box = await page.evaluate(
    ({ selector, fraction }) => {
      const track = document.getElementById('ig-ctrl-host')?.shadowRoot?.querySelector(selector)
      if (!track) return null
      const r = track.getBoundingClientRect()
      return { x: r.left + r.width * fraction, y: r.top + r.height / 2 }
    },
    { selector, fraction }
  )
  if (!box) throw new Error(`panel track not found: ${selector}`)
  return box
}

test.describe('README demo', () => {
  test.skip(!credentials, 'set IG_USERNAME and IG_PASSWORD in .env to record the demo')
  test.slow()

  test('records the panel driving a reel', async () => {
    // Sign in first, in a context that is not being recorded: the login form
    // must never end up in a video that ships in the repository.
    const signIn = await launchExtensionContext()
    await ensureLoggedIn(signIn, signIn.pages()[0] ?? (await signIn.newPage()), credentials!)
    await signIn.close()

    fs.rmSync(VIDEO_DIR, { recursive: true, force: true })
    const context = await launchExtensionContext({
      viewport: SIZE,
      recordVideo: { dir: VIDEO_DIR, size: SIZE },
    })
    const startedAt = Date.now()

    await context.addCookies(JSON.parse(fs.readFileSync(sessionFile, 'utf-8')))
    await context.addInitScript(installCursor)

    const page = context.pages()[0] ?? (await context.newPage())
    const cursor = new Cursor(page)

    await page.goto(REELS, { waitUntil: 'domcontentloaded' })
    await dismissInterstitials(page)

    // Open the first reel on the profile grid.
    const tile = page.locator('a[href*="/reel/"]').first()
    await tile.waitFor({ state: 'visible', timeout: 30000 })
    const tileBox = (await tile.boundingBox())!
    await cursor.click({ x: tileBox.x + tileBox.width / 2, y: tileBox.y + tileBox.height / 2 })

    await waitForPanel(page)
    await waitForDominantVideo(page)
    await dismissInterstitials(page)

    // Park the panel over the video before recording anything worth keeping.
    // The gif is cropped to the video, which keeps the comment column — real
    // people's handles and avatars — out of a file that ships in the repo.
    const stage = await videoRect(page)
    const parked = await panelRect(page)
    const handle = await control(page, '.drag-handle')
    await cursor.drag(handle, {
      x: stage.x + PAD + (handle.x - parked.x),
      y: stage.y + stage.h - parked.h - PAD + (handle.y - parked.y),
    })
    await page.waitForTimeout(1200)

    // Everything before this was setup; the gif starts here.
    const demoStart = (Date.now() - startedAt) / 1000

    await cursor.click(await control(page, '.speed-btn', '2×'))
    await page.waitForTimeout(1100)

    await cursor.click(await control(page, '.speed-btn', '1.5×'))
    await page.waitForTimeout(1000)

    await cursor.drag(
      await alongTrack(page, '.progress-track', 0.12),
      await alongTrack(page, '.progress-track', 0.68)
    )
    await page.waitForTimeout(1100)

    await cursor.drag(
      await alongTrack(page, '.volume-track', 0.15),
      await alongTrack(page, '.volume-track', 0.85)
    )
    await page.waitForTimeout(1200)

    await cursor.click(await control(page, '.play-pause-btn'))
    await page.waitForTimeout(900)
    await cursor.click(await control(page, '.play-pause-btn'))
    await page.waitForTimeout(1000)

    // The panel is draggable, which is easier to show than to describe.
    const grip = await control(page, '.drag-handle')
    await cursor.drag(grip, { x: grip.x, y: grip.y - stage.h / 2 + 40 })
    await page.waitForTimeout(1000)

    const demoEnd = (Date.now() - startedAt) / 1000
    const video = page.video()!
    await context.close()

    const raw = await video.path()
    const webm = path.join(VIDEO_DIR, 'demo.webm')
    fs.renameSync(raw, webm)
    // A reel is 9:16; a gif that tall is mostly wasted bytes. Keep the bottom
    // of the frame, where the panel sits, and enough of the video above it to
    // show that the playback really is responding.
    const width = Math.min(SIZE.width, Math.round(stage.w + PAD * 2))
    const height = Math.min(SIZE.height, Math.round(Math.min(stage.h + PAD * 2, width * 1.1)))
    const crop = {
      x: Math.max(0, Math.round(stage.x - PAD)),
      y: Math.max(0, Math.round(stage.y + stage.h + PAD - height)),
      w: width,
      h: height,
    }
    fs.writeFileSync(
      path.join(VIDEO_DIR, 'marks.json'),
      JSON.stringify({ webm, start: demoStart, duration: demoEnd - demoStart, crop }, null, 2)
    )

    expect(fs.statSync(webm).size).toBeGreaterThan(0)
    console.log(`recorded ${(demoEnd - demoStart).toFixed(1)}s of demo into ${webm}`)
  })
})
