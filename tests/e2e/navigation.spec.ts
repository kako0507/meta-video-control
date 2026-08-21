import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'

const distDir = path.resolve(process.cwd(), 'dist')
const fixturesDir = path.resolve(process.cwd(), 'tests/e2e/fixtures')
const contentJs = readFileSync(path.resolve(distDir, 'content.js'), 'utf-8')

test.describe('SPA navigation', () => {
  test('panel reattaches after pushState navigation adds a new video', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached()

    await page.evaluate(() => {
      // Remove old video and panel to simulate SPA navigation teardown
      document.querySelector('video')?.remove()
      document.getElementById('ig-ctrl-host')?.remove()
      // Add new video before firing navigation event so scan() finds it
      const newVideo = document.createElement('video')
      newVideo.id = 'test-video-2'
      Object.defineProperty(newVideo, 'duration', { get: () => 20 })
      document.body.appendChild(newVideo)
      // Use popstate to trigger the URL watcher callback (pushState is blocked
      // on file:// pages due to same-origin restrictions)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await page.waitForTimeout(600)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached()
  })

  test('panel disappears when video is removed from DOM', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await expect(page.locator('#ig-ctrl-host')).toBeAttached()

    await page.evaluate(() => document.querySelector('video')?.remove())
    await page.waitForTimeout(100)
    await page.evaluate(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(400)
    await expect(page.locator('#ig-ctrl-host')).not.toBeAttached()
  })
})
