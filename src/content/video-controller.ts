import { mountPanel } from '../panel/mount'
import { DownloadSource } from '../panel/Panel'

export interface VideoController {
  destroy: () => void
}

export function createVideoController(
  video: HTMLVideoElement,
  downloads: DownloadSource | null = null
): VideoController {
  const unmount = mountPanel(video, downloads)
  let destroyed = false

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      unmount()
    },
  }
}
