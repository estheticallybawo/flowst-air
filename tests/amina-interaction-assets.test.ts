import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { expect, test } from 'vitest'

const artworkUrl = new URL('../public/mascots/amina-expression-atlas-v1.png', import.meta.url)
const originalArtworkHash = 'db74da7a1fe1e1fb56ec567ff99c97b1ba7fda8389d97b4d2556895c9256bfc5'

test('Amina interaction keeps the original eight half-body mouth and gesture frames', async () => {
  const bytes = await readFile(artworkUrl)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(originalArtworkHash)
  const metadata = await sharp(bytes).metadata()
  expect({ width: metadata.width, height: metadata.height, alpha: metadata.hasAlpha }).toEqual({ width: 1448, height: 1086, alpha: true })
  const hashes = []
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const pixels = await sharp(bytes).extract({ left: column * 362, top: row * 543, width: 362, height: 543 }).ensureAlpha().raw().toBuffer()
      expect(pixels.some((value, index) => index % 4 === 3 && value > 0), `Visible artwork in half-body frame ${row * 4 + column}`).toBe(true)
      hashes.push(createHash('sha256').update(pixels).digest('hex'))
    }
  }
  expect(new Set(hashes).size).toBe(8)
  expect(new Set(hashes.slice(0, 4)).size, 'Speaking keeps four distinct mouth artwork frames').toBe(4)
})

for (const region of ['skin', 'hair']) {
  test(`Amina interaction ${region} mask registers to all eight unchanged half-body frames`, async () => {
    const source = await sharp(await readFile(artworkUrl)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const mask = await sharp(await readFile(new URL(`../public/mascots/appearance-interaction-v1/amina-${region}.png`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect({ width: mask.info.width, height: mask.info.height, channels: mask.info.channels }).toEqual({ width: 1448, height: 1086, channels: 4 })
    const visibleByFrame = Array(8).fill(0) as number[]
    let outsideSource = 0
    for (let pixel = 0; pixel < source.info.width * source.info.height; pixel += 1) {
      const alpha = mask.data[pixel * 4 + 3]!
      if (alpha === 0) continue
      if (source.data[pixel * 4 + 3] === 0) outsideSource += 1
      const column = Math.floor(pixel % source.info.width / 362)
      const row = Math.floor(Math.floor(pixel / source.info.width) / 543)
      visibleByFrame[row * 4 + column]! += 1
    }
    expect(outsideSource, `${region} must not recolor transparent space`).toBe(0)
    expect(visibleByFrame.every(count => count > 0), `${region} must cover all eight body frames`).toBe(true)
  })
}
