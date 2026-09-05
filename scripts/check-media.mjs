import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "media", "source", "open-md-preview-imagegen.png");

for (const [size, relative] of [
  [256, "media/icon.png"],
  [64, "media/qa/icon-64.png"],
  [32, "media/qa/icon-32.png"],
]) {
  const expected = await sharp(source)
    .ensureAlpha()
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const filename = path.join(root, relative);
  assert.deepEqual(await readFile(filename), expected, `${relative} is stale. Run pnpm run render:media.`);
  await verifyAlphaPng(filename, size, size, relative);
}

await verifyAlphaPng(source, 1254, 1254, "Imagegen source");
await verifyVisibleBounds(source);
await verifyAlphaPng(path.join(root, "media", "preview.png"), undefined, undefined, "Marketplace preview", {
  minWidth: 640,
  minHeight: 200,
  maxWidth: 1200,
  maxHeight: 800,
});
console.log("Media checks passed: provider source, direct icon sizes, native alpha, bounds, and runtime preview.");

async function verifyAlphaPng(filename, expectedWidth, expectedHeight, label, bounds) {
  const image = sharp(filename);
  const metadata = await image.metadata();
  assert.equal(metadata.format, "png", `${label} must be PNG.`);
  if (expectedWidth !== undefined) assert.equal(metadata.width, expectedWidth, `${label} width changed.`);
  if (expectedHeight !== undefined) assert.equal(metadata.height, expectedHeight, `${label} height changed.`);
  if (bounds) {
    assert.ok(metadata.width >= bounds.minWidth && metadata.width <= bounds.maxWidth, `${label} width is outside the accepted range.`);
    assert.ok(metadata.height >= bounds.minHeight && metadata.height <= bounds.maxHeight, `${label} height is outside the accepted range.`);
  }
  assert.equal(metadata.hasAlpha, true, `${label} must carry native alpha.`);
  assert.equal(metadata.channels, 4, `${label} must have four channels.`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = info.channels - 1;
  const corners = [
    alpha,
    (info.width - 1) * info.channels + alpha,
    (info.height - 1) * info.width * info.channels + alpha,
    ((info.height * info.width) - 1) * info.channels + alpha,
  ];
  assert.ok(corners.every((offset) => data[offset] === 0), `${label} corners must be transparent.`);
}

async function verifyVisibleBounds(filename) {
  const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = info.channels - 1;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + alpha] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  assert.ok(right >= left && bottom >= top, "Imagegen source has no visible pixels.");
  const widthRatio = (right - left + 1) / info.width;
  const heightRatio = (bottom - top + 1) / info.height;
  const primary = Math.max(widthRatio, heightRatio);
  const secondary = Math.min(widthRatio, heightRatio);
  assert.ok(primary >= 0.8 && primary <= 0.9, `Icon primary bounds must occupy 80-90%; got ${(primary * 100).toFixed(1)}%.`);
  assert.ok(secondary >= 0.72, `Icon secondary bounds contain excess padding; got ${(secondary * 100).toFixed(1)}%.`);
}
