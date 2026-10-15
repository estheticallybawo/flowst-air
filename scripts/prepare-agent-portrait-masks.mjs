import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const names = ['misu', 'kai'];
const regions = ['skin', 'hair', 'eyes'];
const ramp = (value, start, end) => Math.max(0, Math.min(1, (value - start) / (end - start)));

function sourceGuard(region, red, green, blue) {
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  if (region === 'skin') return ramp(red - green, 7, 22) * ramp(red - blue, 8, 28);
  if (region === 'hair') return ramp(blue - green, 7, 22) * ramp(blue - red, -2, 12);
  return ramp(blue - green, 7, 22) * ramp(blue - red, -45, -18)
    * ramp(brightest, 30, 65) * ramp(brightest - darkest, 10, 25)
    * (1 - ramp(darkest, 145, 200));
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.some(argument => argument !== '--check')) throw new Error('Usage: node scripts/prepare-agent-portrait-masks.mjs [--check]');
  const check = argumentsList.includes('--check');
  const outputs = [];
  for (const name of names) {
    const sourcePath = path.join(projectRoot, `public/optimized/v1/mascots/${name}/portrait.webp`);
    const mapPath = path.join(projectRoot, `scripts/assets/agent-appearance/${name}-portrait-regions.png`);
    const source = await sharp(sourcePath).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const metadata = await sharp(mapPath).metadata();
    const { width, height } = source.info;
    if (!metadata.width || !metadata.height || Math.abs(metadata.width / metadata.height / (width / height) - 1) > 0.01)
      throw new Error(`${name}: semantic map aspect ratio does not match the original portrait`);
    const segmentation = await sharp(mapPath).resize(width, height, { fit: 'fill' }).toColourspace('srgb').ensureAlpha().raw().toBuffer();
    for (const region of regions) {
      const pixels = Buffer.alloc(width * height * 4);
      const selectedChannel = region === 'skin' ? 1 : region === 'hair' ? 0 : 2;
      let selectedPixels = 0;
      let effectivePixels = 0;
      for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        const channels = [segmentation[offset], segmentation[offset + 1], segmentation[offset + 2]];
        const competing = channels.filter((_, channelIndex) => channelIndex !== selectedChannel);
        const semanticAlpha = ramp(channels[selectedChannel] - Math.max(...competing), 30, 210) * segmentation[offset + 3] / 255;
        const alpha = Math.round(255 * semanticAlpha * source.data[offset + 3] / 255
          * sourceGuard(region, source.data[offset], source.data[offset + 1], source.data[offset + 2]));
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
        pixels[offset + 3] = alpha;
        if (alpha >= 16) selectedPixels += 1;
        effectivePixels += alpha / 255;
      }
      if (selectedPixels === 0) throw new Error(`${name} ${region}: mask is empty`);
      outputs.push({ name, region, width, height, pixels, selectedPixels, coveragePercent: Math.round(effectivePixels / (width * height) * 10000) / 100 });
    }
  }
  const outputDirectory = path.join(projectRoot, 'public/mascots/appearance-v1');
  if (!check) await fs.mkdir(outputDirectory, { recursive: true });
  for (const { pixels, ...metadata } of outputs) {
    const encoded = await sharp(pixels, { raw: { width: metadata.width, height: metadata.height, channels: 4 } }).png().toBuffer();
    const target = path.join(outputDirectory, `${metadata.name}-${metadata.region}.png`);
    if (check) {
      if (!(await fs.readFile(target)).equals(encoded)) throw new Error(`Generated mask differs: ${target}`);
    } else await fs.writeFile(target, encoded);
    console.log(JSON.stringify({ ...metadata, written: !check }));
  }
}

main().catch(cause => { console.error(cause.message); process.exitCode = 1; });
