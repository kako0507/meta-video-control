# Meta Video Control

A Chrome extension that adds a floating control panel to Instagram, giving you full control over video playback — speed, progress scrubbing, play/pause, and volume — all without being blocked by Instagram's overlay divs.

## Features

- **Speed presets** — 0.5×, 1×, 1.5×, 2×, 3×
- **Progress bar** — drag to scrub, shows live time preview while dragging
- **Play / Pause** button
- **Volume slider** — drag to set, click mute icon to toggle
- **Download** — save the video as an MP4, on reel and post permalinks
- **Draggable panel** — reposition anywhere on screen; position is remembered across sessions
- **Keyboard shortcuts** — works on all Instagram video types

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` | Seek −5s |
| `→` | Seek +5s |
| `↑` | Volume +10% |
| `↓` | Volume −10% |
| `,` or `<` | Speed −0.25× |
| `.` or `>` | Speed +0.25× |
| `M` | Toggle mute |

Shortcuts are intercepted before Instagram's own handlers and do not fire when a text input is focused.

### Supported pages

- Reels (`/reels/`)
- Stories (`/stories/`)
- Regular post videos

### Where downloads are offered

The video element is fed by MediaSource, so its `blob:` URL cannot be fetched. The
download button instead reads the progressive MP4 that Instagram embeds in the page's
media JSON — already muxed, audio included.

That JSON is the payload the document was rendered with, and there is no field tying a
block to a particular video on the page. So the button appears only on a permalink —
`/reel/<code>/`, `/reels/<code>/` or `/p/<code>/` — and withdraws as soon as the feed
scrolls to a different video, rather than risk saving something other than what is on
screen. Feed videos would need the page's GraphQL responses intercepted, which a content
script cannot see from its isolated world.

## Installation

### From source

1. Clone this repository
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the `dist/` folder
6. Navigate to [instagram.com](https://www.instagram.com) — the panel appears automatically when a video is detected

### Updating

After pulling new changes, rebuild and Chrome will hot-reload the extension:
```bash
npm run build
```

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Build and watch for changes
npm run build:watch

# Run unit tests (Vitest)
npm run test:unit

# Run E2E tests (Playwright) — headless by default
npm run test:e2e

# Run the suites that drive a signed-in instagram.com (needs .env)
npm run test:e2e:live

# Watch a browser while the E2E tests run
HEADED=1 npx playwright test

# Run all tests
npm test
```

#### Tests against a live Instagram session

`reels-feed.spec.ts`, `home-feed.spec.ts` and `download.spec.ts` drive the real
logged-in site, which is the only way to reach the multi-video behaviour the panel has to
cope with. They form the `live` Playwright project and run on a single worker — one
account cannot serve several browsers at once without them flaking on each other — and
they **skip themselves** unless an account is configured:

```bash
cp .env.example .env   # then fill in IG_USERNAME / IG_PASSWORD
```

The session is saved to `tests/e2e/.auth/cookies.json` and reused, so a normal run never
touches Instagram's login endpoint. Both `.env` and that directory are gitignored — never
commit them.

These two suites depend on whatever the live feed happens to serve. `no further video
scrolled into view` usually means the feed had no video in reach, not that the extension
broke.

### Project structure

```
src/
├── content/
│   ├── index.ts            # Entry point — wires all modules
│   ├── url-watcher.ts      # SPA navigation detection (Navigation API)
│   ├── post-media.ts       # Resolves the downloadable MP4 for a permalink
│   ├── video-detector.ts   # MutationObserver — finds <video> elements
│   └── video-controller.ts # Owns one video + its panel lifecycle
├── panel/
│   ├── store.ts            # Flux reducer (pure, no side effects)
│   ├── mount.ts            # Shadow DOM host creation + React root
│   ├── Panel.tsx           # Root component — Flux store, side effects, drag
│   ├── SpeedPresets.tsx
│   ├── ProgressBar.tsx
│   ├── PlayPause.tsx
│   ├── VolumeSlider.tsx
│   ├── DownloadButton.tsx
│   └── panel.css           # Instagram gradient theme
└── keyboard/
    └── keyboard-handler.ts # Capture-phase keyboard shortcuts

tests/
├── unit/                   # Vitest, jsdom
└── e2e/                    # Playwright
    ├── extension.spec.ts   # Loads the unpacked extension in Chrome
    ├── download.spec.ts    # Saves a real MP4 and checks its tracks
    ├── reels-feed.spec.ts  # Live reels feed (needs .env)
    ├── home-feed.spec.ts   # Live home feed (needs .env)
    ├── fixtures/           # Offline HTML pages
    └── helpers/            # Login, feed inspection, panel helpers
```

### How it works

Instagram's `<video>` element is covered by a transparent overlay `<div>`, making the native browser controls unreachable. This extension injects its own panel using a **Shadow DOM** host element at `z-index: 2147483647`, well above all Instagram overlays.

State is managed with a **Flux pattern** — a pure `videoReducer` is the single source of truth. User actions dispatch to the reducer *and* write side effects to the video element. Video events (`timeupdate`, `play`, `pause`, etc.) dispatch a `SYNC` action that reads from the video but never writes back, preventing feedback loops.

Instagram is a SPA, so the extension watches for navigation with the **Navigation API** (`navigation`'s `navigate` event), which also covers back/forward. A content script runs in an isolated world, where patching `history.pushState` is invisible to the page's own calls — that patch survives only as a fallback for environments without the Navigation API.

A `MutationObserver` watches for `<video>` elements appearing in or disappearing from the DOM. Feeds keep every post scrolled past still mounted, so DOM order says nothing about what is being watched: the detector binds to the **video covering most of the viewport**, and rebinds whenever that changes.

## License

MIT — see [LICENSE](LICENSE).
