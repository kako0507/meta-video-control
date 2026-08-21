export interface VideoDetector {
  scan: () => void
  reset: () => void
  stop: () => void
}

function visibleArea(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect()
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
  return height * width
}

/**
 * The reels feed keeps every reel scrolled past still mounted, so DOM order says
 * nothing about what the viewer is watching. Pick whichever video covers most of
 * the viewport, falling back to DOM order where nothing reports a size at all.
 */
function pickVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null
  let bestArea = 0

  for (const video of videos) {
    const area = visibleArea(video)
    if (area > bestArea) {
      bestArea = area
      best = video
    }
  }

  return best ?? videos[0] ?? null
}

export function createVideoDetector(
  onFound: (video: HTMLVideoElement) => void,
  onLost: (video: HTMLVideoElement) => void
): VideoDetector {
  let activeVideo: HTMLVideoElement | null = null

  const observer = new MutationObserver(() => scan())
  observer.observe(document.body, { childList: true, subtree: true })

  function scan() {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))

    if (activeVideo && !document.contains(activeVideo)) {
      const lost = activeVideo
      activeVideo = null
      onLost(lost)
    }

    const best = pickVideo(videos)

    if (best && best !== activeVideo) {
      activeVideo = best
      onFound(best)
    }
  }

  return {
    scan,
    reset() {
      activeVideo = null
    },
    stop() {
      observer.disconnect()
    },
  }
}
