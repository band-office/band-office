import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const outputRoot = path.join(root, "dist-server");
const bundleName = `Band-Office-Server-${packageJson.version}`;
const bundleDirectory = path.join(outputRoot, bundleName);
const imageArgumentIndex = process.argv.indexOf("--image");
const releaseImage = imageArgumentIndex >= 0 ? process.argv[imageArgumentIndex + 1] : null;

if (imageArgumentIndex >= 0 && (!releaseImage || !/^[a-z0-9./_-]+(?::[^@\s]+|@sha256:[a-f0-9]{64})$/i.test(releaseImage))) {
  throw new Error("--image must be followed by a valid container image tag or SHA-256 digest reference.");
}

await rm(bundleDirectory, { recursive: true, force: true });
await mkdir(bundleDirectory, { recursive: true });
await cp(path.join(root, "deploy/server"), bundleDirectory, { recursive: true });

const documentation = [
  "LICENSE",
  "NOTICE",
  "SERVER_ALPHA_RELEASE.md",
  "SERVER_DEPLOYMENT.md",
  "SERVER_ACCEPTANCE_RECORD.md",
  "SERVER_OPERATOR_HANDOFF.md",
  "PORTAL_ACTIVATION.md",
  "SERVER_BACKUP_RESTORE.md",
  "SERVER_UPGRADE.md",
  "SERVER_SUPPORT_BOUNDARY.md",
];
for (const filename of documentation) {
  await cp(path.join(root, filename), path.join(bundleDirectory, filename));
}

if (releaseImage) {
  const envPath = path.join(bundleDirectory, ".env.example");
  const envText = await readFile(envPath, "utf8");
  await writeFile(
    envPath,
    envText.replace(/^BAND_OFFICE_IMAGE=.*$/m, `BAND_OFFICE_IMAGE=${releaseImage}`),
  );
}

const bundleFiles = [
  ".env.example",
  "Caddyfile",
  "compose.yml",
  "secrets/README.md",
  ...documentation,
];
const checksumLines = [];
for (const filename of bundleFiles) {
  const bytes = await readFile(path.join(bundleDirectory, filename));
  checksumLines.push(`${createHash("sha256").update(bytes).digest("hex")}  ${filename}`);
}
await writeFile(path.join(bundleDirectory, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`);

const zip = new JSZip();
for (const filename of [...bundleFiles, "SHA256SUMS.txt"]) {
  zip.file(`${bundleName}/${filename}`, await readFile(path.join(bundleDirectory, filename)));
}
const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const archivePath = path.join(outputRoot, `${bundleName}.zip`);
await writeFile(archivePath, archive);
await writeFile(
  path.join(outputRoot, "SHA256SUMS.txt"),
  `${createHash("sha256").update(archive).digest("hex")}  ${bundleName}.zip\n`,
);

console.log(`Built ${path.relative(root, archivePath)}${releaseImage ? ` for ${releaseImage}` : " with the release-image placeholder"}.`);
