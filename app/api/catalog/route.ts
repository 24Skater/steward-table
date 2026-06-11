import { NextResponse } from "next/server";

// Superseded by /api/catalogs — kept for route resolution
export async function GET() {
  return NextResponse.redirect(
    new URL("/api/catalogs", process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  );
}
