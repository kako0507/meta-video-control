import { MediaEntry } from './extract'

/** Marks the messages this extension sends from the page world to its own. */
export const BRIDGE_MARKER = 'MVC_MEDIA'

/**
 * Marks the announcement the isolated-world index posts once it is listening,
 * so the page-world harvester knows to replay whatever it published before
 * anyone was around to hear it.
 */
export const BRIDGE_READY_MARKER = 'MVC_MEDIA_READY'

export interface BridgeMessage {
  marker: typeof BRIDGE_MARKER
  entries: MediaEntry[]
}

export interface BridgeReadyMessage {
  marker: typeof BRIDGE_READY_MARKER
}

function isValidMediaEntry(entry: unknown): entry is MediaEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const e = entry as Partial<MediaEntry>

  // Validate code is a string
  if (typeof e.code !== 'string') return false

  // Validate url is a string and comes from an Instagram CDN
  if (typeof e.url !== 'string') return false
  try {
    const parsed = new URL(e.url)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname
    if (!hostname.endsWith('.fbcdn.net') && hostname !== 'fbcdn.net' &&
        !hostname.endsWith('.cdninstagram.com') && hostname !== 'cdninstagram.com') {
      return false
    }
  } catch {
    return false
  }

  // Validate duration is a finite number
  if (typeof e.duration !== 'number' || !isFinite(e.duration)) return false

  return true
}

export function isBridgeMessage(data: unknown): data is BridgeMessage {
  if (typeof data !== 'object' || data === null) return false
  const message = data as Partial<BridgeMessage>
  if (message.marker !== BRIDGE_MARKER || !Array.isArray(message.entries)) return false

  // Reject the whole message if any entry is invalid
  return message.entries.every(isValidMediaEntry)
}

export function isBridgeReadyMessage(data: unknown): data is BridgeReadyMessage {
  if (typeof data !== 'object' || data === null) return false
  const message = data as Partial<BridgeReadyMessage>
  return message.marker === BRIDGE_READY_MARKER
}
