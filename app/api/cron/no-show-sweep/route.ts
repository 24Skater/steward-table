import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // TODO: Find AWAITING_PICKUP orders past noShowTimeoutHours
  // TODO: Call transition() for AWAITING_PICKUP -> CANCELED
  return NextResponse.json({ message: "TODO: no-show sweep" }, { status: 501 });
}
