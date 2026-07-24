import { BookOpenCheck } from "lucide-react";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

const outputDirectory = path.resolve("desktop/assets");
await mkdir(outputDirectory, { recursive: true });

const glyph = renderToStaticMarkup(React.createElement(BookOpenCheck, {
  width: 590,
  height: 590,
  color: "#ffffff",
  strokeWidth: 1.65,
  fill: "none",
}));
const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#14372b"/><rect x="104" y="104" width="816" height="816" rx="176" fill="#1c7758"/><circle cx="792" cy="232" r="54" fill="#e7ad4e"/></svg>`);

await sharp(background)
  .composite([{ input: Buffer.from(glyph), left: 217, top: 217 }])
  .png()
  .toFile(path.join(outputDirectory, "icon.png"));

console.log("Generated desktop/assets/icon.png from the BandOS Lucide brand mark.");
