import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createKeyboardHandler } from '../../src/keyboard/keyboard-handler'

function makeVideo(): HTMLVideoElement {
  const v = document.createElement('video') as any
  v.currentTime = 10
  Object.defineProperty(v, 'duration', { value: 60, writable: true, configurable: true })
  v.volume = 0.5
  v.muted = false
  v.playbackRate = 1
  Object.defineProperty(v, 'paused', { value: true, writable: true, configurable: true })
  v.play = vi.fn().mockResolvedValue(undefined)
  v.pause = vi.fn()
  return v as HTMLVideoElement
}

function fire(key: string, extra: Partial<KeyboardEventInit> = {}) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
  document.dispatchEvent(e)
  return e
}

describe('createKeyboardHandler', () => {
  let video: HTMLVideoElement
  let getVideo: () => HTMLVideoElement | null
  let stop: () => void

  beforeEach(() => {
    video = makeVideo()
    getVideo = () => video
    stop = createKeyboardHandler(getVideo)
  })

  afterEach(() => stop())

  it('Space calls play() when paused', () => {
    fire(' ')
    expect(video.play).toHaveBeenCalled()
  })

  it('Space calls pause() when playing', () => {
    ;(video as any).paused = false
    fire(' ')
    expect(video.pause).toHaveBeenCalled()
  })

  it('ArrowRight seeks +5s', () => {
    fire('ArrowRight')
    expect(video.currentTime).toBe(15)
  })

  it('ArrowLeft seeks -5s', () => {
    fire('ArrowLeft')
    expect(video.currentTime).toBe(5)
  })

  it('ArrowRight clamps to duration', () => {
    ;(video as any).currentTime = 58
    fire('ArrowRight')
    expect(video.currentTime).toBe(60)
  })

  it('ArrowLeft clamps to 0', () => {
    ;(video as any).currentTime = 2
    fire('ArrowLeft')
    expect(video.currentTime).toBe(0)
  })

  it('ArrowUp increases volume by 0.1', () => {
    fire('ArrowUp')
    expect(video.volume).toBeCloseTo(0.6)
  })

  it('ArrowDown decreases volume by 0.1', () => {
    fire('ArrowDown')
    expect(video.volume).toBeCloseTo(0.4)
  })

  it('. increases playbackRate by 0.25', () => {
    fire('.')
    expect(video.playbackRate).toBe(1.25)
  })

  it(', decreases playbackRate by 0.25', () => {
    fire(',')
    expect(video.playbackRate).toBe(0.75)
  })

  it('playbackRate clamps to minimum 0.25', () => {
    ;(video as any).playbackRate = 0.25
    fire(',')
    expect(video.playbackRate).toBe(0.25)
  })

  it('playbackRate clamps to maximum 4', () => {
    ;(video as any).playbackRate = 4
    fire('.')
    expect(video.playbackRate).toBe(4)
  })

  it('m toggles mute', () => {
    fire('m')
    expect(video.muted).toBe(true)
    fire('m')
    expect(video.muted).toBe(false)
  })

  it('stop() removes listener — keys no longer handled', () => {
    stop()
    fire(' ')
    expect(video.play).not.toHaveBeenCalled()
  })

  it('does nothing when getVideo returns null', () => {
    getVideo = () => null
    stop = createKeyboardHandler(getVideo)
    expect(() => fire(' ')).not.toThrow()
  })
})
