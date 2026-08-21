import { describe, it, expect, afterEach } from 'vitest'
import { resolveDownload, mediaShortcode, createMediaSession } from '../../src/content/post-media'

const CDN = 'https://instagram.ftpe9-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPX8RYo.mp4'
const CODE = 'DcQ7XESu_Yy'

/** Instagram embeds media JSON in a script tag, which keeps its text unescaped. */
function plantMediaJson(json: string) {
  const script = document.createElement('script')
  script.type = 'application/json'
  script.textContent = json
  document.body.appendChild(script)
}

function goTo(pathname: string) {
  window.history.replaceState({}, '', pathname)
}

afterEach(() => {
  document.body.innerHTML = ''
  goTo('/')
})

describe('mediaShortcode', () => {
  it('reads the code from the singular permalink form', () => {
    goTo('/reel/DcQ7XESu_Yy/')
    expect(mediaShortcode()).toBe(CODE)
  })

  it('reads the code from the plural form a signed-in permalink redirects to', () => {
    goTo('/reels/DcQ7XESu_Yy/')
    expect(mediaShortcode()).toBe(CODE)
  })

  it('reads the code from a regular post permalink', () => {
    goTo('/p/DaLkXw-SY4J/')
    expect(mediaShortcode()).toBe('DaLkXw-SY4J')
  })

  it('returns null where the path names no post', () => {
    goTo('/')
    expect(mediaShortcode()).toBeNull()
  })
})

describe('resolveDownload', () => {
  it('returns the mp4 url and a filename for the reel the page was opened on', () => {
    goTo('/reels/DcQ7XESu_Yy/')
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)

    expect(resolveDownload(CODE)).toEqual({ url: CDN, filename: 'DcQ7XESu_Yy.mp4' })
  })

  it('unescapes the slashes and ampersands Instagram encodes into the JSON', () => {
    goTo('/reels/DcQ7XESu_Yy/')
    plantMediaJson(
      '{"video_versions":[{"type":101,' +
        '"url":"https:\\/\\/instagram.fna.fbcdn.net\\/o1\\/v.mp4?a=1\\u0026b=2"}]}'
    )

    expect(resolveDownload(CODE)?.url).toBe('https://instagram.fna.fbcdn.net/o1/v.mp4?a=1&b=2')
  })

  /**
   * The feed swaps the path to the next reel as it scrolls, but the document
   * still holds the JSON that shipped with the original one. Resolving then
   * would hand back a different video than the one on screen.
   */
  it('returns null once the feed has scrolled on to a different reel', () => {
    goTo('/reels/SomeOtherReel/')
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)

    expect(resolveDownload(CODE)).toBeNull()
  })

  it('returns null when the page was never opened on a reel', () => {
    goTo('/')
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)

    expect(resolveDownload(null)).toBeNull()
  })

  it('returns null when the page carries no video_versions', () => {
    goTo('/reels/DcQ7XESu_Yy/')
    plantMediaJson('{"caption":"a photo post"}')

    expect(resolveDownload(CODE)).toBeNull()
  })
})

describe('createMediaSession', () => {
  it('latches the code that appears only after the feed url is rewritten', () => {
    // Instagram serves /reels/ and swaps in /reels/<code>/ a moment later; the
    // content script can start before that happens.
    goTo('/reels/')
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)
    const session = createMediaSession()
    expect(session.download()).toBeNull()

    goTo(`/reels/${CODE}/`)

    expect(session.download()).toEqual({ url: CDN, filename: `${CODE}.mp4` })
  })

  it('does not re-latch onto a reel the feed later scrolls to', () => {
    goTo(`/reels/${CODE}/`)
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)
    const session = createMediaSession()
    expect(session.download()).not.toBeNull()

    goTo('/reels/ADifferentReel/')

    expect(session.download()).toBeNull()
  })
})

describe('resolveDownload on a regular post', () => {
  it('resolves the video of a /p/ permalink, where one block matches one video', () => {
    goTo('/p/DaLkXw-SY4J/')
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)

    expect(resolveDownload('DaLkXw-SY4J')).toEqual({
      url: CDN,
      filename: 'DaLkXw-SY4J.mp4',
    })
  })

  it('returns null on the home feed, whose embedded JSON cannot be matched to a video', () => {
    goTo('/')
    plantMediaJson(`{"video_versions":[{"type":101,"url":"${CDN}"}]}`)

    expect(resolveDownload(mediaShortcode())).toBeNull()
  })
})
