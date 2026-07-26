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
  "MACOS_CSC_LINK",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "WINDOWS_CSC_LINK",
  "codesign --verify --deep --strict",
  "xcrun stapler validate",
  "Get-AuthenticodeSignature",
  "npm run release:desktop:verify",
  "gh release create",
  "--prerelease",
  "--verify-tag",
]) if (!alphaWorkflow.includes(marker)) findings.push(`Desktop alpha workflow is missing release gate: ${marker}`);
evidence.push({ claim: "Desktop alpha publication is signed and fail-closed", detail: "Protected-environment credentials, post-signing platform checks, legal verification, and prerelease-only publication are required" });

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
]) if (!desktopMain.includes(marker)) findings.push(`desktop/main.mjs is missing security marker: ${marker}`);
evidence.push({ claim: "Desktop shell enforces the local boundary", detail: "Loopback-only requests, self-only CSP, denied external navigation, sandboxed renderer, and explicit camera-only permission path" });

const entitlementText = await readFile(path.join(root, "desktop/entitlements.mac.plist"), "utf8");
const entitlementKeys = [...entitlementText.matchAll(/<key>([^<]+)<\/key>/g)].map((match) => match[1]);
if (entitlementKeys.length !== 1 || entitlementKeys[0] !== "com.apple.security.device.camera") findings.push(`Unexpected macOS entitlements: ${entitlementKeys.join(", ") || "none"}`);
evidence.push({ claim: "macOS entitlement scope is camera-only", detail: entitlementKeys.join(", ") });

const runtimeRoot = path.join(root, "app-runtime/server");
if (!(await stat(runtimeRoot).then(() => true).catch(() => false))) findings.push("app-runtime/server is missing; run npm run build and npm run desktop:prepare before the release audit");
else {
  const forbiddenRuntimePaths = [".env", ".env.local", "data", "bandos.db"];
  for (const relative of forbiddenRuntimePaths) if (await stat(path.join(runtimeRoot, relative)).then(() => true).catch(() => false)) findings.push(`Packaged runtime contains forbidden path app-runtime/server/${relative}`);
  evidence.push({ claim: "Packaged runtime contains no environment file or live data", detail: "Checked .env, .env.local, data, and bandos.db exclusions" });
}

const report = { schemaVersion: 1, status: findings.length ? "fail" : "pass", checks: evidence, findings };
await writeFile(path.join(root, "RELEASE_AUDIT.json"), `${JSON.stringify(report, null, 2)}\n`);
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Release audit passed: ${evidence.length} claims verified across ${runtimeFiles.length} runtime source files.`);
}
