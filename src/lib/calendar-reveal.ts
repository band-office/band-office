export const CALENDAR_REVEAL_COOKIE = "bandos_calendar_reveal";

export function encodeCalendarReveal(value: { token: string; name: string }) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCalendarReveal(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { token?: unknown; name?: unknown };
    if (typeof parsed.token !== "string" || parsed.token.length < 40 || typeof parsed.name !== "string") return null;
    return { token: parsed.token, name: parsed.name.slice(0, 120) };
  } catch {
    return null;
  }
}
