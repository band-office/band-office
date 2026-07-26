export function runtimeAliasSegments(target) {
  const normalized = target.replaceAll("\\", "/");
  const marker = "/node_modules/";
  const markerIndex = normalized.indexOf(marker);
  const suffix = markerIndex >= 0
    ? normalized.slice(markerIndex + marker.length)
    : normalized.startsWith("node_modules/")
      ? normalized.slice("node_modules/".length)
      : "";
  const segments = suffix.split("/");
  if (!suffix || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Unexpected standalone dependency link target: ${target}`);
  }
  return segments;
}
