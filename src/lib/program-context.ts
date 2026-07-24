import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

export async function getProgramContext(db: DatabaseClient) {
  const program = await db.program.findFirst({ orderBy: { name: "asc" } });
  if (!program) throw new Error("BandOS has no configured program.");
  const operatingPeriod = await db.operatingPeriod.findFirst({
    where: { programId: program.id, status: "OPEN" },
    orderBy: { startsAt: "desc" },
  });
  if (!operatingPeriod) throw new Error("BandOS has no open operating period.");
  return { program, operatingPeriod };
}

export async function getProgram(db: DatabaseClient) {
  const program = await db.program.findFirst({ orderBy: { name: "asc" } });
  if (!program) throw new Error("BandOS has no configured program.");
  return program;
}
