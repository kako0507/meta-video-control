import { MediaEntry } from '../harvest/extract'
import { BRIDGE_READY_MARKER, BridgeReadyMessage, isBridgeMessage } from '../harvest/bridge'

export interface MediaIndex {
  entriesFor: (code: string) => MediaEntry[]
  subscribe: (listener: () => void) => () => void
  stop: () => void
}

/**
 * Holds what the page world has harvested so far, keyed by shortcode. A
 * carousel puts several videos under one code, so each key holds a list.
 */
export function createMediaIndex(): MediaIndex {
  const byCode = new Map<string, MediaEntry[]>()
  const listeners = new Set<() => void>()

  // Instagram issues multiple distinct signed urls for the same asset — same
  // path, different rotating signature query params — so dedupe on the
  // pathname rather than the full url. Fall back to the raw url when it will
  // not parse, rather than throwing.
  const dedupeKey = (url: string): string => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }

  const add = (entry: MediaEntry) => {
    const existing = byCode.get(entry.code) ?? []
    const key = dedupeKey(entry.url)
    if (existing.some(e => dedupeKey(e.url) === key)) return false
    byCode.set(entry.code, [...existing, entry])
    return true
  }

  const onMessage = (event: MessageEvent) => {
    // Only this page's own world may feed the index.
    if (event.source !== window || !isBridgeMessage(event.data)) return

    const added = event.data.entries.map(add).filter(Boolean).length
    if (added > 0) listeners.forEach(listener => listener())
  }

  window.addEventListener('message', onMessage)

  // Announce readiness only after the listener above is registered: doing it
  // the other way round would race a synchronous reply from the page world.
  const ready: BridgeReadyMessage = { marker: BRIDGE_READY_MARKER }
  window.postMessage(ready, window.location.origin)

  return {
    entriesFor: code => byCode.get(code) ?? [],
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stop() {
      window.removeEventListener('message', onMessage)
      listeners.clear()
    },
  }
}
