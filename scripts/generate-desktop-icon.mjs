import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.resolve("desktop/assets");
await mkdir(outputDirectory, { recursive: true });

await sharp(path.resolve("public/brand/band-office-mark.png"))
  .resize(1024, 1024, { fit: "contain" })
  .png()
  .toFile(path.join(outputDirectory, "icon.png"));

console.log("Generated desktop/assets/icon.png from the Band Office production mark.");
