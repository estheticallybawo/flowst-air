import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const atlasColumns = 4;
const atlasRows = 6;
const specifications = {
  amina: { regions: ['skin', 'hair'], closedEyeCells: [] },
  misu: { regions: ['skin', 'hair', 'eyes'], closedEyeCells: ['0:2', '4:1', '5:2'] },
  kai: { regions: ['skin', 'hair', 'eyes'], closedEyeCells: ['0:2', '3:1', '4:1', '5:2'] },
};
const ramp = (value, start, end) => Math.max(0, Math.min(1, (value - start) / (end - start)));

function options(argumentsList) {
  const configuration = { agent: null, check: false, help: false };
  for (let argumentIndex = 0; argumentIndex < argumentsList.length; argumentIndex += 1) {
    const argument = argumentsList[argumentIndex];
    if (argument === '--check') configuration.check = true;
    else if (argument === '--help') configuration.help = true;
    else if (argument === '--agent') configuration.agent = argumentsList[++argumentIndex];
    else if (argument.startsWith('--agent=')) configuration.agent = argument.slice('--agent='.length);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (configuration.agent !== null && !Object.hasOwn(specifications, configuration.agent))
    throw new Error('--agent must be amina, misu, or kai');
  return configuration;
}

async function readRgba(relativePath) {
  try {
    return await sharp(path.join(projectRoot, relativePath)).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch (cause) {
    throw new Error(`Cannot decode ${relativePath}: ${cause.message}`, { cause });
  }
}

function sourceGuard(name, region, red, green, blue) {
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  if (region === 'skin') return ramp(red - green, 7, 22) * ramp(red - blue, 8, 28);
  if (region === 'hair') return name === 'amina'
    ? 1 - ramp(brightest, 95, 150)
    : ramp(blue - green, 7, 22) * ramp(blue - red, -2, 12);
  return ramp(blue - green, 7, 22)
    * ramp(blue - red, -45, -18)
    * ramp(brightest, 30, 65)
    * ramp(brightest - darkest, 10, 25)
    * (1 - ramp(darkest, 145, 200));
}

function createRegion(name, region, source, segmentation, cellSize) {
  const { width, height } = source.info;
  const pixels = Buffer.alloc(width * height * 4);
  const cells = Array.from({ length: atlasRows * atlasColumns }, (_, cellIndex) => ({
    row: Math.floor(cellIndex / atlasColumns),
    column: cellIndex % atlasColumns,
    semanticPixels: 0,
    selectedPixels: 0,
    effectivePixels: 0,
  }));
  const selectedChannel = region === 'skin' ? 1 : region === 'hair' ? 0 : 2;
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const sourceRed = source.data[offset];
    const sourceGreen = source.data[offset + 1];
    const sourceBlue = source.data[offset + 2];
    const sourceAlpha = source.data[offset + 3];
    const channelValues = [segmentation.data[offset], segmentation.data[offset + 1], segmentation.data[offset + 2]];
    const competingChannels = channelValues.filter((_, channelIndex) => channelIndex !== selectedChannel);
    const semanticAlpha = ramp(channelValues[selectedChannel] - Math.max(...competingChannels), 30, 210)
      * segmentation.data[offset + 3] / 255;
    const foregroundAlpha = sourceAlpha / 255 * ramp(sourceAlpha, 24, 220);
    const alpha = Math.round(255 * semanticAlpha * foregroundAlpha * sourceGuard(name, region, sourceRed, sourceGreen, sourceBlue));
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
    pixels[offset + 3] = alpha;
    const cellColumn = Math.floor(pixelIndex % width / cellSize);
    const cellRow = Math.floor(Math.floor(pixelIndex / width) / cellSize);
    const cell = cells[cellRow * atlasColumns + cellColumn];
    if (semanticAlpha > 0.1) cell.semanticPixels += 1;
    if (alpha >= 16) cell.selectedPixels += 1;
    cell.effectivePixels += alpha / 255;
  }
  const selectedPixels = cells.reduce((total, cell) => total + cell.selectedPixels, 0);
  if (selectedPixels === 0) throw new Error(`${name} ${region}: region mask is empty after source-detail protection`);
  for (const cell of cells) {
    const expectedClosedEyes = region === 'eyes' && specifications[name].closedEyeCells.includes(`${cell.row}:${cell.column}`);
    if (cell.selectedPixels === 0 && !expectedClosedEyes)
      throw new Error(`${name} ${region}: empty mask in row ${cell.row + 1}, column ${cell.column + 1}${region === 'eyes' ? ' (visible iris expected)' : ''}`);
    cell.effectivePixels = Math.round(cell.effectivePixels * 100) / 100;
    cell.coveragePercent = Math.round(cell.effectivePixels / (cellSize * cellSize) * 10000) / 100;
    if (region === 'eyes') cell.expectedClosedEyes = expectedClosedEyes;
  }
  for (let row = 0; row < atlasRows; row += 1) {
    const rowCells = cells.filter(cell => cell.row === row);
    if (rowCells.every(cell => cell.selectedPixels === 0) && rowCells.some(cell => !cell.expectedClosedEyes))
      throw new Error(`${name} ${region}: row ${row + 1} is empty`);
  }
  return {
    pixels,
    metadata: {
      agent: name,
      region,
      width,
      height,
      cellSize,
      selectedPixels,
      coveragePercent: Math.round(cells.reduce((total, cell) => total + cell.effectivePixels, 0) / (width * height) * 10000) / 100,
      cells,
    },
  };
}

async function main() {
  const configuration = options(process.argv.slice(2));
  if (configuration.help) {
    console.log('Usage: node scripts/prepare-agent-motion-masks.mjs [--agent amina|misu|kai] [--check]');
    console.log('Reads registered 4×6 face atlases and semantic maps; validates all selected masks before writing. --check validates without writing.');
    return;
  }
  const names = configuration.agent ? [configuration.agent] : Object.keys(specifications);
  const outputs = [];
  for (const name of names) {
    const source = await readRgba(`public/mascots/${name}-motion-atlas-v1.webp`);
    const segmentation = await readRgba(`scripts/assets/agent-appearance/${name}-motion-regions.png`);
    const { width, height } = source.info;
    if (width !== segmentation.info.width || height !== segmentation.info.height)
      throw new Error(`${name}: atlas ${width}×${height} and semantic map ${segmentation.info.width}×${segmentation.info.height} do not match; no resizing is permitted`);
    if (width % atlasColumns !== 0 || height % atlasRows !== 0 || width / atlasColumns !== height / atlasRows)
      throw new Error(`${name}: atlas must have ${atlasColumns}×${atlasRows} square cells, received ${width}×${height}`);
    for (const region of specifications[name].regions) outputs.push(createRegion(name, region, source, segmentation, width / atlasColumns));
  }
  if (!configuration.check) {
    const outputDirectory = path.join(projectRoot, 'public/mascots/appearance-motion-v1');
    await fs.mkdir(outputDirectory, { recursive: true });
    for (const output of outputs) {
      const { agent, region, width, height } = output.metadata;
      await sharp(output.pixels, { raw: { width, height, channels: 4 } }).png().toFile(path.join(outputDirectory, `${agent}-${region}.png`));
    }
  }
  for (const output of outputs) console.log(JSON.stringify({ ...output.metadata, written: !configuration.check }));
}

main().catch(cause => {
  console.error(cause.message);
  process.exitCode = 1;
});
