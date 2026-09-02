import { describe, expect, test } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { resolveVersion, versionFromDescribe, versionFromTag, writeVersion } from '../../scripts/version.mjs'

describe('versionFromTag', () => {
  test('accepts a plain numeric tag', () => {
    expect(versionFromTag('1.2.3')).toBe('1.2.3')
  })

  test('strips a leading v', () => {
    expect(versionFromTag('v1.2.3')).toBe('1.2.3')
  })

  test('rejects a pre-release suffix Chrome cannot parse', () => {
    expect(() => versionFromTag('1.2.3-beta')).toThrow(/1\.2\.3-beta/)
  })

  test('rejects a part above 65535', () => {
    expect(() => versionFromTag('1.65536')).toThrow(/65535/)
  })

  test('rejects more than four parts', () => {
    expect(() => versionFromTag('1.2.3.4.5')).toThrow()
  })

  test('rejects a part with a leading zero', () => {
    expect(() => versionFromTag('1.01')).toThrow()
  })
})

describe('versionFromDescribe', () => {
  test('uses the tag itself when the build sits on it', () => {
    expect(versionFromDescribe('1.0.1-0-g6808358')).toBe('1.0.1')
  })

  test('counts commits since the tag as a fourth part', () => {
    expect(versionFromDescribe('1.0.1-3-g6808358')).toBe('1.0.1.3')
  })

  test('strips a leading v like a tag does', () => {
    expect(versionFromDescribe('v2.0-2-gabc1234')).toBe('2.0.2')
  })

  test('keeps a four-part tag as is, since there is no room to count commits', () => {
    expect(versionFromDescribe('1.2.3.4-5-gabc1234')).toBe('1.2.3.4')
  })

  test('returns null for output it cannot read as a version', () => {
    expect(versionFromDescribe('nightly-3-gabc1234')).toBe(null)
    expect(versionFromDescribe('')).toBe(null)
  })
})

describe('resolveVersion', () => {
  test('prefers an explicit version from the environment', () => {
    expect(resolveVersion({ env: '2.0.0', describe: () => '1.0.1-3-gabc' })).toBe('2.0.0')
  })

  test('falls back to what git describes', () => {
    expect(resolveVersion({ env: undefined, describe: () => '1.0.1-3-gabc' })).toBe('1.0.1.3')
  })

  test('returns null outside a git checkout, so the caller can keep its own value', () => {
    expect(resolveVersion({ env: '', describe: () => { throw new Error('not a git repository') } })).toBe(null)
  })
})

describe('writeVersion', () => {
  test('replaces the version field and leaves the rest of the file intact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apply-version-'))
    const file = join(dir, 'manifest.json')
    writeFileSync(file, '{\n  "name": "Meta Videos Control",\n  "version": "1.0.0"\n}\n')

    writeVersion(file, '2.5.0')

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      name: 'Meta Videos Control',
      version: '2.5.0',
    })
    expect(readFileSync(file, 'utf8').endsWith('\n')).toBe(true)
  })
})
