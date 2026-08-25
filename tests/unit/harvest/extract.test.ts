import { describe, it, expect } from 'vitest'
import { extractMedia } from '../../../src/harvest/extract'

const mpd = (duration: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><MPD mediaPresentationDuration="${duration}"></MPD>`

const node = (code: string, url: string, duration: string) => ({
  code,
  video_versions: [{ type: 101, url }],
  video_dash_manifest: mpd(duration),
})

describe('extractMedia', () => {
  it('finds an entry for a real-shape node (dash manifest, no video_duration)', () => {
    const realNode = {
      code: 'REAL',
      video_versions: [{ type: 101, url: 'https://cdn/real.mp4' }],
      video_dash_manifest: mpd('PT39.066666S'),
    }

    expect(extractMedia(realNode)).toEqual([
      { code: 'REAL', url: 'https://cdn/real.mp4', duration: 39.066666 },
    ])
  })

  it('parses PT39.066666S to 39.066666 seconds', () => {
    const payload = node('AAA', 'https://cdn/a.mp4', 'PT39.066666S')
    expect(extractMedia(payload)[0].duration).toBeCloseTo(39.066666, 6)
  })

  it('parses PT1M19.5S (minutes and seconds) to 79.5 seconds', () => {
    const payload = node('AAA', 'https://cdn/a.mp4', 'PT1M19.5S')
    expect(extractMedia(payload)[0].duration).toBeCloseTo(79.5, 6)
  })

  it('parses an hours form such as PT1H2M3S to 3723 seconds', () => {
    const payload = node('AAA', 'https://cdn/a.mp4', 'PT1H2M3S')
    expect(extractMedia(payload)[0].duration).toBeCloseTo(3723, 6)
  })

  it('finds a media node nested anywhere in the response', () => {
    const payload = {
      data: { xdt_api: { edges: [{ node: node('AAA', 'https://cdn/a.mp4', 'PT12.5S') }] } },
    }

    expect(extractMedia(payload)).toEqual([
      { code: 'AAA', url: 'https://cdn/a.mp4', duration: 12.5 },
    ])
  })

  it('finds every media node in one response', () => {
    const payload = [
      node('AAA', 'https://cdn/a.mp4', 'PT12.5S'),
      node('BBB', 'https://cdn/b.mp4', 'PT3S'),
    ]

    expect(extractMedia(payload).map(e => e.code)).toEqual(['AAA', 'BBB'])
  })

  it('yields one entry per video of a carousel sharing a code', () => {
    const payload = {
      code: 'CAR',
      carousel_media: [
        {
          code: 'CAR',
          video_versions: [{ url: 'https://cdn/1.mp4' }],
          video_dash_manifest: mpd('PT4S'),
        },
        {
          code: 'CAR',
          video_versions: [{ url: 'https://cdn/2.mp4' }],
          video_dash_manifest: mpd('PT9S'),
        },
      ],
    }

    expect(extractMedia(payload)).toEqual([
      { code: 'CAR', url: 'https://cdn/1.mp4', duration: 4 },
      { code: 'CAR', url: 'https://cdn/2.mp4', duration: 9 },
    ])
  })

  it('takes the first version, which is the highest quality Instagram offers', () => {
    const payload = {
      code: 'AAA',
      video_versions: [{ url: 'https://cdn/best.mp4' }, { url: 'https://cdn/worse.mp4' }],
      video_dash_manifest: mpd('PT5S'),
    }

    expect(extractMedia(payload)[0].url).toBe('https://cdn/best.mp4')
  })

  it('ignores a node with no video_versions', () => {
    expect(extractMedia({ code: 'AAA', video_dash_manifest: mpd('PT5S') })).toEqual([])
  })

  it('ignores a node with no video_dash_manifest, since duration could never be verified', () => {
    expect(extractMedia({ code: 'AAA', video_versions: [{ url: 'https://cdn/a.mp4' }] })).toEqual([])
  })

  it('ignores a node whose manifest has no mediaPresentationDuration attribute', () => {
    const payload = {
      code: 'AAA',
      video_versions: [{ url: 'https://cdn/a.mp4' }],
      video_dash_manifest: '<?xml version="1.0" encoding="UTF-8"?><MPD></MPD>',
    }

    expect(extractMedia(payload)).toEqual([])
  })

  it('ignores a node whose duration attribute is unparseable garbage', () => {
    const payload = {
      code: 'AAA',
      video_versions: [{ url: 'https://cdn/a.mp4' }],
      video_dash_manifest: mpd('not-a-duration'),
    }

    expect(extractMedia(payload)).toEqual([])
  })

  it('survives values that are not objects', () => {
    expect(extractMedia(null)).toEqual([])
    expect(extractMedia('a string')).toEqual([])
    expect(extractMedia(42)).toEqual([])
  })
})
