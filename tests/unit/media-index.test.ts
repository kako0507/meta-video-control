import { describe, it, expect, vi, afterEach } from 'vitest'
import { createMediaIndex } from '../../src/content/media-index'
import { startHarvesting } from '../../src/harvest/entry'
import { BRIDGE_MARKER } from '../../src/harvest/bridge'

/** Polls until the predicate holds, or gives up once the timeout elapses. */
async function waitUntil(predicate: () => boolean, timeout = 500, interval = 5) {
  const deadline = Date.now() + timeout
  while (!predicate() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

const entry = (code: string, url: string, duration: number) => ({ code, url, duration })

// Instagram carries duration only inside the DASH manifest's
// mediaPresentationDuration attribute, never on a video_duration field.
const mpd = (duration: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><MPD mediaPresentationDuration="${duration}"></MPD>`

/** Delivers a message the way the MAIN world script does. */
function postEntries(entries: ReturnType<typeof entry>[]) {
  window.dispatchEvent(
    new MessageEvent('message', { source: window, data: { marker: BRIDGE_MARKER, entries } })
  )
}

const indexes: { stop: () => void }[] = []
const open = () => {
  const index = createMediaIndex()
  indexes.push(index)
  return index
}

const harvestStops: (() => void)[] = []
const harvest = () => {
  const stop = startHarvesting()
  harvestStops.push(stop)
  return stop
}

// jsdom's window.postMessage never populates MessageEvent.source (an
// unimplemented TODO in jsdom's Window.js: it constructs the MessageEvent
// with only `{ data: message }`), so a genuine same-window post can never
// satisfy this codebase's `event.source !== window` checks in a test — a
// real browser does set it. Patch it in, for one test, so the real
// cross-module handshake between startHarvesting() and createMediaIndex()
// can be exercised end-to-end instead of being simulated by hand.
let restorePostMessage: (() => void) | null = null
function withGenuineSource() {
  const original = window.postMessage.bind(window)
  window.postMessage = ((message: unknown) => {
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message, source: window }))
    }, 0)
  }) as typeof window.postMessage
  restorePostMessage = () => {
    window.postMessage = original
  }
}

afterEach(() => {
  indexes.splice(0).forEach(i => i.stop())
  harvestStops.splice(0).forEach(stop => stop())
  restorePostMessage?.()
  restorePostMessage = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createMediaIndex', () => {
  it('knows nothing before anything is harvested', () => {
    expect(open().entriesFor('AAA')).toEqual([])
  })

  it('stores entries delivered over the bridge', () => {
    const index = open()

    postEntries([entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)])

    expect(index.entriesFor('AAA')).toEqual([entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)])
  })

  it('keeps every video of a carousel under its shared code', () => {
    const index = open()

    postEntries([entry('CAR', 'https://example.fbcdn.net/1.mp4', 4), entry('CAR', 'https://example.fbcdn.net/2.mp4', 9)])

    expect(index.entriesFor('CAR')).toHaveLength(2)
  })

  it('does not duplicate an entry delivered twice', () => {
    const index = open()

    postEntries([entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)])
    postEntries([entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)])

    expect(index.entriesFor('AAA')).toHaveLength(1)
  })

  it('collapses entries that share a url pathname but carry different rotating signatures (regression)', () => {
    const index = open()

    postEntries([
      entry(
        'AAA',
        'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX.mp4?efg=abc&oe=6A8EF16C',
        21.16
      ),
      entry(
        'AAA',
        'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX.mp4?efg=xyz&oe=6A8EF16D',
        21.16
      ),
    ])

    expect(index.entriesFor('AAA')).toHaveLength(1)
  })

  it('keeps a carousel entries separate when url paths differ', () => {
    const index = open()

    postEntries([
      entry('CAR', 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX.mp4?oe=6A8EF16C', 4),
      entry('CAR', 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPY.mp4?oe=6A8EF16C', 9),
    ])

    expect(index.entriesFor('CAR')).toHaveLength(2)
  })

  it('handles an entry whose url does not parse as a URL without throwing', () => {
    const index = open()

    // The bridge's own validation (src/harvest/bridge.ts) already requires a
    // parseable https url from an allow-listed host, so a genuinely
    // unparseable url can never reach the index in production. To exercise
    // the index's own defensive try/catch around `new URL(...)` anyway, let
    // the bridge's validation call through to the real URL constructor
    // (first call) and make every subsequent call throw, simulating a url
    // that fails to parse once inside the index's own dedupe key logic.
    const RealURL = URL
    let calls = 0
    vi.stubGlobal(
      'URL',
      function (this: unknown, ...args: [string, (string | URL)?]) {
        calls += 1
        if (calls === 1) return new RealURL(...args)
        throw new TypeError(`Invalid URL: ${String(args[0])}`)
      } as unknown as typeof URL
    )

    const url = 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX.mp4?oe=6A8EF16C'

    expect(() => postEntries([entry('AAA', url, 5)])).not.toThrow()
    expect(index.entriesFor('AAA')).toEqual([entry('AAA', url, 5)])
  })

  it('notifies subscribers when entries arrive', () => {
    const index = open()
    const listener = vi.fn()
    index.subscribe(listener)

    postEntries([entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)])

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops notifying an unsubscribed listener', () => {
    const index = open()
    const listener = vi.fn()
    index.subscribe(listener)()

    postEntries([entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)])

    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores a message that carries no marker of ours', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { entries: [entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)] },
      })
    )

    expect(index.entriesFor('AAA')).toEqual([])
  })

  it('ignores a message that did not come from this window', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: null,
        data: { marker: BRIDGE_MARKER, entries: [entry('AAA', 'https://example.fbcdn.net/a.mp4', 12.5)] },
      })
    )

    expect(index.entriesFor('AAA')).toEqual([])
  })

  it('rejects a message with an entry missing code', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { marker: BRIDGE_MARKER, entries: [{ url: 'https://example.fbcdn.net/a.mp4', duration: 12.5 }] },
      })
    )

    expect(index.entriesFor('AAA')).toEqual([])
  })

  it('rejects a message with an entry whose duration is a string', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { marker: BRIDGE_MARKER, entries: [{ code: 'AAA', url: 'https://example.fbcdn.net/a.mp4', duration: '12.5' }] },
      })
    )

    expect(index.entriesFor('AAA')).toEqual([])
  })

  it('rejects a url on an untrusted domain', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { marker: BRIDGE_MARKER, entries: [entry('AAA', 'https://evil.com/x.mp4', 12.5)] },
      })
    )

    expect(index.entriesFor('AAA')).toEqual([])
  })

  it('rejects a url with fbcdn.net as a query parameter (not hostname)', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { marker: BRIDGE_MARKER, entries: [entry('AAA', 'https://evil.com/?x=fbcdn.net', 12.5)] },
      })
    )

    expect(index.entriesFor('AAA')).toEqual([])
  })

  it('accepts a valid fbcdn.net url', () => {
    const index = open()

    postEntries([entry('AAA', 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX.mp4', 12.5)])

    expect(index.entriesFor('AAA')).toEqual([entry('AAA', 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX.mp4', 12.5)])
  })

  it('accepts a valid cdninstagram.com url', () => {
    const index = open()

    postEntries([entry('BBB', 'https://scontent-iad3-2.cdninstagram.com/x/y/z.mp4', 8.0)])

    expect(index.entriesFor('BBB')).toEqual([entry('BBB', 'https://scontent-iad3-2.cdninstagram.com/x/y/z.mp4', 8.0)])
  })

  it('still holds entries published before the index existed (regression for the replay defect)', async () => {
    withGenuineSource()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({
        code: 'AAA',
        video_dash_manifest: mpd('PT12.5S'),
        video_versions: [{ url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4' }],
      })))
    )
    harvest()

    await fetch('/graphql')
    // Let the (lost) publish attempt run its course before any index exists.
    await new Promise(resolve => setTimeout(resolve, 50))

    const index = open()
    await waitUntil(() => index.entriesFor('AAA').length > 0)

    expect(index.entriesFor('AAA')).toEqual([
      { code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 12.5 },
    ])
  })

  it('rejects the whole message when one entry is malformed', () => {
    const index = open()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          marker: BRIDGE_MARKER,
          entries: [
            entry('GOOD', 'https://example.fbcdn.net/a.mp4', 5),
            { code: 'BAD', url: 'https://evil.com/b.mp4', duration: 10 },
            entry('ALSO_GOOD', 'https://example.cdninstagram.com/c.mp4', 3),
          ],
        },
      })
    )

    // All entries should be rejected because one was malformed
    expect(index.entriesFor('GOOD')).toEqual([])
    expect(index.entriesFor('BAD')).toEqual([])
    expect(index.entriesFor('ALSO_GOOD')).toEqual([])
  })
})
