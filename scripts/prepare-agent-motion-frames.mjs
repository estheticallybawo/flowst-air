import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const columns = 4;
const rows = 6;
const seedAlpha = 252;
const foregroundAlpha = 129;
const minimumHeadPixels = 1000;
const identities = { AMIRA: 'amina', MIRO: 'misu', KAI: 'kai' };

function columnComponents(source, width, height, column, cellSize, threshold) {
  const visited = new Uint8Array(cellSize * height);
  const stack = new Int32Array(cellSize * height);
  const components = [];
  for (let start = 0; start < visited.length; start += 1) {
    const offset = (Math.floor(start / cellSize) * width + column * cellSize + start % cellSize) * 4;
    if (visited[start] || source[offset + 3] < threshold) continue;
    let stackSize = 1;
    stack[0] = start;
    visited[start] = 1;
    let pixelCount = 0;
    let minY = height;
    let maxY = 0;
    let totalY = 0;
    while (stackSize > 0) {
      const current = stack[--stackSize];
      const pixelX = current % cellSize;
      const pixelY = Math.floor(current / cellSize);
      pixelCount += 1;
      minY = Math.min(minY, pixelY);
      maxY = Math.max(maxY, pixelY);
      totalY += pixelY;
      const neighbors = [];
      if (pixelX > 0) neighbors.push(current - 1);
      if (pixelX + 1 < cellSize) neighbors.push(current + 1);
      if (pixelY > 0) neighbors.push(current - cellSize);
      if (pixelY + 1 < height) neighbors.push(current + cellSize);
      for (const next of neighbors) {
        const nextOffset = (Math.floor(next / cellSize) * width + column * cellSize + next % cellSize) * 4;
        if (!visited[next] && source[nextOffset + 3] >= threshold) {
          visited[next] = 1;
          stack[stackSize++] = next;
        }
      }
    }
    if (pixelCount >= minimumHeadPixels) components.push({ pixelCount, minY, maxY, centerY: totalY / pixelCount });
  }
  return components.sort((left, right) => left.centerY - right.centerY);
}

function nearestComponent(components, centerY) {
  return components.reduce((nearest, component) => Math.abs(component.centerY - centerY) < Math.abs(nearest.centerY - centerY) ? component : nearest);
}

async function prepareAtlas(name) {
  const sourcePath = path.join(projectRoot, `public/mascots/${name}-motion-atlas-v1.webp`);
  const sourceFile = await fs.readFile(sourcePath);
  const { data, info } = await sharp(sourceFile).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (info.channels !== 4 || width % columns !== 0 || height % rows !== 0 || width / columns !== height / rows)
    throw new Error(`${name}: expected an RGBA atlas with ${columns}×${rows} square cells, received ${width}×${height} with ${info.channels} channels`);
  const cellSize = width / columns;
  const frames = Array(rows * columns);
  const evidence = [];
  for (let column = 0; column < columns; column += 1) {
    const seeds = columnComponents(data, width, height, column, cellSize, seedAlpha);
    const heads = columnComponents(data, width, height, column, cellSize, foregroundAlpha);
    if (seeds.length !== rows || heads.length !== rows)
      throw new Error(`${name} column ${column + 1}: expected exactly ${rows} separate heads; found ${seeds.length} opaque seeds and ${heads.length} foreground components`);
    const usedSeeds = new Set();
    const usedHeads = new Set();
    for (let row = 0; row < rows; row += 1) {
      const expectedCenter = cellSize * (row + 0.5);
      const seed = nearestComponent(seeds, expectedCenter);
      const head = nearestComponent(heads, seed.centerY);
      if (usedSeeds.has(seed) || usedHeads.has(head) || Math.abs(seed.centerY - expectedCenter) >= cellSize / 2)
        throw new Error(`${name} row ${row + 1}, column ${column + 1}: head assignment is ambiguous`);
      if (seed.minY < head.minY || seed.maxY > head.maxY || head.maxY - head.minY + 1 >= cellSize * 1.5)
        throw new Error(`${name} row ${row + 1}, column ${column + 1}: the opaque seed does not identify a single full head`);
      usedSeeds.add(seed);
      usedHeads.add(head);
      frames[row * columns + column] = { x: column * cellSize, y: head.minY, width: cellSize, height: head.maxY - head.minY + 1 };
      evidence.push({ row, column, seedPixels: seed.pixelCount, headPixels: head.pixelCount, minY: head.minY, maxY: head.maxY });
    }
    for (let row = 1; row < rows; row += 1) {
      const previous = frames[(row - 1) * columns + column];
      const current = frames[row * columns + column];
      if (previous.y + previous.height > current.y)
        throw new Error(`${name} column ${column + 1}: adjacent heads overlap vertically; framing cannot safely exclude another face`);
    }
  }
  return { atlas: { width, height, frames }, hash: createHash('sha256').update(sourceFile).digest('hex'), evidence };
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.some(argument => !['--check', '--help'].includes(argument))) throw new Error('Usage: node scripts/prepare-agent-motion-frames.mjs [--check]');
  if (argumentsList.includes('--help')) {
    console.log('Usage: node scripts/prepare-agent-motion-frames.mjs [--check]');
    console.log('Validates six separate opaque head seeds in each column and derives non-overlapping full-head frame rectangles without changing artwork.');
    return;
  }
  const atlases = {};
  const hashes = {};
  const reports = [];
  for (const [identity, name] of Object.entries(identities)) {
    const result = await prepareAtlas(name);
    atlases[identity] = result.atlas;
    hashes[identity] = result.hash;
    reports.push({ agent: name, seedAlpha, foregroundAlpha, columns, rows, frames: result.evidence });
  }
  const moduleSource = `export interface CompanionMotionFrameRect {\n  readonly x: number;\n  readonly y: number;\n  readonly width: number;\n  readonly height: number;\n}\n\nexport const COMPANION_MOTION_FRAME_ATLASES = ${JSON.stringify(atlases, null, 2)} as const;\n\nexport const COMPANION_MOTION_FRAME_SOURCE_HASHES = ${JSON.stringify(hashes, null, 2)} as const;\n`;
  const destination = path.join(projectRoot, 'shared/companionMotionFrames.generated.ts');
  if (argumentsList.includes('--check')) {
    if (await fs.readFile(destination, 'utf8') !== moduleSource) throw new Error('Companion motion framing metadata is stale. Run scripts/prepare-agent-motion-frames.mjs.');
  } else await fs.writeFile(destination, moduleSource);
  for (const report of reports) console.log(JSON.stringify({ ...report, written: !argumentsList.includes('--check') }));
}

main().catch(cause => {
  console.error(cause.message);
  process.exitCode = 1;
});
