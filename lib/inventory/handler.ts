import { db } from "@/lib/db";
import type { SideEffect } from "@/lib/orders/transitions";

/**
 * Handle inventory-related side effects from order state transitions.
 * All failures are best-effort — errors are caught and logged, never thrown.
 */
export async function handleInventoryEffect(effect: SideEffect): Promise<void> {
  try {
    switch (effect.kind) {
      case "inventory.reserve":
        await handleReserve(effect.orderId);
        break;
      case "inventory.restock":
        await handleRestock(effect.orderId);
        break;
      case "inventory.confirm":
        // No-op — reservation was done at submit time
        break;
      default:
        // Not an inventory effect
        break;
    }
  } catch (err) {
    // Side effects are best-effort — never block order flow
    console.error("[inventory] handleInventoryEffect failed", {
      kind: effect.kind,
      orderId: effect.orderId,
      err,
    });
  }
}

async function handleReserve(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      churchId: true,
      items: {
        select: {
          itemId: true,
          itemName: true,
          quantity: true,
        },
      },
    },
  });

  if (!order) return;

  for (const orderItem of order.items) {
    if (!orderItem.itemId) continue;

    const inventoryItem = await db.inventoryItem.findUnique({
      where: { itemId: orderItem.itemId },
    });

    if (!inventoryItem || !inventoryItem.trackingEnabled) continue;

    const newQty = Math.max(0, inventoryItem.quantityOnHand - orderItem.quantity);

    await db.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantityOnHand: newQty },
    });

    await db.stockMovement.create({
      data: {
        inventoryItemId: inventoryItem.id,
        kind: "ORDER_DECREMENT",
        delta: -orderItem.quantity,
        orderId,
        reason: "Order submitted",
      },
    });

    // Emit low stock notification if quantity crossed the threshold
    const threshold = inventoryItem.lowStockThreshold;
    if (threshold !== null && newQty <= threshold) {
      await db.notification.create({
        data: {
          churchId: order.churchId,
          type: "low_stock",
          body: `"${orderItem.itemName}" stock is running low (${newQty} remaining)`,
          link: "/inventory",
        },
      });
    }
  }
}

async function handleRestock(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      churchId: true,
      items: {
        select: {
          itemId: true,
          quantity: true,
        },
      },
    },
  });

  if (!order) return;

  for (const orderItem of order.items) {
    if (!orderItem.itemId) continue;

    const inventoryItem = await db.inventoryItem.findUnique({
      where: { itemId: orderItem.itemId },
    });

    if (!inventoryItem || !inventoryItem.trackingEnabled) continue;

    const newQty = inventoryItem.quantityOnHand + orderItem.quantity;

    await db.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantityOnHand: newQty },
    });

    await db.stockMovement.create({
      data: {
        inventoryItemId: inventoryItem.id,
        kind: "REFUND_INCREMENT",
        delta: orderItem.quantity,
        orderId,
        reason: "Order canceled",
      },
    });
  }
}
