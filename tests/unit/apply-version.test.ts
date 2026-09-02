import { describe, expect, test } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { versionFromTag, writeVersion } from '../../scripts/apply-version.mjs'

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
