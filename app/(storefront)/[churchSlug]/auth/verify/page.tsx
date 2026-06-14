import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  verifyMagicLinkToken,
  findOrCreateUserByPhone,
  linkCustomerToUser,
  createDatabaseSession,
} from "@/lib/auth/create-phone-session";

interface VerifyPageProps {
  searchParams: Promise<{
    token?: string;
    phone?: string;
    orderId?: string;
    next?: string;
  }>;
}

export default async function MagicLinkVerifyPage({ searchParams }: VerifyPageProps) {
  const { token, phone, orderId, next } = await searchParams;

  const fallback = next ?? "/";

  if (!token || !phone) {
    return <ErrorPage message="Invalid or expired link." backUrl={fallback} />;
  }

  const valid = await verifyMagicLinkToken(token, phone);
  if (!valid) {
    return <ErrorPage message="This link has expired or already been used." backUrl={fallback} />;
  }

  const userId = await findOrCreateUserByPhone(phone);

  // Link customer record if we have an orderId
  if (orderId) {
    const order = await (db.order.findFirst as PrismaBypass)({
      where: { id: orderId },
      select: { customerId: true, customer: { select: { userId: true } } },
      _bypassTenancyCheck: true,
    }) as { customerId: string; customer: { userId: string | null } } | null;

    if (order?.customerId && !order.customer.userId) {
      await linkCustomerToUser(order.customerId, userId);
    }
  }

  const sessionToken = await createDatabaseSession(userId);

  const isProduction = process.env.NODE_ENV === "production";
  const cookieName = isProduction
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProduction,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — fallback is a dynamic path not in Next.js's typed routes
  redirect(fallback);
}

function ErrorPage({ message, backUrl }: { message: string; backUrl: string }) {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <p className="text-slate-700">{message}</p>
      <a
        href={backUrl}
        className="mt-4 inline-block text-sm text-emerald-600 underline-offset-2 hover:underline"
      >
        Go back
      </a>
    </div>
  );
}
