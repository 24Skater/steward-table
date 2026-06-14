import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { can } from "@/lib/rbac/can";
import { getPresignedUploadUrl } from "@/lib/storage";
import { nanoid } from "nanoid";
import { type NextRequest, NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const PRESIGN_EXPIRES = 300; // 5 minutes

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rbac = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = req.nextUrl.searchParams.get("contentType");
  if (!contentType) {
    return NextResponse.json(
      { error: "Missing required query param: contentType" },
      { status: 400 },
    );
  }

  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    return NextResponse.json(
      {
        error: `Unsupported content type. Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const key = `uploads/${userId}/${nanoid(10)}.${ext}`;

  const uploadUrl = await getPresignedUploadUrl(key, contentType, PRESIGN_EXPIRES);

  if (!uploadUrl) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const endpoint = process.env.R2_ENDPOINT ?? "";
  const bucket = process.env.R2_BUCKET_NAME ?? "";
  const publicUrl = `${endpoint}/${bucket}/${key}`;

  return NextResponse.json({ uploadUrl, key, publicUrl });
}
