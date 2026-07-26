const applicationUrl = process.env.BAND_OFFICE_INTERNAL_URL || "http://app:3000";
const workerToken = process.env.BANDOS_WORKER_TOKEN?.trim();
const configuredInterval = Number(process.env.BAND_OFFICE_WORKER_INTERVAL_MS || "30000");
const intervalMs = Number.isFinite(configuredInterval)
  ? Math.min(300_000, Math.max(5_000, configuredInterval))
  : 30_000;

if (!workerToken || workerToken.length < 32) {
  console.error("[communications-worker] A worker token of at least 32 characters is required.");
  process.exit(1);
}

let stopping = false;
const stop = () => {
  stopping = true;
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

async function run() {
  try {
    const response = await fetch(`${applicationUrl}/api/internal/communications/worker`, {
      method: "POST",
      headers: { authorization: `Bearer ${workerToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 401 || response.status === 403) {
      console.error("[communications-worker] Authorization failed; check the shared worker secret.");
      process.exit(1);
    }
    if (!response.ok) {
      console.error(`[communications-worker] Band Office returned HTTP ${response.status}.`);
    } else {
      const payload = await response.json();
      if (payload.processed) console.log(`[communications-worker] Processed ${payload.processed} scheduled job(s).`);
    }
  } catch (error) {
    console.error(`[communications-worker] Request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

while (!stopping) {
  await run();
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
