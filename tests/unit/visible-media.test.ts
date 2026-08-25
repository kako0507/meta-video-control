import { describe, it, expect, afterEach } from 'vitest'
import { shortcodeFor } from '../../src/content/visible-media'

const originalPath = location.pathname + location.search + location.hash

afterEach(() => {
  document.body.innerHTML = ''
  window.history.replaceState({}, '', originalPath)
})

function post(code: string): HTMLElement {
  const article = document.createElement('article')
  article.innerHTML = `<div><video></video></div><a href="/p/${code}/">2h</a>`
  document.body.appendChild(article)
  return article
}

describe('shortcodeFor', () => {
  it('reads the code from the permalink inside the post', () => {
    const article = post('AAA')
    const video = article.querySelector('video')!

    expect(shortcodeFor(video)).toBe('AAA')
  })

  it('accepts a reel permalink as readily as a post one', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video><a href="/reel/BBB/">reel</a>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBe('BBB')
  })

  /**
   * Climbing to an ancestor that spans several posts and taking the first
   * anchor would return whichever post comes first in document order, not the
   * one holding the video. The walk must stop where the code is unambiguous.
   */
  it('does not reach past its own post into a neighbouring one', () => {
    post('FIRST')
    const second = post('SECOND')

    expect(shortcodeFor(second.querySelector('video')!)).toBe('SECOND')
  })

  it('returns null where the post carries no permalink at all', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBeNull()
  })

  it('tolerates several links to the same post', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video><a href="/p/AAA/">x</a><a href="/p/AAA/?img=1">y</a>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBe('AAA')
  })

  it('ignores /reels/audio/<id>/ audio links', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video><a href="/reels/audio/6407864819323406/">audio</a>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBeNull()
  })

  it('resolves to post code when audio anchor sits beside the post anchor', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video><a href="/p/CODE/">post</a><a href="/reels/audio/6407864819323406/">audio</a>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBe('CODE')
  })

  it('accepts an absolute instagram.com permalink', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video><a href="https://www.instagram.com/p/ABSOLUTE/">abs</a>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBe('ABSOLUTE')
  })

  it('returns null when video has no parent element', () => {
    const video = document.createElement('video')
    // Intentionally not appended to document
    expect(shortcodeFor(video)).toBeNull()
  })

  it('ignores /explore/ and /stories/ hrefs', () => {
    const article = document.createElement('article')
    article.innerHTML = '<video></video><a href="/explore/">explore</a><a href="/stories/">stories</a>'
    document.body.appendChild(article)

    expect(shortcodeFor(article.querySelector('video')!)).toBeNull()
  })

  describe('falling back to the URL when the walk finds nothing', () => {
    it('reads the code from a /reels/<code>/ path', () => {
      window.history.replaceState({}, '', '/reels/ABC123/')
      const article = document.createElement('article')
      article.innerHTML = '<video></video>'
      document.body.appendChild(article)

      expect(shortcodeFor(article.querySelector('video')!)).toBe('ABC123')
    })

    it('reads the code from a /p/<code>/ path', () => {
      window.history.replaceState({}, '', '/p/XYZ789/')
      const article = document.createElement('article')
      article.innerHTML = '<video></video>'
      document.body.appendChild(article)

      expect(shortcodeFor(article.querySelector('video')!)).toBe('XYZ789')
    })

    it('returns null on the bare /reels/ path', () => {
      window.history.replaceState({}, '', '/reels/')
      const article = document.createElement('article')
      article.innerHTML = '<video></video>'
      document.body.appendChild(article)

      expect(shortcodeFor(article.querySelector('video')!)).toBeNull()
    })

    it('returns null on the home feed path', () => {
      window.history.replaceState({}, '', '/')
      const article = document.createElement('article')
      article.innerHTML = '<video></video>'
      document.body.appendChild(article)

      expect(shortcodeFor(article.querySelector('video')!)).toBeNull()
    })

    it('prefers a code found by the walk over a different one named by the path', () => {
      window.history.replaceState({}, '', '/reels/PATHCODE/')
      const article = post('WALKCODE')

      expect(shortcodeFor(article.querySelector('video')!)).toBe('WALKCODE')
    })

    it('does not rescue an ambiguous walk with the path', () => {
      window.history.replaceState({}, '', '/reels/PATHCODE/')
      const article = document.createElement('article')
      article.innerHTML = '<video></video><a href="/p/ONE/">one</a><a href="/p/TWO/">two</a>'
      document.body.appendChild(article)

      expect(shortcodeFor(article.querySelector('video')!)).toBeNull()
    })
  })
})
