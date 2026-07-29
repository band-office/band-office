import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDirectory = path.join(root, "docs", "brand", "github");
const markPath = path.join(root, "public", "brand", "band-office-mark.png");

await mkdir(outputDirectory, { recursive: true });

const mark = await readFile(markPath);
const markDataUri = `data:image/png;base64,${mark.toString("base64")}`;

const palette = {
  midnight: "#08172B",
  midnightDeep: "#04101F",
  blue: "#2563EB",
  blueLight: "#93C5FD",
  paper: "#F8FAFC",
  slate: "#A9B8CC",
  white: "#FFFFFF",
};

function staffLines(width, startX, endX, startY, rows, spacing, opacity = 0.08) {
  return Array.from({ length: rows }, (_, index) => {
    const y = startY + index * spacing;
    return `<line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="${palette.blueLight}" stroke-width="2" opacity="${opacity}" />`;
  }).join("");
}

function pill(x, y, width, label) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="42" rx="21" fill="#102845" stroke="#284567" />
      <text x="${x + width / 2}" y="${y + 27}" text-anchor="middle" fill="#DCE9F8" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700">${label}</text>
    </g>`;
}

function svgDocument(width, height, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.midnightDeep}" />
      <stop offset="0.62" stop-color="${palette.midnight}" />
      <stop offset="1" stop-color="#0D2340" />
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.15" r="0.8">
      <stop offset="0" stop-color="${palette.blue}" stop-opacity="0.20" />
      <stop offset="1" stop-color="${palette.blue}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#background)" />
  <rect width="${width}" height="${height}" fill="url(#glow)" />
  ${body}
</svg>`;
}

const hero = svgDocument(
  1600,
  520,
  `
  ${staffLines(1600, 920, 1540, 72, 5, 34)}
  ${staffLines(1600, 1020, 1540, 360, 3, 34, 0.05)}
  <circle cx="1485" cy="140" r="7" fill="${palette.blue}" opacity="0.65" />
  <circle cx="1434" cy="174" r="7" fill="${palette.blueLight}" opacity="0.40" />
  <image href="${markDataUri}" x="92" y="84" width="352" height="352" />
  <line x1="490" y1="84" x2="490" y2="436" stroke="#29425F" stroke-width="2" />
  <text x="548" y="186" fill="${palette.white}" font-family="Inter, Arial, sans-serif" font-size="80" font-weight="800" letter-spacing="-3">Band Office</text>
  <text x="552" y="242" fill="${palette.blueLight}" font-family="Inter, Arial, sans-serif" font-size="27" font-weight="650">Open-source operations for school music programs.</text>
  <text x="552" y="300" fill="${palette.slate}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2.2">LOCAL-FIRST  ·  SELF-HOSTED  ·  PROGRAM OWNERSHIP</text>
  ${pill(548, 344, 118, "People")}
  ${pill(682, 344, 142, "Inventory")}
  ${pill(840, 344, 112, "Events")}
  ${pill(968, 344, 164, "Communications")}
  ${pill(1148, 344, 110, "Forms")}
  `,
);

const socialPreview = svgDocument(
  1280,
  640,
  `
  ${staffLines(1280, 710, 1230, 88, 5, 38)}
  ${staffLines(1280, 820, 1230, 450, 3, 38, 0.05)}
  <rect x="70" y="70" width="500" height="500" rx="38" fill="#0B1F38" stroke="#213B5A" stroke-width="2" />
  <image href="${markDataUri}" x="144" y="144" width="352" height="352" />
  <text x="632" y="250" fill="${palette.white}" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="800" letter-spacing="-2.5">Band Office</text>
  <text x="636" y="312" fill="${palette.blueLight}" font-family="Inter, Arial, sans-serif" font-size="29" font-weight="650">Open-source operations</text>
  <text x="636" y="352" fill="${palette.blueLight}" font-family="Inter, Arial, sans-serif" font-size="29" font-weight="650">for school music programs.</text>
  <line x1="636" y1="402" x2="1150" y2="402" stroke="#29425F" stroke-width="2" />
  <text x="636" y="450" fill="${palette.slate}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2">SELF-HOSTED  ·  APACHE 2.0</text>
  `,
);

const organizationBanner = svgDocument(
  1600,
  420,
  `
  ${staffLines(1600, 1030, 1540, 54, 5, 30)}
  <image href="${markDataUri}" x="94" y="60" width="300" height="300" />
  <text x="446" y="176" fill="${palette.white}" font-family="Inter, Arial, sans-serif" font-size="74" font-weight="800" letter-spacing="-2.5">Band Office</text>
  <text x="450" y="234" fill="${palette.blueLight}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="650">Open-source operations for school music programs.</text>
  <text x="450" y="294" fill="${palette.slate}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2.1">BUILT FOR DIRECTORS  ·  OPEN TO THE COMMUNITY</text>
  `,
);

const assets = [
  ["readme-hero", hero, 1600, 520],
  ["social-preview", socialPreview, 1280, 640],
  ["organization-banner", organizationBanner, 1600, 420],
];

await sharp(mark)
  .resize(1024, 1024, { fit: "contain" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDirectory, "avatar-1024.png"));

for (const [name, source, width, height] of assets) {
  const editableSource = source.replaceAll(markDataUri, "avatar-1024.png");
  const normalizedSource = `${editableSource.replace(/[ \t]+$/gm, "").trimEnd()}\n`;
  await writeFile(path.join(outputDirectory, `${name}.svg`), normalizedSource);
  await sharp(Buffer.from(source))
    .resize(width, height)
    .png({ compressionLevel: 9, palette: true, quality: 100 })
    .toFile(path.join(outputDirectory, `${name}.png`));
}

console.log(`Generated ${assets.length + 1} GitHub brand assets.`);
