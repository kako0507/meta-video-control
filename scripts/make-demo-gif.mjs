// Turns the webm from tests/e2e/demo.spec.ts into the gif the README embeds.
// GitHub only animates gifs in markdown, so the video itself is not shipped.
//
//   npm run demo
import { execFileSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { resolve } from 'path'

const VIDEO_DIR = resolve(process.cwd(), 'docs/.demo-video')
const MARKS = resolve(VIDEO_DIR, 'marks.json')
const OUT = resolve(process.cwd(), 'docs/demo.gif')

const WIDTH = 420
const FPS = 10

if (!existsSync(MARKS)) {
  console.error(`No recording at ${MARKS}. Run: npx playwright test --project=demo`)
  process.exit(1)
}

const { webm, start, duration, crop } = JSON.parse(readFileSync(MARKS, 'utf8'))
if (!existsSync(webm)) {
  console.error(`Recording is gone: ${webm}`)
  process.exit(1)
}

// palettegen/paletteuse: one palette for the whole clip. 64 colours and a
// coarse dither keep the file small — every frame of a cropped reel changes,
// so there is no static background for the gif encoder to lean on.
const filters = [
  ...(crop ? [`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`] : []),
  `fps=${FPS}`,
  `scale=${WIDTH}:-1:flags=lanczos`,
  'split[a][b]',
  '[a]palettegen=stats_mode=diff:max_colors=64[p]',
  '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
].join(',')

try {
  execFileSync(
    'ffmpeg',
    ['-y', '-ss', String(start), '-t', String(duration), '-i', webm, '-vf', filters, '-loop', '0', OUT],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  )
} catch (error) {
  const stderr = error.stderr?.toString() ?? ''
  console.error(stderr.split('\n').slice(-12).join('\n'))
  console.error(
    error.code === 'ENOENT'
      ? 'ffmpeg is not on PATH; install it to rebuild the demo gif.'
      : 'ffmpeg failed to convert the recording.'
  )
  process.exit(1)
}

const mb = statSync(OUT).size / 1024 / 1024
console.log(`wrote ${OUT} — ${mb.toFixed(1)} MB, ${duration.toFixed(1)}s at ${FPS}fps, ${WIDTH}px wide`)
if (mb > 8) console.warn('Over 8 MB: drop FPS or WIDTH before committing it.')
