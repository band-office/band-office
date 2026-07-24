export function normalizeAssetCode(value: string) {
  return value.trim().replace(/^bandos:asset:/i, "").toLocaleUpperCase();
}
