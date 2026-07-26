import { cp, mkdir, readFile, readdir, readlink, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(".next", "standalone");
const destination = path.resolve("app-runtime", "server");

await rm(path.resolve("app-runtime"), { force: true, recursive: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, verbatimSymlinks: true });
await cp(path.resolve(".next", "static"), path.join(destination, ".next", "static"), { recursive: true });
await cp(path.resolve("public"), path.join(destination, "public"), { recursive: true });
await rename(path.join(destination, "node_modules"), path.join(destination, "runtime-modules"));

async function materializeRuntimeAliases(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const target = await readlink(entryPath);
      const runtimeTarget = target.replace(/(^|\/)node_modules\//, "$1runtime-modules/");
      if (runtimeTarget === target) throw new Error(`Unexpected standalone dependency link: ${entryPath} -> ${target}`);
      const sourcePath = path.resolve(directory, runtimeTarget);
      await rm(entryPath);
      await cp(sourcePath, entryPath, { dereference: true, recursive: true });
    } else if (entry.isDirectory()) {
      await materializeRuntimeAliases(entryPath);
    }
  }
}

try {
  await materializeRuntimeAliases(path.join(destination, ".next", "node_modules"));
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

const serverEntry = path.join(destination, "server.js");
const serverSource = await readFile(serverEntry, "utf8");
const configMarker = "process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)";
if (!serverSource.includes(configMarker)) throw new Error("Could not locate the Next.js standalone configuration marker.");
await writeFile(serverEntry, serverSource.replace(
  configMarker,
  `nextConfig.outputFileTracingRoot = dir\nnextConfig.turbopack = { ...nextConfig.turbopack, root: dir }\n\n${configMarker}`,
));

await Promise.all([
  rm(path.join(destination, ".env"), { force: true }),
  rm(path.join(destination, ".env.local"), { force: true }),
  rm(path.join(destination, "data"), { force: true, recursive: true }),
]);

console.log(`Prepared standalone desktop runtime at ${destination}`);
