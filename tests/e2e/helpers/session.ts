import { chromium, BrowserContext, Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const projectRoot = process.cwd()
const distDir = path.resolve(projectRoot, 'dist')
const authDir = path.resolve(projectRoot, 'tests/e2e/.auth')
const cookiesPath = path.resolve(authDir, 'cookies.json')

export interface Credentials {
  username: string
  password: string
}

/** Where ensureLoggedIn keeps the session it reuses. */
export const sessionFile = cookiesPath

/** Reads .env without pulling in a dependency. Returns null when unconfigured. */
export function readCredentials(): Credentials | null {
  const envPath = path.resolve(projectRoot, '.env')
  if (!fs.existsSync(envPath)) return null
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0 && !line.trimStart().startsWith('#')) {
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
  const { IG_USERNAME: username, IG_PASSWORD: password } = env
  return username && password ? { username, password } : null
}

/**
 * Chromium with the unpacked extension. Each context gets a throwaway profile
 * so specs can run in parallel — Chrome refuses to share one user-data-dir.
 * The Instagram session travels as cookies instead; see ensureLoggedIn.
 */
export async function launchExtensionContext(
  overrides: Parameters<typeof chromium.launchPersistentContext>[1] = {}
): Promise<BrowserContext> {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvc-ig-'))
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: !process.env.HEADED,
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--mute-audio',
    ],
    viewport: { width: 1280, height: 900 },
    ...overrides,
  })
  context.once('close', () => {
    // Windows keeps a handle on the profile for a moment after Chrome exits.
    // A leftover directory under the OS temp dir is harmless, so this is
    // best-effort rather than something worth failing a test over.
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      /* the OS reclaims it */
    }
  })
  return context
}

async function hasSession(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies('https://www.instagram.com')
  return cookies.some(c => c.name === 'sessionid' && c.value !== '')
}

/**
 * Reuses the saved session when there is one, so a normal run never touches
 * Instagram's login endpoint. Only a missing or expired session logs in.
 */
export async function ensureLoggedIn(context: BrowserContext, page: Page, creds: Credentials) {
  if (fs.existsSync(cookiesPath)) {
    await context.addCookies(JSON.parse(fs.readFileSync(cookiesPath, 'utf-8')))
    if (await hasSession(context)) return
  }

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' })
  const username = page.locator('#login_form input[name="email"]')
  await username.waitFor({ state: 'visible', timeout: 30000 })

  await username.click()
  await page.keyboard.type(creds.username, { delay: 80 })
  await page.locator('#login_form input[name="pass"]').click()
  await page.keyboard.type(creds.password, { delay: 80 })
  // The visible submit control is a styled div; the real <input type="submit">
  // is hidden, so submit the form from the password field instead.
  await page.keyboard.press('Enter')

  await page.waitForURL(/accounts\/onetap|instagram\.com\/($|\?)/, { timeout: 45000 })
  if (!(await hasSession(context))) {
    throw new Error(`Instagram login did not produce a session (landed on ${page.url()})`)
  }

  fs.mkdirSync(authDir, { recursive: true })
  fs.writeFileSync(cookiesPath, JSON.stringify(await context.cookies('https://www.instagram.com'), null, 2))
}

/**
 * Instagram interrupts the feed with "Turn on Notifications" and similar
 * modals. They cover the feed and swallow scrolls, so tests clear them first.
 */
export async function dismissInterstitials(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen: string[] = []
    for (const dialog of document.querySelectorAll('div[role="dialog"]')) {
      seen.push((dialog.textContent || '').slice(0, 40))
      const button = Array.from(dialog.querySelectorAll('button')).find(b =>
        /not now|cancel|dismiss|later/i.test(b.textContent || '')
      )
      button?.click()
    }
    return seen
  })
}
