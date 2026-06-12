import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

interface MenuListPageProps {
  params: Promise<{ churchSlug: string }>;
}

function formatCatalogDate(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function MenuListPage({ params }: MenuListPageProps) {
  const { churchSlug } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: {
      id: true, name: true,
      settings: { select: { replyToEmail: true } },
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for storefront
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  const catalogs: Array<{ id: string; name: string; description: string | null; slug: string }> =
    await db.catalog.findMany({
      where: { churchId: church.id, status: "OPEN" },
      select: { id: true, name: true, description: true, slug: true },
      orderBy: { name: "asc" },
    });

  if (catalogs.length === 0) {
    const upcomingCatalogs = await db.catalog.findMany({
      where: {
        churchId: church.id,
        status: "CLOSED",
        opensAt: { gt: new Date() },
      },
      select: { name: true, opensAt: true },
      orderBy: { opensAt: "asc" },
      take: 3,
    });

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-800">{church.name}</h1>
        <p className="mt-4 text-base text-slate-600">We&apos;re not running a sale right now.</p>
        <p className="mt-1 text-sm text-slate-400">Check back soon, or get in touch.</p>

        {upcomingCatalogs.length > 0 && (
          <div className="mt-8 space-y-2 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coming up</p>
            {upcomingCatalogs.map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-800">{c.name}</p>
                {c.opensAt && (
                  <p className="text-sm text-slate-500">{formatCatalogDate(c.opensAt)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {church.settings?.replyToEmail && (
          <a
            href={`mailto:${church.settings.replyToEmail}`}
            className="mt-6 text-sm text-emerald-600 underline-offset-2 hover:underline"
          >
            Contact us
          </a>
        )}
      </div>
    );
  }

  // Auto-navigate to the only catalog when there is exactly one
  const firstCatalog = catalogs[0];
  if (catalogs.length === 1 && firstCatalog) {
    redirect(`/${churchSlug}/menu/${firstCatalog.id}`);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Choose a menu</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {catalogs.map((catalog) => (
          <Link
            key={catalog.id}
            href={`/${churchSlug}/menu/${catalog.id}`}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-800 group-hover:text-emerald-700">
              {catalog.name}
            </h2>
            {catalog.description && (
              <p className="mt-1 text-sm text-slate-500">{catalog.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
