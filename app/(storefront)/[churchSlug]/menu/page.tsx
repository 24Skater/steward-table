import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

interface MenuListPageProps {
  params: Promise<{ churchSlug: string }>;
}

export default async function MenuListPage({ params }: MenuListPageProps) {
  const { churchSlug } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, name: true },
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
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
        <p className="text-xl font-semibold text-slate-700">No menu available right now</p>
        <p className="mt-2 text-sm">Check back soon for upcoming menus.</p>
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
