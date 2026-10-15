import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { expect, test } from 'vitest'
import { companionMotionAgents, COMPANION_MOTION_COLUMNS, COMPANION_MOTION_ROWS } from '../shared/companionMotion'
import { COMPANION_MOTION_FRAME_ATLASES } from '../shared/companionMotionFrames.generated'

const motionAssetNames = { AMIRA: 'amina', MIRO: 'misu', KAI: 'kai' } as const

for (const agent of companionMotionAgents) {
  test(`${agent.name} has a transparent face atlas with distinct full-head expression frames`, async () => {
    const filename = fileURLToPath(new URL(`../public${agent.atlas}`, import.meta.url))
    const metadata = await sharp(filename).metadata()
    expect(metadata.width).toBe(1024)
    expect(metadata.height).toBe(1536)
    expect(metadata.hasAlpha).toBe(true)
    const cellWidth = metadata.width! / COMPANION_MOTION_COLUMNS
    const cellHeight = metadata.height! / COMPANION_MOTION_ROWS
    expect(cellWidth).toBe(cellHeight)
    const framing = COMPANION_MOTION_FRAME_ATLASES[agent.id]
    expect(framing.frames).toHaveLength(COMPANION_MOTION_COLUMNS * COMPANION_MOTION_ROWS)
    for (let row = 0; row < COMPANION_MOTION_ROWS; row += 1) {
      const hashes = []
      for (let column = 0; column < COMPANION_MOTION_COLUMNS; column += 1) {
        const rectangle = framing.frames[row * COMPANION_MOTION_COLUMNS + column]!
        const pixels = await sharp(filename).extract({ left: rectangle.x, top: rectangle.y, width: rectangle.width, height: rectangle.height }).ensureAlpha().raw().toBuffer()
        const alpha = pixels.filter((_, index) => index % 4 === 3)
        expect(alpha.some(value => value === 0), `Transparent margins in ${agent.name} row ${row}, frame ${column}`).toBe(true)
        expect(alpha.some(value => value > 0), `Visible face in ${agent.name} row ${row}, frame ${column}`).toBe(true)
        hashes.push(createHash('sha256').update(pixels).digest('hex'))
      }
      expect(new Set(hashes).size, `${agent.name} row ${row} must contain actual changing artwork`).toBeGreaterThan(1)
    }
  })

  test(`${agent.name} available appearance masks register to the same 24 full-head frames`, async () => {
    const filename = fileURLToPath(new URL(`../public${agent.atlas}`, import.meta.url))
    const atlas = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (const layer of agent.id === 'AMIRA' ? ['skin', 'hair'] : ['skin', 'hair', 'eyes']) {
      const maskFilename = fileURLToPath(new URL(`../public/mascots/appearance-motion-v1/${motionAssetNames[agent.id]}-${layer}.png`, import.meta.url))
      const metadata = await sharp(maskFilename).metadata()
      expect(metadata.width).toBe(atlas.info.width)
      expect(metadata.height).toBe(atlas.info.height)
      expect(metadata.hasAlpha).toBe(true)
      const mask = await sharp(maskFilename).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      let outsideFace = 0
      for (let pixel = 0; pixel < atlas.info.width * atlas.info.height; pixel += 1) {
        const maskAlpha = mask.data[pixel * 4 + 3]!
        const faceAlpha = atlas.data[pixel * 4 + 3]!
        if (maskAlpha > 0 && faceAlpha === 0) outsideFace += 1
      }
      expect(outsideFace, `${agent.name} ${layer} must not color transparent space outside the original face`).toBe(0)
      const visibleByFrame = COMPANION_MOTION_FRAME_ATLASES[agent.id].frames.map(rectangle => {
        let visible = 0
        for (let pixelRow = rectangle.y; pixelRow < rectangle.y + rectangle.height; pixelRow += 1) {
          for (let pixelColumn = rectangle.x; pixelColumn < rectangle.x + rectangle.width; pixelColumn += 1) {
            if (mask.data[(pixelRow * atlas.info.width + pixelColumn) * 4 + 3]! > 0) visible += 1
          }
        }
        return visible
      })
      expect(visibleByFrame.reduce((sum, count) => sum + count, 0), `${agent.name} ${layer} must not be an empty mask`).toBeGreaterThan(0)
      if (layer !== 'eyes') expect(visibleByFrame.every(count => count > 0), `${agent.name} ${layer} must cover every animated frame`).toBe(true)
    }
  })
}
