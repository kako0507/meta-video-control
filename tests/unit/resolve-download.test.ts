import { describe, it, expect, afterEach } from 'vitest'
import { resolveDownloadFor } from '../../src/content/resolve-download'
import { createMediaIndex } from '../../src/content/media-index'
import { BRIDGE_MARKER } from '../../src/harvest/bridge'

const indexes: { stop: () => void }[] = []
const open = () => {
  const index = createMediaIndex()
  indexes.push(index)
  return index
}

function harvest(entries: { code: string; url: string; duration: number }[]) {
  window.dispatchEvent(
    new MessageEvent('message', { source: window, data: { marker: BRIDGE_MARKER, entries } })
  )
}

function videoInPost(code: string | null, duration: number): HTMLVideoElement {
  const article = document.createElement('article')
  article.innerHTML = code ? `<video></video><a href="/p/${code}/">t</a>` : '<video></video>'
  document.body.appendChild(article)
  const video = article.querySelector('video') as HTMLVideoElement
  Object.defineProperty(video, 'duration', { value: duration, configurable: true })
  return video
}

afterEach(() => {
  indexes.splice(0).forEach(i => i.stop())
  document.body.innerHTML = ''
})

describe('resolveDownloadFor', () => {
  it('resolves the entry whose duration matches the video on screen', () => {
    const index = open()
    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 12.5 }])

    expect(resolveDownloadFor(videoInPost('AAA', 12.5), index)).toEqual({
      url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4',
      filename: 'AAA.mp4',
    })
  })

  it('accepts the drift between a container duration and the element one', () => {
    const index = open()
    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 21.24 }])

    expect(resolveDownloadFor(videoInPost('AAA', 21.16), index)).not.toBeNull()
  })

  it('refuses an entry more than half a second away from the video', () => {
    const index = open()
    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 14 }])

    expect(resolveDownloadFor(videoInPost('AAA', 12.5), index)).toBeNull()
  })

  it('picks the matching video out of a carousel sharing one code', () => {
    const index = open()
    harvest([
      { code: 'CAR', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 4 },
      { code: 'CAR', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 9 },
    ])

    expect(resolveDownloadFor(videoInPost('CAR', 9), index)?.url).toBe('https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4')
  })

  it('resolves nothing while the code is still unharvested', () => {
    expect(resolveDownloadFor(videoInPost('AAA', 12.5), open())).toBeNull()
  })

  it('resolves nothing when the post carries no permalink to identify it', () => {
    const index = open()
    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 12.5 }])

    expect(resolveDownloadFor(videoInPost(null, 12.5), index)).toBeNull()
  })

  it('resolves nothing while the video has no duration to check against', () => {
    const index = open()
    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 12.5 }])

    expect(resolveDownloadFor(videoInPost('AAA', NaN), index)).toBeNull()
  })

  it('resolves nothing when two entries both fall within tolerance', () => {
    const index = open()
    harvest([
      { code: 'DUO', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 4.0 },
      { code: 'DUO', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 4.3 },
    ])

    expect(resolveDownloadFor(videoInPost('DUO', 4.25), index)).toBeNull()
  })

  it('resolves the one matching entry even when others exist', () => {
    const index = open()
    harvest([
      { code: 'TRI', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 2.0 },
      { code: 'TRI', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 5.5 },
      { code: 'TRI', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/3.mp4', duration: 10.0 },
    ])

    expect(resolveDownloadFor(videoInPost('TRI', 5.5), index)?.url).toBe('https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4')
  })

  it('resolves the inside entry when one entry is outside tolerance', () => {
    const index = open()
    harvest([
      { code: 'MIX', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 3.0 },
      { code: 'MIX', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 8.0 },
    ])

    expect(resolveDownloadFor(videoInPost('MIX', 8.1), index)?.url).toBe('https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4')
  })

  it('resolves a download when five entries are all copies of the same video', () => {
    const index = open()
    harvest([
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/3.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/4.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/5.mp4', duration: 21.16 },
    ])

    expect(resolveDownloadFor(videoInPost('DUP', 21.16), index)).not.toBeNull()
  })

  it('prefers the most recently harvested url among copies of the same video', () => {
    const index = open()
    harvest([
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/3.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/4.mp4', duration: 21.16 },
      { code: 'DUP', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/5.mp4', duration: 21.16 },
    ])

    expect(resolveDownloadFor(videoInPost('DUP', 21.16), index)?.url).toBe('https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/5.mp4')
  })

  it('resolves nothing when two entries within tolerance differ by 0.05s, since those are different videos', () => {
    const index = open()
    harvest([
      { code: 'DIF', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 21.16 },
      { code: 'DIF', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 21.21 },
    ])

    expect(resolveDownloadFor(videoInPost('DIF', 21.18), index)).toBeNull()
  })

  it('resolves nothing when two entries differ by more than the duration-grouping epsilon but well within tolerance', () => {
    const index = open()
    harvest([
      { code: 'EPS', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/1.mp4', duration: 21.160 },
      { code: 'EPS', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/2.mp4', duration: 21.165 },
    ])

    expect(resolveDownloadFor(videoInPost('EPS', 21.16), index)).toBeNull()
  })
})
