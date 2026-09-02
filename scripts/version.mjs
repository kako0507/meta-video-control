// The extension version comes from the git tag, so a build always reports what
// it was cut from. Used by vite.config.ts and .github/workflows/release.yml.
//
//   node scripts/version.mjs <tag> <file...>   # writes the version, prints it
import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { argv, env } from 'process'
import { fileURLToPath } from 'url'

const MAX_PART = 65535
const PART = /^(0|[1-9][0-9]*)$/
const DESCRIBE = /^(.*)-([0-9]+)-g[0-9a-f]+$/

// Chrome takes 1 to 4 dot-separated integers, no leading zeros.
function parse(value) {
  const version = String(value).trim().replace(/^v/i, '')
  const parts = version.split('.')
  const ok =
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every(p => PART.test(p) && Number(p) <= MAX_PART)
  return ok ? parts : null
}

export function versionFromTag(tag) {
  const parts = parse(tag)
  if (!parts) {
    throw new Error(
      `Tag "${tag}" is not a usable extension version: expected 1 to 4 ` +
        `dot-separated integers from 0 to ${MAX_PART}, without leading zeros (e.g. 1.2.3).`
    )
  }
  return parts.join('.')
}

// `git describe --tags --long` output, e.g. 1.0.1-3-g6808358. Commits since the
// tag become a fourth part, so a dev build sorts above the release it follows.
export function versionFromDescribe(described) {
  const match = DESCRIBE.exec(String(described).trim())
  if (!match) return null

  const parts = parse(match[1])
  if (!parts) return null

  const commits = Number(match[2])
  if (commits === 0 || parts.length === 4 || commits > MAX_PART) return parts.join('.')
  return [...parts, commits].join('.')
}

const gitDescribe = () =>
  execFileSync('git', ['describe', '--tags', '--long'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

export function resolveVersion({ env: explicit = env.EXTENSION_VERSION, describe = gitDescribe } = {}) {
  if (explicit) return versionFromTag(explicit)
  try {
    return versionFromDescribe(describe())
  } catch {
    return null // no tag, no git, no checkout: the caller keeps whatever it has
  }
}

export function writeVersion(file, version) {
  const json = JSON.parse(readFileSync(file, 'utf8'))
  json.version = version
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [tag, ...files] = argv.slice(2)
  if (!tag || files.length === 0) {
    console.error('usage: node scripts/version.mjs <tag> <file...>')
    process.exit(1)
  }
  const version = versionFromTag(tag)
  files.forEach(file => writeVersion(file, version))
  process.stdout.write(version)
}
