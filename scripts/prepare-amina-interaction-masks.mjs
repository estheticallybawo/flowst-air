import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceHash = 'db74da7a1fe1e1fb56ec567ff99c97b1ba7fda8389d97b4d2556895c9256bfc5';
const ramp = (value, start, end) => Math.max(0, Math.min(1, (value - start) / (end - start)));

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.some(argument => argument !== '--check')) throw new Error('Usage: node scripts/prepare-amina-interaction-masks.mjs [--check]');
  const check = argumentsList.includes('--check');
  const sourceBuffer = await fs.readFile(path.join(projectRoot, 'public/mascots/amina-expression-atlas-v1.png'));
  if (createHash('sha256').update(sourceBuffer).digest('hex') !== sourceHash)
    throw new Error('Amina interaction artwork differs from the reviewed deployed source; do not reuse its masks without review');
  const source = await sharp(sourceBuffer).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = source.info;
  if (width !== 1448 || height !== 1086) throw new Error('Expected the original 1448-by-1086, 4-by-2 interaction sheet');
  const mapPath = path.join(projectRoot, 'scripts/assets/agent-appearance/amina-interaction-regions.png');
  const metadata = await sharp(mapPath).metadata();
  if (!metadata.width || !metadata.height || Math.abs(metadata.width / metadata.height / (width / height) - 1) > 0.01)
    throw new Error('Interaction region map aspect does not match the original artwork');
  const segmentation = await sharp(mapPath).resize(width, height, { fit: 'fill' }).toColourspace('srgb').ensureAlpha().raw().toBuffer();
  const outputs = [];
  for (const region of ['skin', 'hair']) {
    const pixels = Buffer.alloc(width * height * 4);
    const selectedChannel = region === 'skin' ? 1 : 0;
    const cells = Array.from({ length: 8 }, (_, index) => ({ row: Math.floor(index / 4), column: index % 4, selectedPixels: 0 }));
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
      const offset = pixelIndex * 4;
      const red = source.data[offset];
      const green = source.data[offset + 1];
      const blue = source.data[offset + 2];
      const sourceAlpha = source.data[offset + 3];
      const channels = [segmentation[offset], segmentation[offset + 1], segmentation[offset + 2]];
      const competing = channels.filter((_, channelIndex) => channelIndex !== selectedChannel);
      const semanticAlpha = ramp(channels[selectedChannel] - Math.max(...competing), 30, 210) * segmentation[offset + 3] / 255;
      const guard = region === 'skin'
        ? ramp(red - green, 7, 22) * ramp(red - blue, 8, 28)
        : 1 - ramp(Math.max(red, green, blue), 95, 150);
      const alpha = Math.round(255 * semanticAlpha * sourceAlpha / 255 * ramp(sourceAlpha, 24, 220) * guard);
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = alpha;
      if (alpha >= 16) {
        const column = Math.floor(pixelIndex % width / (width / 4));
        const row = Math.floor(Math.floor(pixelIndex / width) / (height / 2));
        cells[row * 4 + column].selectedPixels += 1;
      }
    }
    if (cells.some(cell => cell.selectedPixels === 0)) throw new Error(`${region}: every mouth and gesture frame requires a nonempty mask`);
    outputs.push({ region, width, height, pixels, cells });
  }
  const outputDirectory = path.join(projectRoot, 'public/mascots/appearance-interaction-v1');
  if (!check) await fs.mkdir(outputDirectory, { recursive: true });
  for (const { pixels, ...metadata } of outputs) {
    const encoded = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const target = path.join(outputDirectory, `amina-${metadata.region}.png`);
    if (check) {
      if (!(await fs.readFile(target)).equals(encoded)) throw new Error(`Generated interaction mask differs: ${target}`);
    } else await fs.writeFile(target, encoded);
    console.log(JSON.stringify({ ...metadata, written: !check }));
  }
}

main().catch(cause => { console.error(cause.message); process.exitCode = 1; });
