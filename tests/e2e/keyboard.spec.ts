import { test, expect } from '@playwright/test'
import path from 'path'
import { readFileSync } from 'fs'

const projectRoot = path.resolve(process.cwd())
const distDir = path.resolve(projectRoot, 'dist')
const fixturesDir = path.resolve(projectRoot, 'tests/e2e/fixtures')
const contentJs = readFileSync(path.resolve(distDir, 'content.js'), 'utf-8')

test.describe('Keyboard shortcuts', () => {
  test('Space key toggles play/pause (video.paused becomes false)', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await page.click('body')
    await page.keyboard.press('Space')
    const paused = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).paused
    })
    expect(paused).toBe(false)
  })

  test('ArrowRight seeks forward 5s (currentTime goes from 0 to 5)', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await page.click('body')
    await page.keyboard.press('ArrowRight')
    const currentTime = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).currentTime
    })
    expect(currentTime).toBe(5)
  })

  test('Period key increases playbackRate by 0.25 (from 1 to 1.25)', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    await page.click('body')
    await page.keyboard.press('.')
    const rate = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).playbackRate
    })
    expect(rate).toBe(1.25)
  })

  test('m key toggles mute (video.muted starts true, becomes false)', async ({ page }) => {
    await page.goto(`file://${fixturesDir}/reels.html`)
    await page.waitForSelector('video')
    await page.evaluate(contentJs)
    await page.waitForTimeout(500)
    // Verify initial muted state from the HTML muted attribute
    const initialMuted = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).muted
    })
    expect(initialMuted).toBe(true)
    await page.click('body')
    await page.keyboard.press('m')
    const muted = await page.evaluate(() => {
      return (document.getElementById('test-video') as HTMLVideoElement).muted
    })
    expect(muted).toBe(false)
  })
})
