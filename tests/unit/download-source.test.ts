import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDownloadSource } from '../../src/content/download-source'
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

function setDuration(video: HTMLVideoElement, duration: number) {
  Object.defineProperty(video, 'duration', { value: duration, configurable: true })
}

afterEach(() => {
  indexes.splice(0).forEach(i => i.stop())
  document.body.innerHTML = ''
})

describe('createDownloadSource', () => {
  it('notifies the listener when the index gains entries', () => {
    const index = open()
    const video = videoInPost('AAA', 12.5)
    const source = createDownloadSource(video, index)
    const listener = vi.fn()
    source.subscribe(listener)

    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 12.5 }])

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies the listener on the video loadedmetadata event (regression for the real defect)', () => {
    const index = open()
    const video = videoInPost('AAA', NaN)
    const source = createDownloadSource(video, index)
    const listener = vi.fn()
    source.subscribe(listener)

    video.dispatchEvent(new Event('loadedmetadata'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies the listener on the video durationchange event', () => {
    const index = open()
    const video = videoInPost('AAA', NaN)
    const source = createDownloadSource(video, index)
    const listener = vi.fn()
    source.subscribe(listener)

    video.dispatchEvent(new Event('durationchange'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops notifying on all three sources once unsubscribed', () => {
    const index = open()
    const video = videoInPost('AAA', NaN)
    const source = createDownloadSource(video, index)
    const listener = vi.fn()
    const unsubscribe = source.subscribe(listener)

    unsubscribe()

    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 12.5 }])
    video.dispatchEvent(new Event('loadedmetadata'))
    video.dispatchEvent(new Event('durationchange'))

    expect(listener).not.toHaveBeenCalled()
  })

  it('resolves null while duration is NaN, then resolves once duration is set and a matching entry is indexed', () => {
    const index = open()
    const video = videoInPost('AAA', NaN)
    const source = createDownloadSource(video, index)

    // Mirrors the real failure sequence: index fills early, on a video whose
    // duration is not yet known.
    harvest([{ code: 'AAA', url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4', duration: 21.16 }])
    expect(source.current()).toBeNull()

    // Metadata arrives later.
    setDuration(video, 21.16)
    video.dispatchEvent(new Event('loadedmetadata'))

    expect(source.current()).toEqual({
      url: 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/a.mp4',
      filename: 'AAA.mp4',
    })
  })
})
