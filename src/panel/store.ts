import type { VideoState, SpeedValue } from '../types'

export type VideoAction =
  | { type: 'SET_SPEED'; payload: SpeedValue }
  | { type: 'SEEK'; payload: number }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'SYNC'; payload: VideoState }

export function videoReducer(state: VideoState, action: VideoAction): VideoState {
  switch (action.type) {
    case 'SET_SPEED':
      return { ...state, playbackRate: action.payload }
    case 'SEEK':
      return { ...state, currentTime: action.payload }
    case 'TOGGLE_PLAY':
      return { ...state, playing: !state.playing }
    case 'SET_VOLUME':
      return { ...state, volume: action.payload, muted: false }
    case 'TOGGLE_MUTE':
      return { ...state, muted: !state.muted }
    case 'SYNC':
      return action.payload
    default:
      return state
  }
}

export function createInitialState(video: HTMLVideoElement): VideoState {
  return {
    currentTime: video.currentTime,
    duration: isNaN(video.duration) ? 0 : (video.duration || 0),
    playing: !video.paused,
    volume: video.volume,
    muted: video.muted,
    playbackRate: video.playbackRate,
  }
}
