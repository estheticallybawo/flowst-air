import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, test } from 'vitest';

for (const name of ['misu', 'kai']) {
  test(`${name} portrait masks match the main artwork and protect transparent pixels`, async () => {
    const portrait = fileURLToPath(new URL(`../public/optimized/v1/mascots/${name}/portrait.webp`, import.meta.url));
    const source = await sharp(portrait).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const region of ['skin', 'hair', 'eyes']) {
      const mask = await sharp(fileURLToPath(new URL(`../public/mascots/appearance-v1/${name}-${region}.png`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([mask.info.width, mask.info.height]).toEqual([source.info.width, source.info.height]);
      let selectedPixels = 0;
      let outsideSource = 0;
      let selectedEyeWhite = 0;
      for (let pixelIndex = 0; pixelIndex < mask.info.width * mask.info.height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        const alpha = mask.data[offset + 3]!;
        if (alpha > source.data[offset + 3]!) outsideSource += 1;
        if (alpha >= 16) {
          selectedPixels += 1;
          if (region === 'eyes' && Math.min(source.data[offset]!, source.data[offset + 1]!, source.data[offset + 2]!) >= 200) selectedEyeWhite += 1;
        }
      }
      expect(selectedPixels, `${region} contains usable selected pixels`).toBeGreaterThan(20);
      expect(outsideSource, `${region} stays inside the unchanged portrait`).toBe(0);
      expect(selectedEyeWhite, 'iris colors preserve eye whites and catchlights').toBe(0);
    }
  });
}
