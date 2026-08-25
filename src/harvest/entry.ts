import { MediaEntry, extractMedia } from './extract'
import { BRIDGE_MARKER, BridgeMessage, isBridgeReadyMessage } from './bridge'

function extractPublishable(text: string): MediaEntry[] {
  if (!text || text.indexOf('video_versions') < 0) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return [] // not JSON: a page, an image, anything else
  }

  return extractMedia(parsed)
}

/**
 * Watches the page's own traffic for media.
 *
 * This runs in the MAIN world because a content script's patches are invisible
 * to the page's own calls — its world holds a separate `fetch`. It must also
 * run before any page script, or Instagram will already hold a reference to
 * the original.
 */
export function startHarvesting(): () => void {
  const originalFetch = window.fetch
  const originalSend = XMLHttpRequest.prototype.send

  // Everything published so far, in publication order, so a index that
  // starts listening after the fact can ask for a replay.
  const buffer: MediaEntry[] = []

  function publish(text: string) {
    const entries = extractPublishable(text)
    if (entries.length === 0) return

    buffer.push(...entries)
    const message: BridgeMessage = { marker: BRIDGE_MARKER, entries }
    window.postMessage(message, window.location.origin)
  }

  /** Reads the payload the server rendered into the document. */
  function harvestDocument() {
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      publish(script.textContent ?? '')
    }
  }

  function onReady(event: MessageEvent) {
    // Only this page's own world may trigger a replay.
    if (event.source !== window || !isBridgeReadyMessage(event.data)) return

    // The index announces itself at document_idle, by which time Instagram
    // may have streamed in a ScheduledServerJS block that arrived too late
    // for the DOMContentLoaded scan. Re-scan first so anything newly found
    // lands in the buffer before it is read below, in the same replay,
    // rather than trickling out as a separate publish.
    harvestDocument()

    if (buffer.length === 0) return

    const message: BridgeMessage = { marker: BRIDGE_MARKER, entries: buffer.slice() }
    window.postMessage(message, window.location.origin)
  }

  window.addEventListener('message', onReady)

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await originalFetch.apply(this, args)
    // Read a copy: the caller's body must stay unconsumed.
    response
      .clone()
      .text()
      .then(publish)
      .catch(() => {})
    return response
  }

  XMLHttpRequest.prototype.send = function (...args: Parameters<XMLHttpRequest['send']>) {
    this.addEventListener('load', () => {
      try {
        if (typeof this.responseText === 'string') publish(this.responseText)
      } catch {
        // responseText throws for non-text response types
      }
    })
    return originalSend.apply(this, args)
  }

  // At document_start there is no document to read yet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', harvestDocument, { once: true })
  } else {
    queueMicrotask(harvestDocument)
  }

  return () => {
    window.fetch = originalFetch
    XMLHttpRequest.prototype.send = originalSend
    document.removeEventListener('DOMContentLoaded', harvestDocument)
    window.removeEventListener('message', onReady)
    buffer.length = 0
  }
}
