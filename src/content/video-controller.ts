import { mountPanel } from '../panel/mount'
import { MediaDownload } from './post-media'

export interface VideoController {
  destroy: () => void
}

export function createVideoController(
  video: HTMLVideoElement,
  download: MediaDownload | null = null
): VideoController {
  const unmount = mountPanel(video, download)
  let destroyed = false

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      unmount()
    },
  }
}
