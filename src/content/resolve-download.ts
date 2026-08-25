import { MediaIndex } from './media-index'
import { MediaDownload } from './post-media'
import { shortcodeFor } from './visible-media'

/**
 * How far a harvested duration may sit from the element's before the entry is
 * rejected. A container's duration and the element's were measured 0.08s apart
 * (21.24 against 21.16), so this absorbs rounding while still separating two
 * different videos.
 */
const DURATION_TOLERANCE = 0.5

/**
 * How far apart two candidate durations may be and still be considered the
 * same video. Instagram republishes one asset many times under a shared
 * shortcode — rotating signed urls, multiple encoded qualities, once in the
 * initial document and again in a GraphQL response — and every copy carries
 * the identical duration pulled from the same dash manifest. A live permalink
 * was observed indexing FIVE entries under one code, every one at duration
 * 21.16: five copies, not five videos. Genuinely distinct videos (e.g. two
 * different carousel slides) differ by far more than this.
 */
const DURATION_GROUP_EPSILON = 0.001

/**
 * The download for the video on screen, or null.
 *
 * Finding the post by walking up to its permalink is a structural guess about
 * Instagram's DOM, so the duration has to agree before anything is offered.
 * Uniqueness is judged by distinct VIDEO, not by entry count: candidates
 * within tolerance are grouped by duration equality (tight epsilon, since
 * copies of one video share an exact duration while different videos do
 * not), and a download is offered only when every candidate falls into a
 * single group. Multiple copies of that one video are not ambiguity — the
 * most recently harvested copy is preferred, since signed urls rotate and
 * expire and the freshest is most likely to still fetch. Two or more
 * distinct duration groups still means we cannot tell which video is on
 * screen, so the result is null.
 */
export function resolveDownloadFor(
  video: HTMLVideoElement,
  index: MediaIndex
): MediaDownload | null {
  const code = shortcodeFor(video)
  if (!code || !Number.isFinite(video.duration)) return null

  const candidates = index
    .entriesFor(code)
    .filter(entry => Math.abs(entry.duration - video.duration) <= DURATION_TOLERANCE)

  if (candidates.length === 0) return null

  const firstDuration = candidates[0].duration
  const sameVideo = candidates.every(
    entry => Math.abs(entry.duration - firstDuration) <= DURATION_GROUP_EPSILON
  )
  if (!sameVideo) return null

  const match = candidates[candidates.length - 1]
  return { url: match.url, filename: `${code}.mp4` }
}
