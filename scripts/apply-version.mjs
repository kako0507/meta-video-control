// Derives a Chrome-compatible extension version from a git tag and writes it
// into JSON manifests. Used by .github/workflows/release.yml.
//
//   node scripts/apply-version.mjs <tag> <file...>   # prints the version
import { readFileSync, writeFileSync } from 'fs'
import { argv } from 'process'
import { fileURLToPath } from 'url'

const MAX_PART = 65535
const PART = /^(0|[1-9][0-9]*)$/

export function versionFromTag(tag) {
  const version = String(tag).trim().replace(/^v/i, '')
  const parts = version.split('.')
  const valid =
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every(p => PART.test(p) && Number(p) <= MAX_PART)

  if (!valid) {
    throw new Error(
      `Tag "${tag}" is not a usable extension version: expected 1 to 4 ` +
        `dot-separated integers from 0 to ${MAX_PART}, without leading zeros (e.g. 1.2.3).`
    )
  }
  return version
}

export function writeVersion(file, version) {
  const json = JSON.parse(readFileSync(file, 'utf8'))
  json.version = version
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [tag, ...files] = argv.slice(2)
  if (!tag || files.length === 0) {
    console.error('usage: node scripts/apply-version.mjs <tag> <file...>')
    process.exit(1)
  }
  const version = versionFromTag(tag)
  files.forEach(file => writeVersion(file, version))
  process.stdout.write(version)
}
