const PERMALINK = /^(?:https?:\/\/(?:www\.)?instagram\.com)?\/(?:p|reel(?:s(?!\/audio))?)\/([A-Za-z0-9_-]+)/

function codesWithin(element: Element): Set<string> {
  const codes = new Set<string>()
  for (const anchor of element.querySelectorAll('a[href]')) {
    const match = anchor.getAttribute('href')?.match(PERMALINK)
    if (match) codes.add(match[1])
  }
  return codes
}

/**
 * The shortcode identifying the post a video belongs to.
 *
 * Climbs until an ancestor's subtree names exactly one post. Stopping at the
 * first ancestor that contains *any* permalink would, once the walk reaches a
 * container spanning several posts, return whichever came first in document
 * order rather than the one holding this video.
 *
 * On the reels feed no ancestor carries a permalink at all — there is no
 * timestamp anchor the way the home feed has one — so the walk exhausts
 * having found zero codes. In that exhausted case only, fall back to
 * location.pathname, which on the reels feed names the shortcode of the reel
 * currently on screen and updates as the user scrolls. The fallback does not
 * run when the walk found more than one code: ambiguity means we genuinely
 * cannot tell which post the video belongs to, and the path would just be a
 * guess layered on a known-unknown.
 */
export function shortcodeFor(video: HTMLVideoElement): string | null {
  for (let element: Element | null = video; element; element = element.parentElement) {
    const codes = codesWithin(element)
    if (codes.size === 1) return [...codes][0]
    if (codes.size > 1) return null
  }
  return location.pathname.match(PERMALINK)?.[1] ?? null
}
