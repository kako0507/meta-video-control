import { describe, expect, test } from 'vitest'
import { crc32 } from 'zlib'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))
const icons: [string, string][] = Object.entries(manifest.icons)

const SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')

type Chunk = { type: string; data: Buffer; crcOk: boolean }

function chunks(png: Buffer): Chunk[] {
  const out: Chunk[] = []
  let at = 8
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    const type = png.subarray(at + 4, at + 8).toString('latin1')
    out.push({
      type,
      data: png.subarray(at + 8, at + 8 + length),
      crcOk: png.readUInt32BE(at + 8 + length) === (crc32(png.subarray(at + 4, at + 8 + length)) >>> 0),
    })
    at += 12 + length
    if (type === 'IEND') break
  }
  return out
}

describe.each(icons)('icon %s (%s)', (size, path) => {
  const file = resolve(root, path)

  test('exists', () => {
    expect(existsSync(file)).toBe(true)
  })

  test('is a PNG a strict decoder will accept', () => {
    const png = readFileSync(file)
    expect(png.subarray(0, 8)).toEqual(SIGNATURE)
    const bad = chunks(png).filter(c => !c.crcOk)
    expect(bad.map(c => c.type)).toEqual([])
  })

  test(`is ${size}x${size}`, () => {
    const ihdr = chunks(readFileSync(file)).find(c => c.type === 'IHDR')!
    expect([ihdr.data.readUInt32BE(0), ihdr.data.readUInt32BE(4)]).toEqual([Number(size), Number(size)])
  })
})
