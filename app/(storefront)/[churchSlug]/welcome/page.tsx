import { db } from "@/lib/db";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface WelcomePageProps {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WelcomePage({ params, searchParams }: WelcomePageProps) {
  const { churchSlug } = await params;
  const { orderId } = await searchParams;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { name: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for public storefront
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  const orderIdStr = typeof orderId === "string" ? orderId : null;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-emerald-50 p-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>

      <h1 className="mt-5 text-2xl font-bold text-slate-800">You&apos;re all set</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Your account is linked. You can now track your orders and reorder faster next time.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {orderIdStr && (
          <Link
            href={`/${churchSlug}/order/${orderIdStr}`}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            View my order
          </Link>
        )}
        <Link
          href={`/${churchSlug}/menu`}
          className="text-sm text-emerald-600 underline-offset-2 hover:underline"
        >
          Browse the menu
        </Link>
      </div>
    </div>
  );
}
