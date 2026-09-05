import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "media", "source", "open-md-preview-imagegen.png");
const outputs = [
  [256, path.join(root, "media", "icon.png")],
  [64, path.join(root, "media", "qa", "icon-64.png")],
  [32, path.join(root, "media", "qa", "icon-32.png")],
];

for (const [size, output] of outputs) {
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(source)
    .ensureAlpha()
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(output);
}

console.log("Rendered the 256, 64, and 32 pixel icon assets from the accepted Imagegen source.");
