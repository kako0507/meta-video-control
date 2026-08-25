import { MediaIndex } from './media-index'
import { resolveDownloadFor } from './resolve-download'
import { DownloadSource } from '../panel/Panel'

/**
 * A view of the index bound to one video, for that video's panel to follow.
 *
 * Resolution depends on two things that change independently: the index
 * (harvested entries arriving over the bridge) and the video element's own
 * duration (its metadata loading asynchronously). A permalink's index often
 * fills before the element's duration is known, so notifying only on index
 * changes leaves the panel stuck on a null it computed while duration was
 * still NaN — the element's own `loadedmetadata`/`durationchange` events are
 * the only signal that a later resolution attempt might succeed.
 */
export function createDownloadSource(
  video: HTMLVideoElement,
  index: MediaIndex
): DownloadSource {
  return {
    current: () => resolveDownloadFor(video, index),
    subscribe(listener) {
      const unsubscribeIndex = index.subscribe(listener)
      video.addEventListener('loadedmetadata', listener)
      video.addEventListener('durationchange', listener)
      return () => {
        unsubscribeIndex()
        video.removeEventListener('loadedmetadata', listener)
        video.removeEventListener('durationchange', listener)
      }
    },
  }
}
