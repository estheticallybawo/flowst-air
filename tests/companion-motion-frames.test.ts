import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { COMPANION_MOTION_FRAME_ATLASES, COMPANION_MOTION_FRAME_SOURCE_HASHES } from '../shared/companionMotionFrames.generated'

function headsInColumn(source: Buffer, width: number, height: number, column: number, threshold: number) {
  const cellSize = width / 4
  const visited = new Uint8Array(cellSize * height)
  const stack = new Int32Array(visited.length)
  const components: { count: number; minY: number; maxY: number; centerY: number }[] = []
  for (let start = 0; start < visited.length; start += 1) {
    const sourceOffset = (Math.floor(start / cellSize) * width + column * cellSize + start % cellSize) * 4
    if (visited[start] || source[sourceOffset + 3]! < threshold) continue
    let stackSize = 1
    stack[0] = start
    visited[start] = 1
    let count = 0
    let minY = height
    let maxY = 0
    let sumY = 0
    while (stackSize > 0) {
      const current = stack[--stackSize]!
      const pixelX = current % cellSize
      const pixelY = Math.floor(current / cellSize)
      count += 1
      minY = Math.min(minY, pixelY)
      maxY = Math.max(maxY, pixelY)
      sumY += pixelY
      const neighbors: number[] = []
      if (pixelX > 0) neighbors.push(current - 1)
      if (pixelX + 1 < cellSize) neighbors.push(current + 1)
      if (pixelY > 0) neighbors.push(current - cellSize)
      if (pixelY + 1 < height) neighbors.push(current + cellSize)
      for (const next of neighbors) {
        const nextOffset = (Math.floor(next / cellSize) * width + column * cellSize + next % cellSize) * 4
        if (!visited[next] && source[nextOffset + 3]! >= threshold) {
          visited[next] = 1
          stack[stackSize++] = next
        }
      }
    }
    if (count >= 1000) components.push({ count, minY, maxY, centerY: sumY / count })
  }
  return components.sort((left, right) => left.centerY - right.centerY)
}

describe('companion motion framing metadata', () => {
  it.each([['AMIRA', 'amina'], ['MIRO', 'misu'], ['KAI', 'kai']] as const)('frames every %s head without adjacent-row faces or source changes', async (identity, name) => {
    const bytes = await readFile(new URL(`../public/mascots/${name}-motion-atlas-v1.webp`, import.meta.url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(COMPANION_MOTION_FRAME_SOURCE_HASHES[identity])
    const { data, info } = await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const atlas = COMPANION_MOTION_FRAME_ATLASES[identity]
    expect({ width: info.width, height: info.height }).toEqual({ width: atlas.width, height: atlas.height })
    expect(atlas.frames).toHaveLength(24)
    const cellSize = atlas.width / 4
    for (let column = 0; column < 4; column += 1) {
      const seeds = headsInColumn(data, info.width, info.height, column, 252)
      const heads = headsInColumn(data, info.width, info.height, column, 129)
      expect(seeds, `${name} column ${column}: opaque head seeds`).toHaveLength(6)
      expect(heads, `${name} column ${column}: full head components`).toHaveLength(6)
      for (let row = 0; row < 6; row += 1) {
        const frame = atlas.frames[row * 4 + column]!
        const seed = seeds[row]!
        const head = heads[row]!
        expect(frame).toEqual({ x: column * cellSize, y: head.minY, width: cellSize, height: head.maxY - head.minY + 1 })
        expect(seed.centerY).toBeGreaterThanOrEqual(row * cellSize)
        expect(seed.centerY).toBeLessThan((row + 1) * cellSize)
        expect(seed.minY).toBeGreaterThanOrEqual(frame.y)
        expect(seed.maxY).toBeLessThan(frame.y + frame.height)
        expect(frame.y + frame.height).toBeLessThanOrEqual(atlas.height)
        if (row > 0) {
          const previous = atlas.frames[(row - 1) * 4 + column]!
          expect(previous.y + previous.height).toBeLessThanOrEqual(frame.y)
        }
      }
    }
  })

  it('preserves heads taller than one uniform sprite row rather than clipping them', () => {
    expect(COMPANION_MOTION_FRAME_ATLASES.AMIRA.frames.some(frame => frame.height > 256)).toBe(true)
    expect(COMPANION_MOTION_FRAME_ATLASES.AMIRA.frames[6].height).toBe(270)
  })
})
