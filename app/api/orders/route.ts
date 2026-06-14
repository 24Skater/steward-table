import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ── Schema ────────────────────────────────────────────────────────────────────

const CreateOrderSchema = z.object({
  catalogId: z.string(),
  channel: z.enum(["PHONE", "IN_PERSON"]),
  fulfillment: z.enum(["PICKUP", "DELIVERY", "DINE_IN"]),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        itemName: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().int().min(0),
        modifierSnapshot: z
          .array(
            z.object({
              optionName: z.string(),
              priceDelta: z.number(),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
  notes: z.string().optional(),
  paymentMethod: z.enum(["CASH", "ZELLE", "PAY_ON_PICKUP"]),
});

type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function calcSubtotal(items: CreateOrderInput["items"]): number {
  return items.reduce((sum, item) => {
    const modifierDelta = item.modifierSnapshot.reduce((s, m) => s + m.priceDelta, 0);
    return sum + (item.unitPrice + modifierDelta) * item.quantity;
  }, 0);
}

// ── POST /api/orders ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // 2. Parse + validate body
  const raw: unknown = await req.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // 3. Resolve catalog → churchId (bypass tenancy for lookup)
  const catalog = (await (db.catalog.findUnique as PrismaBypass)({
    where: { id: body.catalogId },
    select: { id: true, churchId: true },
    _bypassTenancyCheck: true,
  })) as { id: string; churchId: string } | null;

  if (!catalog) {
    return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
  }

  const { churchId } = catalog;

  // 4. Active membership check
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Permission check
  const result = await can("order.create", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 6. Fetch church for currency
  const church = (await (db.church.findUnique as PrismaBypass)({
    where: { id: churchId },
    select: { currency: true },
    _bypassTenancyCheck: true,
  })) as { currency: string } | null;

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  // 7. Fetch receiptLanguageVersion from ChurchSettings (default 1)
  const settings = await db.churchSettings.findUnique({
    where: { churchId },
    select: { receiptLanguageVersion: true },
  });
  const receiptLanguageVersion = settings?.receiptLanguageVersion ?? 1;

  // 8. Find or create customer
  const phoneNormalized = body.customerPhone ? normalizePhone(body.customerPhone) : null;
  const emailNormalized = body.customerEmail ? normalizeEmail(body.customerEmail) : null;

  let customerId: string;

  if (emailNormalized) {
    // Try upsert on emailNormalized first
    const existing = await db.customer.findFirst({
      where: { churchId, emailNormalized },
      select: { id: true },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await db.customer.create({
        data: {
          churchId,
          name: body.customerName.trim(),
          email: body.customerEmail ?? null,
          emailNormalized,
          phone: body.customerPhone ?? null,
          phoneNormalized,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else if (phoneNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId, phoneNormalized },
      select: { id: true },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await db.customer.create({
        data: {
          churchId,
          name: body.customerName.trim(),
          phone: body.customerPhone ?? null,
          phoneNormalized,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else {
    // No contact info — create anonymous customer record
    const created = await db.customer.create({
      data: {
        churchId,
        name: body.customerName.trim(),
      },
      select: { id: true },
    });
    customerId = created.id;
  }

  // 9. Calculate subtotal
  const subtotal = calcSubtotal(body.items);

  // 10. Determine payment status
  const paymentStatus = body.paymentMethod === "PAY_ON_PICKUP" ? "PENDING" : "CAPTURED";

  // 11. Atomically get order number + create order
  const order = await db.$transaction(async (tx) => {
    // Get/increment OrderCounter atomically
    const counter = await tx.orderCounter.upsert({
      where: { churchId },
      create: { churchId, value: 1 },
      update: { value: { increment: 1 } },
      select: { value: true },
    });

    const newOrder = await tx.order.create({
      data: {
        churchId,
        catalogId: catalog.id,
        customerId,
        number: counter.value,
        channel: body.channel,
        fulfillment: body.fulfillment,
        status: "CONFIRMED",
        currency: church.currency,
        subtotal,
        tax: 0,
        tip: 0,
        total: subtotal,
        notes: body.notes ?? null,
        receiptLanguageVersion,
        items: {
          create: body.items.map((item) => {
            const modifierDelta = item.modifierSnapshot.reduce((s, m) => s + m.priceDelta, 0);
            const effectiveUnit = item.unitPrice + modifierDelta;
            const itemSubtotal = effectiveUnit * item.quantity;
            return {
              itemId: item.itemId,
              itemName: item.itemName,
              unitPrice: effectiveUnit,
              quantity: item.quantity,
              modifierSnapshot: item.modifierSnapshot,
              subtotal: itemSubtotal,
              tax: 0,
              total: itemSubtotal,
            };
          }),
        },
        payments: {
          create: {
            method: body.paymentMethod,
            status: paymentStatus,
            amount: subtotal,
            currency: church.currency,
          },
        },
        events: {
          create: {
            actorId: session.user.id,
            toStatus: "CONFIRMED",
          },
        },
      },
      select: { id: true, number: true },
    });

    return newOrder;
  });

  return NextResponse.json({ orderId: order.id, orderNumber: order.number }, { status: 201 });
}
