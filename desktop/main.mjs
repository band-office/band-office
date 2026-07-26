import { app, BrowserWindow, dialog, ipcMain, safeStorage, session } from "electron";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBackupArchive } from "./backup-archive.mjs";
import { applyPendingRestore, PENDING_EVENT_RESTORE_DIRECTORY, PENDING_FORM_RESTORE_DIRECTORY, PENDING_LIBRARY_RESTORE_DIRECTORY, PENDING_RESTORE_FILENAME } from "./data-lifecycle.mjs";
import { runDesktopMigrations } from "./migrations.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let localServerProcess = null;
let applicationOrigin = null;
let isQuitting = false;
let communicationWorkerTimer = null;
const communicationWorkerToken = randomBytes(32).toString("hex");
const applicationStartedAt = new Date().toISOString();

app.setName("Band Office");
app.setPath("userData", path.join(app.getPath("appData"), "BandOS"));
if (process.env.BANDOS_DESKTOP_USER_DATA) app.setPath("userData", path.resolve(process.env.BANDOS_DESKTOP_USER_DATA));
if (!app.requestSingleInstanceLock()) app.quit();

function resourcePath(...parts) {
  return path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), ...parts);
}

async function writeLog(message) {
  const logsDirectory = path.join(app.getPath("userData"), "logs");
  await mkdir(logsDirectory, { recursive: true });
  await appendFile(path.join(logsDirectory, "desktop.log"), `${new Date().toISOString()} ${message}\n`).catch(() => undefined);
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function smtpCredentialPath() {
  return path.join(app.getPath("userData"), "secrets", "smtp-password.json");
}

async function readStoredSmtpPassword() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const payload = JSON.parse(await readFile(smtpCredentialPath(), "utf8"));
    if (typeof payload.encrypted !== "string") return null;
    return safeStorage.decryptString(Buffer.from(payload.encrypted, "base64"));
  } catch {
    return null;
  }
}

async function startApplicationServer(databasePath, smtpPassword) {
  const port = await availablePort();
  const runtimeDirectory = resourcePath("app-runtime", "server");
  const serverEntry = path.join(runtimeDirectory, "server.js");
  const origin = `http://127.0.0.1:${port}`;
  localServerProcess = spawn(process.execPath, [serverEntry], {
    cwd: runtimeDirectory,
    env: {
      ...process.env,
      DATABASE_URL: `file:${databasePath}`,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_PATH: path.join(runtimeDirectory, "runtime-modules"),
      NODE_ENV: "production",
      PORT: String(port),
      BANDOS_WORKER_TOKEN: communicationWorkerToken,
      BANDOS_STARTED_AT: applicationStartedAt,
      ...(smtpPassword && !process.env.BANDOS_SMTP_PASSWORD ? { BANDOS_SMTP_PASSWORD: smtpPassword } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  localServerProcess.stdout?.on("data", (chunk) => void writeLog(`[server] ${String(chunk).trimEnd()}`));
  localServerProcess.stderr?.on("data", (chunk) => void writeLog(`[server:error] ${String(chunk).trimEnd()}`));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (localServerProcess.exitCode !== null) throw new Error(`The application server exited with code ${localServerProcess.exitCode}.`);
    try {
      const response = await fetch(`${origin}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return origin;
    } catch {
      // The standalone server needs a moment to load its native modules and routes.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  localServerProcess.kill();
  throw new Error("The application server did not become ready in time.");
}

function startCommunicationWorker(origin) {
  const processJobs = async () => {
    try {
      const response = await fetch(`${origin}/api/internal/communications/worker`, {
        method: "POST",
        headers: { authorization: `Bearer ${communicationWorkerToken}` },
      });
      if (!response.ok) await writeLog(`[communications] Worker returned ${response.status}`);
    } catch (error) {
      await writeLog(`[communications] Worker request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  void processJobs();
  communicationWorkerTimer = setInterval(() => void processJobs(), 30_000);
}

function installSecurityPolicy(origin) {
  const isApplicationOrigin = (value) => {
    try { return new URL(value).origin === origin; } catch { return false; }
  };
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => (
    permission === "media"
    && details.isMainFrame
    && details.mediaType !== "audio"
    && isApplicationOrigin(details.securityOrigin ?? details.requestingUrl ?? requestingOrigin)
  ));
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const mediaTypes = "mediaTypes" in details ? details.mediaTypes ?? [] : [];
    callback(permission === "media" && details.isMainFrame && mediaTypes.includes("video") && !mediaTypes.includes("audio") && isApplicationOrigin(details.requestingUrl));
  });
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
    callback({ cancel: !isApplicationOrigin(details.url) });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith(origin)) return callback({ responseHeaders: details.responseHeaders });
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"],
      },
    });
  });
}

function installDownloadDialogs() {
  session.defaultSession.on("will-download", (_event, item) => {
    item.pause();
    void dialog.showSaveDialog(mainWindow, { defaultPath: item.getFilename() }).then((result) => {
      if (result.canceled || !result.filePath) item.cancel();
      else {
        item.setSavePath(result.filePath);
        item.resume();
      }
    });
  });
}

async function createWindow(origin) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: "Band Office",
    backgroundColor: "#f5f6f4",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(desktopDirectory, "preload.cjs"),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.once("closed", () => { mainWindow = null; });
  await mainWindow.loadURL(origin);
  if (process.env.BANDOS_DESKTOP_SMOKE_SCREENSHOT) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const image = await mainWindow.webContents.capturePage();
    await writeFile(path.resolve(process.env.BANDOS_DESKTOP_SMOKE_SCREENSHOT), image.toPNG());
    await writeLog("Desktop smoke capture completed");
    app.exit(0);
  }
}

async function bootstrap() {
  const dataDirectory = path.join(app.getPath("userData"), "data");
  const snapshotsDirectory = path.join(app.getPath("userData"), "recovery-snapshots");
  const databasePath = path.join(dataDirectory, "bandos.db");
  await mkdir(dataDirectory, { recursive: true });
  const restoredSnapshot = await applyPendingRestore({ dataDirectory, databasePath, snapshotsDirectory });
  if (restoredSnapshot) await writeLog(`Applied verified restore; prior database preserved at ${restoredSnapshot}`);
  const migrationResult = await runDesktopMigrations({ databasePath, migrationsDirectory: resourcePath("prisma", "migrations"), snapshotsDirectory });
  if (migrationResult.applied.length) await writeLog(`Applied migrations: ${migrationResult.applied.join(", ")}`);
  const storedSmtpPassword = await readStoredSmtpPassword();
  applicationOrigin = await startApplicationServer(databasePath, storedSmtpPassword);
  installSecurityPolicy(applicationOrigin);
  installDownloadDialogs();
  startCommunicationWorker(applicationOrigin);

  ipcMain.handle("bandos:email-credential-status", () => ({
    available: safeStorage.isEncryptionAvailable(),
    stored: Boolean(storedSmtpPassword),
  }));
  ipcMain.handle("bandos:store-email-credential", async (_event, payload) => {
    if (!safeStorage.isEncryptionAvailable()) return { error: "Secure credential storage is not available on this computer." };
    const password = typeof payload?.password === "string" ? payload.password : "";
    if (!password || password.length > 4096) return { error: "Enter a valid SMTP password." };
    const secretPath = smtpCredentialPath();
    await mkdir(path.dirname(secretPath), { recursive: true });
    await writeFile(secretPath, JSON.stringify({ encrypted: safeStorage.encryptString(password).toString("base64") }), { mode: 0o600 });
    await writeLog("Stored SMTP credential using operating-system encryption");
    return { stored: true, restartRequired: true };
  });
  ipcMain.handle("bandos:clear-email-credential", async () => {
    await rm(smtpCredentialPath(), { force: true });
    await writeLog("Cleared stored SMTP credential");
    return { cleared: true, restartRequired: true };
  });
  ipcMain.handle("bandos:restart", () => {
    app.relaunch();
    app.exit(0);
    return { restarting: true };
  });

  ipcMain.handle("bandos:restore-backup", async (_event, payload) => {
    const selection = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], filters: [{ name: "Band Office backups", extensions: ["bandos", "zip"] }] });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };
    try {
      const validated = await validateBackupArchive(selection.filePaths[0], typeof payload?.passphrase === "string" ? payload.passphrase : "");
      await writeFile(path.join(dataDirectory, PENDING_RESTORE_FILENAME), validated.databaseBytes, { mode: 0o600 });
      const pendingLibraryRoot = path.join(dataDirectory, PENDING_LIBRARY_RESTORE_DIRECTORY);
      await rm(pendingLibraryRoot, { recursive: true, force: true });
      await mkdir(pendingLibraryRoot, { recursive: true });
      for (const file of validated.libraryFiles) {
        const destination = path.resolve(pendingLibraryRoot, file.storageKey);
        if (path.relative(pendingLibraryRoot, destination).startsWith("..")) throw new Error("Restore contains an unsafe library file path.");
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, file.bytes, { mode: 0o600 });
      }
      const pendingFormRoot = path.join(dataDirectory, PENDING_FORM_RESTORE_DIRECTORY);
      await rm(pendingFormRoot, { recursive: true, force: true });
      await mkdir(pendingFormRoot, { recursive: true });
      for (const file of validated.formFiles) {
        const destination = path.resolve(pendingFormRoot, file.storageKey);
        if (path.relative(pendingFormRoot, destination).startsWith("..")) throw new Error("Restore contains an unsafe form file path.");
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, file.bytes, { mode: 0o600 });
      }
      const pendingEventRoot = path.join(dataDirectory, PENDING_EVENT_RESTORE_DIRECTORY);
      await rm(pendingEventRoot, { recursive: true, force: true });
      await mkdir(pendingEventRoot, { recursive: true });
      for (const file of validated.eventFiles) {
        const destination = path.resolve(pendingEventRoot, file.storageKey);
        if (path.relative(pendingEventRoot, destination).startsWith("..")) throw new Error("Restore contains an unsafe event file path.");
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, file.bytes, { mode: 0o600 });
      }
      await writeLog(`Validated restore archive for program ${validated.manifest.programId}; restart scheduled`);
      setTimeout(() => { app.relaunch(); app.exit(0); }, 500);
      return { scheduled: true };
    } catch (error) {
      await writeLog(`Restore rejected: ${error instanceof Error ? error.message : "Unknown validation error"}`);
      return { error: error instanceof Error ? error.message : "The backup could not be restored." };
    }
  });

  await createWindow(applicationOrigin);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (communicationWorkerTimer) clearInterval(communicationWorkerTimer);
  if (localServerProcess && localServerProcess.exitCode === null) localServerProcess.kill();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => {
  if (!mainWindow && !isQuitting && applicationOrigin) void createWindow(applicationOrigin);
});
app.whenReady().then(bootstrap).catch(async (error) => {
  await writeLog(`Startup failed: ${error instanceof Error ? error.stack : String(error)}`);
  dialog.showErrorBox("Band Office could not start", "The local database or application files could not be prepared. No records were changed without a recovery snapshot. See the desktop log for details.");
  app.quit();
});
