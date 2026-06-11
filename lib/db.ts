import { PrismaClient, Prisma } from "@prisma/client";

const TENANTED_MODELS = new Set([
  "catalog",
  "item",
  "catalogitem",
  "modifiergroup",
  "modifieroption",
  "itemmodifiergroup",
  "customer",
  "order",
  "deliveryzone",
  "inventoryitem",
  "auditlog",
  "webhookevent",
  "emaillog",
  "smslog",
  "notification",
  "membership",
  "invitation",
  "apikey",
  "churchsettings",
]);

const SOFT_DELETE_MODELS = new Set([
  "user",
  "church",
  "churchsettings",
  "catalog",
  "item",
  "itemphoto",
  "catalogitem",
  "modifiergroup",
  "modifieroption",
  "itemmodifiergroup",
  "customer",
  "address",
  "inventoryitem",
  "apikey",
  "deliveryzone",
]);

const READ_OPS = new Set(["findUnique", "findFirst", "findMany", "count", "aggregate", "groupBy"]);
const WRITE_OPS = new Set(["create", "createMany", "update", "updateMany", "upsert"]);

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelLower = model?.toLowerCase() ?? "";

          // ── Tenancy bypass ───────────────────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyArgs = args as any;
          let bypassTenancy = false;

          if (anyArgs?._bypassTenancyCheck === true) {
            bypassTenancy = true;
            delete anyArgs._bypassTenancyCheck;
          }

          // ── Soft-delete filter ───────────────────────────────────────
          if (SOFT_DELETE_MODELS.has(modelLower) && READ_OPS.has(operation)) {
            if (anyArgs?.where?.withDeleted) {
              delete anyArgs.where.withDeleted;
            } else {
              anyArgs.where ??= {};
              if (!("deletedAt" in anyArgs.where)) {
                anyArgs.where.deletedAt = null;
              }
            }
          }

          // ── Tenancy enforcement ──────────────────────────────────────
          if (!bypassTenancy && TENANTED_MODELS.has(modelLower)) {
            if (READ_OPS.has(operation)) {
              const hasChurchId =
                anyArgs?.where?.churchId !== undefined ||
                anyArgs?.where?.church !== undefined;
              if (!hasChurchId) {
                throw new Error(
                  `[Tenancy] Unscoped read on ${model} — add churchId to where, ` +
                    `or pass _bypassTenancyCheck: true for system-level ops.`,
                );
              }
            }

            if (WRITE_OPS.has(operation)) {
              const data = anyArgs?.data;
              if (
                (operation === "create" || operation === "upsert") &&
                data?.churchId === undefined &&
                data?.church === undefined
              ) {
                throw new Error(
                  `[Tenancy] Missing churchId on ${operation} for ${model}. ` +
                    `Every tenanted model must be created with an explicit churchId.`,
                );
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Standard Next.js singleton to prevent hot-reload connection leaks
const globalForPrisma = globalThis as unknown as { __prisma: ExtendedPrismaClient | undefined };

export const db: ExtendedPrismaClient =
  globalForPrisma.__prisma ??
  (() => {
    const client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.__prisma = client;
    }
    return client;
  })();
