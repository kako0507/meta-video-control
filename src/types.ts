export interface VideoState {
  currentTime: number
  duration: number
  playing: boolean
  volume: number
  muted: boolean
  playbackRate: number
}

export type SpeedValue = 0.5 | 1 | 1.5 | 2 | 3

export const SPEED_PRESETS: SpeedValue[] = [0.5, 1, 1.5, 2, 3]

export interface PanelPosition {
  x: number
  y: number
}

export const POSITION_STORAGE_KEY = 'ig-ctrl-position'
export const DEFAULT_POSITION: PanelPosition = { x: -1, y: -1 }
