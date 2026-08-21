import { mountPanel } from '../panel/mount'

export interface VideoController {
  destroy: () => void
}

export function createVideoController(video: HTMLVideoElement): VideoController {
  const unmount = mountPanel(video)
  let destroyed = false

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      unmount()
    },
  }
}
