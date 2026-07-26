import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const root = process.cwd();
const port = 3103;
const baseURL = `http://127.0.0.1:${port}`;
const outputDirectory = path.join(root, "docs", "screenshots");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");

await mkdir(outputDirectory, { recursive: true });

const server = spawn(process.execPath, [nextCli, "dev", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: {
    ...process.env,
    BANDOS_BRAND_CAPTURE: "1",
    DATABASE_URL: "file:./data/brand.db",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Brand preview server exited before startup.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseURL}/login`);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for the brand preview server.\n${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Username").fill("director");
  await page.getByLabel("Password").fill("BandOffice-Preview-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/today");

  const captures = [
    ["/today", "Today", "today-dashboard.png"],
    ["/roster", "People", "people-directory.png"],
    ["/assets", "Assets", "asset-inventory.png"],
    ["/events/event-summer-rehearsal/attendance", "Attendance", "event-attendance.png"],
    ["/checkout", "Check out an asset", "checkout-station.png"],
  ];

  for (const [route, heading, filename] of captures) {
    await page.goto(`${baseURL}${route}`);
    await page.getByRole("heading", { name: heading, exact: true }).first().waitFor();
    await page.screenshot({
      path: path.join(outputDirectory, filename),
      animations: "disabled",
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/today`);
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  await page.screenshot({
    path: path.join(outputDirectory, "today-mobile.png"),
    animations: "disabled",
  });

  await context.close();
  console.log(`Captured ${captures.length + 1} deterministic fictional-data product screenshots.`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, 5_000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
