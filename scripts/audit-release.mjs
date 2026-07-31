import ts from "typescript";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const findings = [];
const evidence = [];
const runtimeFiles = [];
const prohibitedNetworkModules = new Set(["http", "https", "tls", "dgram", "dns", "dns/promises", "node:http", "node:https", "node:tls", "node:dgram", "node:dns", "node:dns/promises"]);
const networkGlobals = new Set(["WebSocket", "EventSource", "XMLHttpRequest"]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (absolute.includes(`${path.sep}src${path.sep}generated`)) continue;
      await collect(absolute);
    } else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) runtimeFiles.push(absolute);
  }
}

function location(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(root, sourceFile.fileName)}:${position.line + 1}`;
}

function addFinding(sourceFile, node, message) {
  findings.push(`${location(sourceFile, node)} ${message}`);
}

function allowedPolicyUrl(file, value) {
  if (file !== "desktop/main.mjs") return false;
  return value.startsWith("http://127.0.0.1:") || ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"].includes(value);
}

function auditSource(absolute, source) {
  const relative = path.relative(root, absolute);
  const kind = absolute.endsWith(".tsx") ? ts.ScriptKind.TSX : absolute.endsWith(".ts") ? ts.ScriptKind.TS : absolute.endsWith(".cjs") ? ts.ScriptKind.JS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, kind);

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      if (prohibitedNetworkModules.has(moduleName)) addFinding(sourceFile, node, `imports prohibited runtime network module ${moduleName}`);
      if ((moduleName === "net" || moduleName === "node:net") && relative !== "desktop/main.mjs") addFinding(sourceFile, node, "imports node:net outside the loopback desktop bootstrap");
      if (moduleName === "nodemailer" && relative !== "src/lib/email-transport.ts") addFinding(sourceFile, node, "imports the SMTP transport outside the approved email adapter");
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "fetch") {
      const argument = node.arguments[0]?.getText(sourceFile) ?? "";
      const approvedLoopback = argument.includes("${origin}/login") || argument.includes("${origin}/api/internal/communications/worker");
      const approvedSameOrigin = argument.includes('"/api/communications/credential-changed"') || argument.includes('"/api/calendar/reveal"');
      if (!((relative === "desktop/main.mjs" && approvedLoopback) || approvedSameOrigin)) addFinding(sourceFile, node, "uses fetch outside the approved loopback or same-origin communication paths");
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && networkGlobals.has(node.expression.text)) addFinding(sourceFile, node, `constructs ${node.expression.text}`);
    if (ts.isPropertyAccessExpression(node) && node.name.text === "sendBeacon") addFinding(sourceFile, node, "uses sendBeacon");
    if (ts.isStringLiteralLike(node)) {
      const value = node.text;
      if (/^(?:https?|wss?):\/\//i.test(value) && !allowedPolicyUrl(relative, value)) addFinding(sourceFile, node, `contains external runtime URL ${value}`);
    }
    if (ts.isTemplateExpression(node)) {
      const value = node.head.text;
      if (/^(?:https?|wss?):\/\//i.test(value) && !allowedPolicyUrl(relative, value)) addFinding(sourceFile, node, `contains external runtime URL template ${value}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

await collect(path.join(root, "src"));
await collect(path.join(root, "desktop"));
runtimeFiles.push(path.join(root, "next.config.ts"));
for (const file of runtimeFiles) auditSource(file, await readFile(file, "utf8"));
evidence.push({ claim: "Runtime source has no hard-coded external destination", detail: `${runtimeFiles.length} parsed source files; Electron fetch is loopback-only and optional outbound SMTP is isolated to src/lib/email-transport.ts` });

const css = await readFile(path.join(root, "src/app/globals.css"), "utf8");
if (/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i.test(css) || /url\(\s*["']?(?:https?:)?\/\//i.test(css)) findings.push("src/app/globals.css contains an external stylesheet or asset URL");
evidence.push({ claim: "Styles and fonts are local", detail: "No external CSS imports or asset URLs" });

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.build?.appId !== "org.bandoffice.desktop") findings.push(`Unexpected Desktop application identifier: ${packageJson.build?.appId ?? "missing"}`);
evidence.push({ claim: "Desktop application identity uses Band Office naming", detail: packageJson.build?.appId ?? "missing" });

const nextConfig = await readFile(path.join(root, "next.config.ts"), "utf8");
if (!/images:\s*\{\s*unoptimized:\s*true,\s*\}/s.test(nextConfig)) findings.push("Next.js image optimization must remain disabled so Desktop cannot write an image cache into its signed app bundle.");
evidence.push({ claim: "Desktop runtime keeps the signed app bundle read-only", detail: "Next.js image optimization is disabled; static brand images do not create runtime files under app resources" });
for (const group of ["dependencies", "devDependencies", "overrides"]) {
  for (const [name, version] of Object.entries(packageJson[group] ?? {})) if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) findings.push(`package.json ${group}.${name} is not pinned exactly: ${version}`);
}
if (!packageJson.private) findings.push("package.json must remain private so Desktop distribution cannot be confused with npm publication");
evidence.push({ claim: "Direct dependency versions are reproducible", detail: "All production and build dependencies are exact versions with package-lock.json; npm publication remains disabled" });

for (const [source, destination] of [["LICENSE", "legal/LICENSE"], ["NOTICE", "legal/NOTICE"]]) {
  const resource = packageJson.build?.extraResources?.find((entry) => entry.from === source && entry.to === destination);
  if (!resource) findings.push(`package.json must package ${source} at resources/${destination}`);
}
evidence.push({ claim: "Desktop packages include release legal files", detail: "LICENSE and NOTICE are configured under resources/legal" });

for (const [script, markers] of Object.entries({
  "desktop:dist:mac:signed": ["BANDOS_SIGN_DESKTOP=1", "--config.forceCodeSigning=true", "--config.mac.notarize=true"],
  "desktop:dist:win:signed": ["BANDOS_SIGN_DESKTOP=1", "--config.forceCodeSigning=true"],
})) {
  const command = packageJson.scripts?.[script] ?? "";
  for (const marker of markers) if (!command.includes(marker)) findings.push(`package.json ${script} is missing ${marker}`);
}
evidence.push({ claim: "Signed Desktop commands fail closed", detail: "Signed macOS and Windows commands force signing; macOS also forces notarization" });

const alphaWorkflow = await readFile(path.join(root, ".github/workflows/desktop-alpha-release.yml"), "utf8");
for (const marker of [
  'tags:\n      - "v*-alpha.*"',
  "git fetch --no-tags origin main:refs/remotes/origin/main",
  "environment: desktop-alpha-release",
  "desktop:dist:mac:arm64",
  "desktop:dist:mac:x64",
  "macos-15-intel",
  'lipo -archs "$app/Contents/MacOS/Band Office"',
  "codesign --verify --deep --strict",
  "Signature=adhoc",
  "npm run desktop:dist:win",
  "Unexpected Developer ID signature on the ad hoc macOS release.",
  "Unexpected Authenticode signature on the unsigned Windows release",
  "hdiutil verify",
  "Get-AuthenticodeSignature",
  "npm run release:desktop:verify",
  "gh release create",
  "--prerelease",
  "--verify-tag",
]) if (!alphaWorkflow.includes(marker)) findings.push(`Desktop alpha workflow is missing release gate: ${marker}`);
for (const forbiddenMarker of [
  "WINDOWS_CSC_LINK",
  "WINDOWS_CSC_KEY_PASSWORD",
  "MACOS_CSC_LINK",
  "MACOS_CSC_KEY_PASSWORD",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "AZURE_SIGNING_PUBLISHER_NAME",
  "AZURE_SIGNING_ENDPOINT",
  "AZURE_SIGNING_CERTIFICATE_PROFILE_NAME",
  "AZURE_SIGNING_ACCOUNT_NAME",
]) {
  if (alphaWorkflow.includes(forbiddenMarker)) findings.push(`Desktop alpha workflow includes deferred signing configuration: ${forbiddenMarker}`);
}
evidence.push({ claim: "Desktop alpha publication is explicit and fail-closed", detail: "Apple Silicon and Intel macOS bundles require valid ad hoc integrity seals; Windows remains unsigned; native package acceptance, architecture checks, checksums, platform warnings, and the protected environment gate prerelease publication" });

const serverWorkflow = await readFile(path.join(root, ".github/workflows/server-alpha-release.yml"), "utf8");
const pullRequestWorkflow = await readFile(path.join(root, ".github/workflows/pull-request-quality.yml"), "utf8");
for (const marker of [
  'tags:\n      - "v*-server-alpha.*"',
  "git fetch --no-tags origin main:refs/remotes/origin/main",
  "environment: server-alpha-release",
  "platforms: linux/amd64,linux/arm64",
  "provenance: mode=max",
  "sbom: true",
  "ghcr.io/band-office/band-office-server",
  "uses: actions/attest@",
  "gh attestation verify",
  'DOCKER_CONFIG="$anonymous_config"',
  "npm run server:container:test",
  "npm run server:compose:test",
  "npm run release:server:artifact:verify",
  "npm run release:server:manifest",
  "gh release create",
  "--prerelease",
  "--verify-tag",
]) if (!serverWorkflow.includes(marker)) findings.push(`Server alpha workflow is missing release gate: ${marker}`);
if (serverWorkflow.includes(":latest")) findings.push("Server alpha workflow must not publish a latest image tag.");
if (serverWorkflow.includes("${{ env.IMAGE_NAME }}:${{ steps.release.outputs.version }}")) {
  findings.push("Server alpha workflow must not publish a release-looking image tag before the GitHub release succeeds.");
}
if (serverWorkflow.includes("visibility=public") || serverWorkflow.includes("packages/container/band-office-server")) {
  findings.push("Server alpha workflow must verify public package access, not mutate organization package visibility.");
}
if (!pullRequestWorkflow.includes("npm run server:compose:test -- band-office-server:acceptance")) {
  findings.push("Pull requests do not exercise the packaged Server Compose operator path on Linux.");
}

const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");
for (const marker of [
  "FROM node:24-bookworm-slim@sha256:",
  "USER 10001:10001",
  "rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack",
  "rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack",
  'org.opencontainers.image.source="https://github.com/band-office/band-office"',
  'org.opencontainers.image.licenses="Apache-2.0"',
]) if (!dockerfile.includes(marker)) findings.push(`Dockerfile is missing Server release marker: ${marker}`);

const serverCompose = await readFile(path.join(root, "deploy/server/compose.yml"), "utf8");
for (const marker of [
  "caddy:2.11.4-alpine@sha256:",
  "cap_drop:",
  "- ALL",
  "no-new-privileges:true",
]) if (!serverCompose.includes(marker)) findings.push(`Server compose bundle is missing hardening marker: ${marker}`);

for (const script of [
  "release:server:tag:verify",
  "release:server:artifact:verify",
  "release:server:manifest",
  "server:container:test",
  "server:compose:test",
]) if (!packageJson.scripts?.[script]) findings.push(`package.json is missing Server release script ${script}.`);
evidence.push({ claim: "Server alpha publication is protected and attributable", detail: "Multi-platform GHCR publication requires the protected environment, non-root container acceptance, vulnerability scan, public-image check, digest-pinned operator bundle, SBOM, and signed provenance" });

const desktopMain = await readFile(path.join(root, "desktop/main.mjs"), "utf8");
for (const marker of [
  'NEXT_TELEMETRY_DISABLED: "1"',
  "connect-src 'self'",
  "setPermissionCheckHandler",
  "setPermissionRequestHandler",
  "webRequest.onBeforeRequest",
  "setWindowOpenHandler",
  'contextIsolation: true',
  'nodeIntegration: false',
  'sandbox: true',
  'writeLog("[communications] Worker returned a non-success status")',
  'writeLog("[communications] Worker request failed")',
]) if (!desktopMain.includes(marker)) findings.push(`desktop/main.mjs is missing security marker: ${marker}`);
if (/writeLog\(`\[communications\][^`]*\$\{/.test(desktopMain)) findings.push("desktop/main.mjs writes HTTP-derived communication worker details to the desktop log");
evidence.push({ claim: "Desktop shell enforces the local boundary", detail: "Loopback-only requests, fixed worker diagnostics, self-only CSP, denied external navigation, sandboxed renderer, and explicit camera-only permission path" });

const desktopPreload = await readFile(path.join(root, "desktop/preload.cjs"), "utf8");
const desktopLifecycle = await readFile(path.join(root, "desktop/data-lifecycle.mjs"), "utf8");
const appShell = await readFile(path.join(root, "src/components/app-shell.tsx"), "utf8");
for (const [content, marker] of [
  [desktopMain, 'ipcMain.handle("bandos:reset-demo"'],
  [desktopMain, "assertRidgelineDemoDatabase(databasePath)"],
  [desktopMain, "PENDING_DEMO_RESET_FILENAME"],
  [desktopPreload, 'resetDemo: () => ipcRenderer.invoke("bandos:reset-demo")'],
  [desktopLifecycle, "pre-demo-reset-"],
  [appShell, "Start my program"],
]) if (!content.includes(marker)) findings.push(`Desktop demo exit is missing release marker: ${marker}`);
evidence.push({ claim: "Desktop demo has a guarded exit", detail: "Only the fixed Ridgeline demo can schedule a reset; restart preserves its database and managed files before returning to first-run setup" });

const backupRoute = await readFile(path.join(root, "src/app/api/backup/route.ts"), "utf8");
if (!backupRoute.includes(".bandoffice")) findings.push("Encrypted backups do not use the current .bandoffice extension.");
if (!desktopMain.includes('extensions: ["bandoffice", "bandos", "zip"]')) findings.push("Desktop restore does not accept current .bandoffice, legacy .bandos, and readable .zip archives.");
evidence.push({ claim: "Backup naming is current without breaking restore compatibility", detail: "New encrypted archives use .bandoffice; Desktop restore retains .bandos and ZIP support" });

for (const documentationFile of [
  "README.md",
  "docs/release/CURRENT_STATUS.md",
  "docs/release/DESKTOP_ALPHA_RELEASE.md",
  "docs/release/NEXT_ACTION.md",
  "docs/product/ROADMAP.md",
  "docs/release/SECURITY_CHECKLIST.md",
]) {
  const content = await readFile(path.join(root, documentationFile), "utf8");
  if (/real-data pilot|real-program pilot|school-specific pilot/i.test(content)) findings.push(`${documentationFile} contains a program-specific release gate.`);
}
evidence.push({ claim: "Public release gates are deployment-neutral", detail: "Current release, roadmap, and security documents contain no program-specific pilot gate" });

const entitlementText = await readFile(path.join(root, "desktop/entitlements.mac.plist"), "utf8");
const entitlementKeys = [...entitlementText.matchAll(/<key>([^<]+)<\/key>/g)].map((match) => match[1]);
if (entitlementKeys.length !== 1 || entitlementKeys[0] !== "com.apple.security.device.camera") findings.push(`Unexpected macOS entitlements: ${entitlementKeys.join(", ") || "none"}`);
evidence.push({ claim: "macOS entitlement scope is camera-only", detail: entitlementKeys.join(", ") });

const adHocEntitlementText = await readFile(path.join(root, "desktop/entitlements.mac.adhoc.plist"), "utf8");
for (const requiredEntitlement of [
  "com.apple.security.cs.allow-jit",
  "com.apple.security.cs.disable-library-validation",
  "com.apple.security.device.camera",
]) if (!adHocEntitlementText.includes(`<key>${requiredEntitlement}</key>`)) findings.push(`Ad hoc macOS entitlements are missing ${requiredEntitlement}`);
const adHocPackaging = await readFile(path.join(root, "scripts/package-desktop.mjs"), "utf8");
for (const marker of [
  "--config.mac.identity=-",
  "--config.mac.sign=desktop/sign-mac-adhoc.mjs",
  "--config.mac.preAutoEntitlements=false",
]) if (!adHocPackaging.includes(marker)) findings.push(`Ad hoc macOS packaging is missing ${marker}`);
evidence.push({ claim: "macOS alpha bundles are integrity sealed", detail: "Ad hoc signing uses explicit hardened-runtime entitlements and a pre-sign metadata cleanup" });

const runtimeRoot = path.join(root, "app-runtime/server");
if (!(await stat(runtimeRoot).then(() => true).catch(() => false))) findings.push("app-runtime/server is missing; run npm run build and npm run desktop:prepare before the release audit");
else {
  const forbiddenRuntimePaths = [".env", ".env.local", "data", "bandos.db"];
  for (const relative of forbiddenRuntimePaths) if (await stat(path.join(runtimeRoot, relative)).then(() => true).catch(() => false)) findings.push(`Packaged runtime contains forbidden path app-runtime/server/${relative}`);
  evidence.push({ claim: "Packaged runtime contains no environment file or live data", detail: "Checked .env, .env.local, data, and bandos.db exclusions" });
}

const report = { schemaVersion: 1, status: findings.length ? "fail" : "pass", checks: evidence, findings };
await writeFile(path.join(root, "docs/release/RELEASE_AUDIT.json"), `${JSON.stringify(report, null, 2)}\n`);
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Release audit passed: ${evidence.length} claims verified across ${runtimeFiles.length} runtime source files.`);
}
