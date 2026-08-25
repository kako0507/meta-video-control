import { describe, it, expect, vi, afterEach } from 'vitest'
import { startHarvesting } from '../../../src/harvest/entry'
import { BRIDGE_MARKER, BRIDGE_READY_MARKER } from '../../../src/harvest/bridge'

const stops: (() => void)[] = []
const start = () => {
  const stop = startHarvesting()
  stops.push(stop)
  return stop
}

const cleanups: (() => void)[] = []

/** Collects what the harvester posts back into this window. */
function collectPosted(): { posted: { code: string }[]; cleanup: () => void } {
  const posted: { code: string }[] = []
  const listener = (event: MessageEvent) => {
    if (event.data?.marker === BRIDGE_MARKER) posted.push(...event.data.entries)
  }
  window.addEventListener('message', listener)
  return { posted, cleanup: () => window.removeEventListener('message', listener) }
}

/** Polls until the predicate holds, or gives up once the timeout elapses. */
async function waitUntil(predicate: () => boolean, timeout = 500, interval = 5) {
  const deadline = Date.now() + timeout
  while (!predicate() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

// Instagram carries duration only inside the DASH manifest's
// mediaPresentationDuration attribute, never on a video_duration field.
const mpd = (duration: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><MPD mediaPresentationDuration="${duration}"></MPD>`

const payload = {
  code: 'AAA',
  video_dash_manifest: mpd('PT12.5S'),
  video_versions: [{ url: 'https://cdn/a.mp4' }],
}

const cdnPayload = {
  code: 'BBB',
  video_dash_manifest: mpd('PT7S'),
  video_versions: [{ url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4' }],
}

// jsdom's window.postMessage never populates MessageEvent.source (it's an
// unimplemented TODO in jsdom's Window.js), so a genuine self-post can never
// satisfy this codebase's `event.source !== window` checks inside a test.
// Simulate the announcement the way the isolated world's real postMessage
// would be observed, with source correctly set.
const announce = () =>
  window.dispatchEvent(
    new MessageEvent('message', { source: window, data: { marker: BRIDGE_READY_MARKER } })
  )

afterEach(async () => {
  stops.splice(0).forEach(stop => stop())
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // A test that never polled for its own message (e.g. the untouched-body
  // test still runs its fetch through the patched interceptor) can leave a
  // postMessage dispatch in flight. Let it settle here, with no listener
  // attached, before the next test registers one.
  await new Promise(resolve => setTimeout(resolve, 50))
})

describe('startHarvesting', () => {
  it('posts the media found in a fetch response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(payload)))
    )
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    await fetch('/graphql')
    await waitUntil(() => posted.length > 0)

    expect(posted).toEqual([{ code: 'AAA', url: 'https://cdn/a.mp4', duration: 12.5 }])
  })

  it('hands the caller the response untouched, body still readable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(payload)))
    )
    start()

    const body = await (await fetch('/graphql')).json()

    expect(body.code).toBe('AAA')
  })

  it('says nothing about a response that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>')))
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    await fetch('/page')
    // No condition to poll for on a negative assertion: wait out a bounded
    // settle period longer than jsdom's postMessage dispatch (a setTimeout(0)).
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(posted).toEqual([])
  })

  it('reads the media the document was rendered with', async () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.textContent = JSON.stringify(payload)
    document.body.appendChild(script)
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)

    start()
    await waitUntil(() => posted.length > 0)

    expect(posted).toEqual([{ code: 'AAA', url: 'https://cdn/a.mp4', duration: 12.5 }])
  })

  it('restores the original fetch when stopped', () => {
    const original = vi.fn()
    vi.stubGlobal('fetch', original)

    start()()

    expect(window.fetch).toBe(original)
  })

  it('republishes previously-published entries when it hears the announcement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(cdnPayload)))
    )
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    await fetch('/graphql')
    await waitUntil(() => posted.length > 0)
    expect(posted).toHaveLength(1)

    announce()
    await waitUntil(() => posted.length > 1)

    expect(posted).toEqual([
      { code: 'BBB', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 7 },
      { code: 'BBB', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 7 },
    ])
  })

  it('ignores an announcement whose source is not this window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(cdnPayload)))
    )
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    await fetch('/graphql')
    await waitUntil(() => posted.length > 0)
    expect(posted).toHaveLength(1)

    window.dispatchEvent(
      new MessageEvent('message', { source: null, data: { marker: BRIDGE_READY_MARKER } })
    )
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(posted).toHaveLength(1)
  })

  it('does not republish when the buffer is empty', async () => {
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    announce()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(posted).toEqual([])
  })

  it('publishes nothing on a ready announcement when the buffer and the document are both empty', async () => {
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    // Nothing was ever fetched, and no script tag carries media: the
    // re-scan the announcement triggers has nothing to find either.
    announce()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(posted).toEqual([])
  })

  it('publishes media that lands in the document only after the initial scan already ran', async () => {
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    start()

    // Let the startup scan (queued at document_start, over the still-empty
    // document) run and finish first — mirroring a real permalink page,
    // where DOMContentLoaded fires before Instagram streams in the
    // ScheduledServerJS block carrying that page's own media.
    await new Promise(resolve => setTimeout(resolve, 0))

    const script = document.createElement('script')
    script.type = 'application/json'
    script.textContent = JSON.stringify(payload)
    document.body.appendChild(script)

    // The index announces itself only once it is listening, at
    // document_idle — by which time, on the real site, that block has
    // already arrived. The ready handshake is the harvester's only chance
    // to notice it.
    announce()
    await waitUntil(() => posted.length > 0)

    expect(posted).toEqual([
      { code: 'AAA', url: 'https://cdn/a.mp4', duration: 12.5 },
      { code: 'AAA', url: 'https://cdn/a.mp4', duration: 12.5 },
    ])
  })

  it('produces nothing after stop when an announcement arrives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(cdnPayload)))
    )
    const { posted, cleanup } = collectPosted()
    cleanups.push(cleanup)
    const stop = start()

    await fetch('/graphql')
    await waitUntil(() => posted.length > 0)
    expect(posted).toHaveLength(1)

    stop()
    announce()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(posted).toHaveLength(1)
  })
})
