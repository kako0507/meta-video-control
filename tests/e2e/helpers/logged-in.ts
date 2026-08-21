import { test as base, BrowserContext, Page } from '@playwright/test'
import { readCredentials, launchExtensionContext, ensureLoggedIn } from './session'

export const credentials = readCredentials()

/** Chromium with the extension loaded, already signed in to Instagram. */
export const loggedInTest = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const context = await launchExtensionContext()
    await use(context)
    await context.close()
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage())
    if (credentials) await ensureLoggedIn(context, page, credentials)
    await use(page)
  },
})
