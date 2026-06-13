import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { effectQueue } from "@/lib/orders/effect-queue"
import { transition } from "@/lib/orders/transitions"

// Per STATE_MACHINE §8: customers can only self-cancel DRAFT or SUBMITTED orders
const CANCELABLE_STATUSES = ["DRAFT", "SUBMITTED"] as const
type CancelableStatus = (typeof CANCELABLE_STATUSES)[number]

function isCancelable(status: string): status is CancelableStatus {
  return (CANCELABLE_STATUSES as readonly string[]).includes(status)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params

  const order = await (db.order.findUnique as Function)({
    where: { id: orderId },
    select: {
      id: true,
      churchId: true,
      status: true,
      createdAt: true,
    },
    _bypassTenancyCheck: true,
  }) as { id: string; churchId: string; status: string; createdAt: Date } | null

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (!isCancelable(order.status)) {
    return NextResponse.json(
      { error: "Order cannot be canceled in its current state" },
      { status: 409 },
    )
  }

  // Look up the church's self-cancel window
  const settings = await (db.churchSettings.findUnique as Function)({
    where: { churchId: order.churchId },
    select: { customerSelfCancelWindowMinutes: true },
    _bypassTenancyCheck: true,
  }) as { customerSelfCancelWindowMinutes: number } | null

  const windowMinutes = settings?.customerSelfCancelWindowMinutes ?? 5
  const withinWindow =
    Date.now() - order.createdAt.getTime() < windowMinutes * 60 * 1000

  if (!withinWindow) {
    return NextResponse.json(
      { error: "The cancellation window has passed" },
      { status: 410 },
    )
  }

  await transition(orderId, "CANCELED", {
    reason: "Customer canceled within self-cancel window",
    queue: effectQueue,
  })

  return NextResponse.json({ success: true, message: "Order canceled" })
}
