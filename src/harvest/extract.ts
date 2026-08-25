export interface MediaEntry {
  code: string
  url: string
  /** Seconds. Required: an entry without one can never pass verification. */
  duration: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Parses an ISO-8601 duration such as "PT39.066666S", "PT1M19.5S" or
 * "PT1H2M3S" into total seconds. Returns null for anything that does not
 * match, including an empty match (e.g. "PT").
 */
function parseIsoDurationSeconds(value: string): number | null {
  const match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value)
  if (!match) return null

  const [, hours, minutes, seconds] = match
  if (hours === undefined && minutes === undefined && seconds === undefined) return null

  const total = Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0)
  return Number.isFinite(total) ? total : null
}

/**
 * Pulls the duration out of a node's DASH manifest. Instagram does not send a
 * duration field on the node itself; the manifest's mediaPresentationDuration
 * attribute is the only place it appears. Anything that fails to parse is
 * treated as absent, per the fail-closed rule below.
 */
function durationFrom(node: Record<string, unknown>): number | null {
  const manifest = node.video_dash_manifest
  if (typeof manifest !== 'string') return null

  const match = /mediaPresentationDuration="([^"]*)"/.exec(manifest)
  if (!match) return null

  return parseIsoDurationSeconds(match[1])
}

function entryFrom(node: Record<string, unknown>): MediaEntry | null {
  const { code, video_versions: versions } = node
  if (typeof code !== 'string') return null
  if (!Array.isArray(versions) || versions.length === 0) return null

  const first = versions[0]
  if (!isRecord(first) || typeof first.url !== 'string') return null

  // A node whose duration cannot be verified is rejected: it is later checked
  // against the video element's duration, and an entry without one could
  // never pass that check.
  const duration = durationFrom(node)
  if (duration === null) return null

  return { code, url: first.url, duration }
}

/**
 * Walks a parsed payload and collects every media node it holds.
 *
 * The walk is the whole point: a node's code and its video_versions are
 * properties of one object, so the pairing cannot drift when Instagram changes
 * how the payload is serialised. Matching them by their distance apart in the
 * raw text was measured varying between loads of the same page.
 */
export function extractMedia(value: unknown): MediaEntry[] {
  const found: MediaEntry[] = []

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!isRecord(node)) return

    const entry = entryFrom(node)
    if (entry) found.push(entry)

    Object.values(node).forEach(visit)
  }

  visit(value)
  return found
}
