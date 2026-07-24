import { seedRidgeline } from "../prisma/seed";
import { createPrismaClient } from "../src/lib/db";

const prisma = createPrismaClient();

try {
  const programCount = await prisma.program.count();
  if (programCount === 0 && process.env.BANDOS_LOAD_DEMO === "true") {
    await seedRidgeline(prisma);
    console.log("Loaded Ridgeline demo data into the empty database.");
  }
} finally {
  await prisma.$disconnect();
}
