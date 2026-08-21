import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createVideoDetector } from '../../src/content/video-detector'

function makeVideo(intersecting = true): HTMLVideoElement {
  const v = document.createElement('video')
  if (intersecting) v.dataset.testIntersecting = 'true'
  document.body.appendChild(v)
  return v
}

describe('createVideoDetector', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('calls onFound with existing video on start', () => {
    const video = makeVideo()
    const onFound = vi.fn()
    const onLost = vi.fn()
    const detector = createVideoDetector(onFound, onLost)
    detector.scan()
    expect(onFound).toHaveBeenCalledWith(video)
    detector.stop()
  })

  it('calls onFound when a video is added to DOM', async () => {
    const onFound = vi.fn()
    const onLost = vi.fn()
    const detector = createVideoDetector(onFound, onLost)
    const video = makeVideo()
    await new Promise(r => setTimeout(r, 0))
    detector.scan()
    expect(onFound).toHaveBeenCalledWith(video)
    detector.stop()
  })

  it('calls onLost when the tracked video is removed', () => {
    const video = makeVideo()
    const onFound = vi.fn()
    const onLost = vi.fn()
    const detector = createVideoDetector(onFound, onLost)
    detector.scan()
    expect(onFound).toHaveBeenCalledWith(video)
    video.remove()
    detector.scan()
    expect(onLost).toHaveBeenCalledWith(video)
    detector.stop()
  })

  it('does not call onFound twice for the same video', () => {
    const video = makeVideo()
    const onFound = vi.fn()
    const onLost = vi.fn()
    const detector = createVideoDetector(onFound, onLost)
    detector.scan()
    detector.scan()
    expect(onFound).toHaveBeenCalledTimes(1)
    detector.stop()
  })
})

describe('createVideoDetector reset', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('re-emits onFound on the next scan for a video that is still in the DOM', () => {
    const video = makeVideo()
    const onFound = vi.fn()
    const onLost = vi.fn()
    const detector = createVideoDetector(onFound, onLost)
    detector.scan()
    expect(onFound).toHaveBeenCalledTimes(1)

    detector.reset()
    detector.scan()

    expect(onFound).toHaveBeenCalledTimes(2)
    expect(onFound).toHaveBeenLastCalledWith(video)
    detector.stop()
  })

  it('does not report the video as lost when reset', () => {
    makeVideo()
    const onFound = vi.fn()
    const onLost = vi.fn()
    const detector = createVideoDetector(onFound, onLost)
    detector.scan()

    detector.reset()
    detector.scan()

    expect(onLost).not.toHaveBeenCalled()
    detector.stop()
  })
})

/** jsdom has no layout, so viewport geometry is stubbed per element. */
function placeVideo(video: HTMLVideoElement, top: number, height = 800) {
  video.getBoundingClientRect = () =>
    ({
      top, bottom: top + height, height, width: 400,
      left: 0, right: 400, x: 0, y: top, toJSON: () => ({}),
    }) as DOMRect
}

function makeVideoAt(top: number, height = 800): HTMLVideoElement {
  const video = document.createElement('video')
  placeVideo(video, top, height)
  document.body.appendChild(video)
  return video
}

describe('createVideoDetector viewport selection', () => {
  beforeEach(() => {
    window.innerHeight = 800
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('picks the video filling the viewport over an earlier one scrolled out of view', () => {
    makeVideoAt(-900)
    const onScreen = makeVideoAt(0)
    const onFound = vi.fn()
    const detector = createVideoDetector(onFound, vi.fn())

    detector.scan()

    // Identity, not toHaveBeenCalledWith: two bare <video> elements compare
    // as structurally equal, so a value check would pass either way.
    expect(onFound.mock.calls[0][0]).toBe(onScreen)
    detector.stop()
  })

  it('switches to the next reel once scrolling brings it into view', () => {
    const first = makeVideoAt(0)
    const second = makeVideoAt(800)
    const onFound = vi.fn()
    const detector = createVideoDetector(onFound, vi.fn())
    detector.scan()
    expect(onFound.mock.calls[0][0]).toBe(first)

    // The feed scrolls down one reel; both elements stay in the DOM.
    placeVideo(first, -800)
    placeVideo(second, 0)
    detector.scan()

    expect(onFound.mock.lastCall?.[0]).toBe(second)
    detector.stop()
  })
})
