import { PrismaClient } from "@prisma/client";
import { createDefaultKitchen } from "../lib/kitchens/defaults";

/**
 * Idempotent backfill: ensure every church has a default kitchen and that all
 * existing catalogs are assigned to it. Safe to run more than once.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const churches = await prisma.church.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const church of churches) {
      let kitchen = await prisma.kitchen.findFirst({
        where: { churchId: church.id, isDefault: true },
        select: { id: true },
      });
      if (!kitchen) {
        kitchen = (await createDefaultKitchen(prisma, church.id)) as { id: string };
      }
      await prisma.catalog.updateMany({
        where: { churchId: church.id, kitchenId: null },
        data: { kitchenId: kitchen.id },
      });
    }
    console.log(`Backfilled kitchens for ${churches.length} church(es).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
