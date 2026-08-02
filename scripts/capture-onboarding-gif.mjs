import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const port = 3104;
const baseURL = `http://127.0.0.1:${port}`;
const databasePath = "data/e2e.db";
const outputDirectory = path.join(root, "docs", "screenshots");
const outputPath = path.join(outputDirectory, "first-run-setup.gif");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");

await mkdir(outputDirectory, { recursive: true });
await execFileAsync(process.execPath, ["--import", "tsx", "scripts/prepare-test-db.ts"], {
  cwd: root,
  env: { ...process.env, BANDOS_TEST_DATABASE_PATH: databasePath },
});

const framesDirectory = await mkdtemp(path.join(os.tmpdir(), "band-office-first-run-"));
const server = spawn(process.execPath, [nextCli, "dev", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: {
    ...process.env,
    DATABASE_URL: "file:./data/e2e.db",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Onboarding preview exited before startup.\n${serverOutput}`);
    try {
      const response = await fetch(`${baseURL}/login`);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for onboarding preview.\n${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();

  await page.goto(`${baseURL}/login?setup=1`);
  await page.getByRole("heading", { name: "Create the director account" }).waitFor();
  await page.screenshot({ path: path.join(framesDirectory, "frame-01.png"), animations: "disabled" });

  await page.getByRole("link", { name: "Fictional demo" }).click();
  await page.getByRole("heading", { name: "Explore the fictional demo" }).waitFor();
  await page.screenshot({ path: path.join(framesDirectory, "frame-02.png"), animations: "disabled" });

  await context.close();
  await execFileAsync(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-y", "-framerate", "1/2", "-i", path.join(framesDirectory, "frame-%02d.png"),
    "-vf", "fps=8,scale=960:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
    "-loop", "0", outputPath,
  ]);
  console.log(`Captured ${outputPath}.`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    const timeout = setTimeout(resolve, 5_000);
    server.once("exit", () => { clearTimeout(timeout); resolve(); });
  });
  await rm(framesDirectory, { recursive: true, force: true });
}
