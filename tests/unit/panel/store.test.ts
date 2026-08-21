import { describe, it, expect } from 'vitest'
import { videoReducer, createInitialState } from '../../../src/panel/store'
import type { VideoState } from '../../../src/types'

function makeVideo(): HTMLVideoElement {
  const v = document.createElement('video') as any
  v.currentTime = 5
  Object.defineProperty(v, 'duration', { value: 60, writable: true, configurable: true })
  Object.defineProperty(v, 'paused', { value: true, writable: true, configurable: true })
  v.volume = 0.8
  v.muted = false
  v.playbackRate = 1
  return v as HTMLVideoElement
}

describe('videoReducer', () => {
  let initial: VideoState

  beforeEach(() => {
    initial = createInitialState(makeVideo())
  })

  it('SET_SPEED updates playbackRate', () => {
    const next = videoReducer(initial, { type: 'SET_SPEED', payload: 2 })
    expect(next.playbackRate).toBe(2)
    expect(next).not.toBe(initial)
  })

  it('SEEK updates currentTime', () => {
    const next = videoReducer(initial, { type: 'SEEK', payload: 30 })
    expect(next.currentTime).toBe(30)
  })

  it('TOGGLE_PLAY flips playing', () => {
    expect(initial.playing).toBe(false)
    const playing = videoReducer(initial, { type: 'TOGGLE_PLAY' })
    expect(playing.playing).toBe(true)
    const paused = videoReducer(playing, { type: 'TOGGLE_PLAY' })
    expect(paused.playing).toBe(false)
  })

  it('SET_VOLUME updates volume and clears muted', () => {
    const muted = { ...initial, muted: true }
    const next = videoReducer(muted, { type: 'SET_VOLUME', payload: 0.5 })
    expect(next.volume).toBe(0.5)
    expect(next.muted).toBe(false)
  })

  it('TOGGLE_MUTE flips muted', () => {
    const next = videoReducer(initial, { type: 'TOGGLE_MUTE' })
    expect(next.muted).toBe(true)
    const back = videoReducer(next, { type: 'TOGGLE_MUTE' })
    expect(back.muted).toBe(false)
  })

  it('SYNC replaces state wholesale', () => {
    const payload: VideoState = {
      currentTime: 42, duration: 60, playing: true,
      volume: 0.3, muted: false, playbackRate: 1.5,
    }
    const next = videoReducer(initial, { type: 'SYNC', payload })
    expect(next).toEqual(payload)
  })

  it('returns same reference for unknown action type', () => {
    const next = videoReducer(initial, { type: 'UNKNOWN' } as any)
    expect(next).toBe(initial)
  })
})

describe('createInitialState', () => {
  it('reads all properties from video element', () => {
    const video = makeVideo()
    const state = createInitialState(video)
    expect(state.currentTime).toBe(5)
    expect(state.duration).toBe(60)
    expect(state.playing).toBe(false)
    expect(state.volume).toBe(0.8)
    expect(state.muted).toBe(false)
    expect(state.playbackRate).toBe(1)
  })

  it('uses 0 for duration when video.duration is NaN', () => {
    const video = makeVideo()
    ;(video as any).duration = NaN
    const state = createInitialState(video)
    expect(state.duration).toBe(0)
  })
})
