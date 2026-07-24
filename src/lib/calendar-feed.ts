import { EventStatus, EventVisibility } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

function icsText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\r\n", "\\n").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function icsDate(value: Date) {
  return value.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function fold(line: string) {
  if (line.length <= 73) return line;
  const pieces: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    pieces.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  pieces.push(rest);
  return pieces.join("\r\n");
}

export async function buildCalendarFeed(db: DatabaseClient, programId: string, visibility: "public" | "private") {
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) return null;
  const events = await db.event.findMany({
    where: {
      programId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.COMPLETED] },
      ...(visibility === "public" ? { visibility: EventVisibility.PUBLIC } : {}),
    },
    orderBy: { startsAt: "asc" },
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BandOS//Program Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(program.name)}`,
  ];
  for (const event of events) {
    const description = visibility === "private"
      ? [event.description, event.itinerary ? `Itinerary:\n${event.itinerary}` : null].filter(Boolean).join("\n\n")
      : event.description ?? "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@bandos.local`,
      `DTSTAMP:${icsDate(event.updatedAt)}`,
      `DTSTART:${icsDate(event.startsAt)}`,
      ...(event.endsAt ? [`DTEND:${icsDate(event.endsAt)}`] : []),
      `SUMMARY:${icsText(event.name)}`,
      ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
      ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function escapeCalendarHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
