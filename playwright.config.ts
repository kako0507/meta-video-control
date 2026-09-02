import { defineConfig } from '@playwright/test'

// Suites that drive the real instagram.com through a signed-in account.
const LIVE = ['**/reels-feed.spec.ts', '**/home-feed.spec.ts', '**/download.spec.ts']

// Records the README demo. Live too, but on demand rather than as part of a run.
const DEMO = ['**/demo.spec.ts']

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    browserName: 'chromium',
    headless: true,
  },
  projects: [
    {
      // Fixtures and the unpacked-extension tests: hermetic, safe to parallelise.
      name: 'offline',
      testIgnore: [...LIVE, ...DEMO],
    },
    {
      // One account, one live feed. Running these against Instagram concurrently
      // makes them flake on each other, so this project takes a single worker.
      name: 'live',
      testMatch: LIVE,
      fullyParallel: false,
    },
    {
      // `npm run demo` only. Writes docs/.demo-video, asserts almost nothing.
      name: 'demo',
      testMatch: DEMO,
      fullyParallel: false,
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4321 --outDir tests/e2e/fixtures',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
})
