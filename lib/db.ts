import { PrismaClient } from "@prisma/client";

const TENANTED_MODELS = new Set([
  "catalog",
  "item",
  "catalogItem",
  "modifierGroup",
  "modifierOption",
  "itemModifierGroup",
  "customer",
  "order",
  "deliveryZone",
  "inventoryItem",
  "auditLog",
  "webhookEvent",
  "emailLog",
  "smsLog",
  "notification",
  "membership",
  "invitation",
  "apiKey",
  "churchSettings",
]);

const SOFT_DELETE_MODELS = new Set([
  "user",
  "church",
  "churchSettings",
  "catalog",
  "item",
  "itemPhoto",
  "catalogItem",
  "modifierGroup",
  "modifierOption",
  "itemModifierGroup",
  "customer",
  "address",
  "inventoryItem",
  "apiKey",
  "deliveryZone",
]);

const READ_OPS = new Set(["findUnique", "findFirst", "findMany", "count", "aggregate", "groupBy"]);

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Soft-delete middleware: auto-filter deletedAt IS NULL on reads
  client.$use(async (params, next) => {
    const model = params.model?.toLowerCase();

    if (!model || !SOFT_DELETE_MODELS.has(model)) {
      return next(params);
    }

    if (READ_OPS.has(params.action)) {
      // Allow opt-out via withDeleted flag in args
      if (params.args?.where?.withDeleted) {
        const { withDeleted: _, ...rest } = params.args.where;
        params.args = { ...params.args, where: rest };
        return next(params);
      }

      params.args ??= {};
      params.args.where ??= {};

      if (!("deletedAt" in params.args.where)) {
        params.args.where.deletedAt = null;
      }
    }

    // Soft-delete: remap delete → update with deletedAt
    if (params.action === "delete") {
      params.action = "update";
      params.args.data = { deletedAt: new Date() };
    }

    if (params.action === "deleteMany") {
      params.action = "updateMany";
      params.args.data ??= {};
      params.args.data.deletedAt = new Date();
    }

    return next(params);
  });

  // churchId-scope enforcement middleware
  client.$use(async (params, next) => {
    const model = params.model?.toLowerCase();

    if (!model || !TENANTED_MODELS.has(model)) {
      return next(params);
    }

    // Skip enforcement for system-level operations that bypass tenancy
    if (params.args?._bypassTenancyCheck === true) {
      const { _bypassTenancyCheck: _, ...rest } = params.args;
      params.args = rest;
      return next(params);
    }

    const writeOps = new Set(["create", "createMany", "update", "updateMany", "upsert"]);

    if (READ_OPS.has(params.action)) {
      const hasChurchId =
        params.args?.where?.churchId !== undefined ||
        params.args?.where?.church !== undefined;

      if (!hasChurchId) {
        throw new Error(
          `[Tenancy] Unscoped read on ${params.model} — all reads on tenanted models must include churchId in the where clause. ` +
            `Pass { _bypassTenancyCheck: true } to opts if this is intentional (e.g., background jobs).`,
        );
      }
    }

    if (writeOps.has(params.action)) {
      const data = params.args?.data;
      const hasChurchId = data?.churchId !== undefined || data?.church !== undefined;

      if (params.action === "create" || params.action === "upsert") {
        if (!hasChurchId) {
          throw new Error(
            `[Tenancy] Missing churchId on create/upsert for ${params.model}. ` +
              `Every tenanted model must be created with an explicit churchId.`,
          );
        }
      }
    }

    return next(params);
  });

  return client;
}

// Standard Next.js singleton to prevent hot-reload from spawning multiple connections
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  global.__prisma ??
  (() => {
    const client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      global.__prisma = client;
    }
    return client;
  })();
