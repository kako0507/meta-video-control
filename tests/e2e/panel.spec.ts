import { test, expect } from '@playwright/test'
import path from 'path'
import { readFileSync } from 'fs'

const projectRoot = path.resolve(process.cwd())
const distDir = path.resolve(projectRoot, 'dist')
const fixturesDir = path.resolve(projectRoot, 'tests/e2e/fixtures')
const contentJs = readFileSync(path.resolve(distDir, 'content.js'), 'utf-8')

test.describe('Floating panel', () => {
  test('panel appears on a page with a video element (reels)', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    const panel = page.locator('#ig-ctrl-host')
    await expect(panel).toBeAttached()
  })

  test('clicking 2× speed button sets video.playbackRate to 2', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await page.locator('#ig-ctrl-host').evaluate(host => {
      const shadow = (host as Element).shadowRoot!
      const buttons = Array.from(shadow.querySelectorAll('.speed-btn'))
      const btn2x = buttons.find(b => b.textContent?.includes('2')) as HTMLButtonElement
      btn2x?.click()
    })
    const rate = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).playbackRate
    })
    expect(rate).toBe(2)
  })

  test('clicking play/pause button toggles paused state', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await page.locator('#ig-ctrl-host').evaluate(host => {
      const shadow = (host as Element).shadowRoot!
      const btn = shadow.querySelector('.play-pause-btn') as HTMLButtonElement
      btn?.click()
    })
    const paused = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).paused
    })
    expect(paused).toBe(false)
  })

  test('panel appears on Stories fixture', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/stories.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached()
  })

  test('panel appears on post fixture', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/post.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached()
  })
})
