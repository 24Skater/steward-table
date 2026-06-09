import { NextResponse } from "next/server";

export async function GET() {
  // TODO: List orders (scoped to church, with filters)
  return NextResponse.json({ message: "TODO: implement orders GET" }, { status: 501 });
}

export async function POST() {
  // TODO: Create order
  return NextResponse.json({ message: "TODO: implement orders POST" }, { status: 501 });
}
