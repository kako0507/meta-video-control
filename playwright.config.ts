import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npx vite preview --port 4321 --outDir tests/e2e/fixtures',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
})
