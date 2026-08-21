// Permalink forms that name exactly one piece of media: a reel as /reel/<code>/
// (which a signed-in session redirects to /reels/<code>/) and a regular post as
// /p/<code>/. The bare feeds carry no code and so never match — and their
// embedded JSON cannot be tied to a particular video anyway.
const MEDIA_PATH = /^\/(?:reels?|p)\/([A-Za-z0-9_-]+)\/?$/

// The url sits within the first entry of the video_versions array; this bounds
// the search so a page-sized string is never scanned twice.
const SEARCH_WINDOW = 3000

export interface MediaDownload {
  url: string
  filename: string
}

/** The reel or post the path currently names, if it names one at all. */
export function mediaShortcode(): string | null {
  return location.pathname.match(MEDIA_PATH)?.[1] ?? null
}

/**
 * Instagram plays reels through MediaSource, so video.currentSrc is a blob URL
 * that cannot be fetched. The page's embedded JSON separately carries a plain
 * progressive MP4 — muxed, audio included — which is what this resolves.
 *
 * `openedOn` is the reel the document was loaded with. The document holds more
 * than one video_versions block and gives no way to tell which belongs to the
 * reel now on screen, so once the feed scrolls elsewhere this resolves nothing
 * rather than risk handing back a different video than the one being watched.
 */
export function resolveDownload(openedOn: string | null): MediaDownload | null {
  if (!openedOn || mediaShortcode() !== openedOn) return null

  const html = document.documentElement.innerHTML
  const start = html.indexOf('"video_versions"')
  if (start < 0) return null

  const match = html.slice(start, start + SEARCH_WINDOW).match(/"url":"([^"]+)"/)
  if (!match) return null

  // Undo the JSON escaping Instagram applies to the embedded string. Plain
  // splits rather than regexes: the escape sequences are literal, and the
  // backslashes make an escaped pattern easy to get subtly wrong.
  const url = match[1].split('\\/').join('/').split('\\u0026').join('&')
  return { url, filename: `${openedOn}.mp4` }
}

export interface MediaSession {
  download: () => MediaDownload | null
}

/**
 * Instagram serves /reels/ and rewrites it to /reels/<code>/ a moment later, so
 * the code is not reliably readable when the content script starts. This latches
 * the first one to appear — the reel the document was rendered for — and never
 * moves on, since reels reached by scrolling arrive without usable JSON.
 */
export function createMediaSession(): MediaSession {
  let openedOn: string | null = null

  return {
    download() {
      openedOn ??= mediaShortcode()
      return resolveDownload(openedOn)
    },
  }
}
