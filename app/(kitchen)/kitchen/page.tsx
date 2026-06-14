import { requireActiveMembership } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function KitchenPickerPage() {
  const { membership } = await requireActiveMembership();

  const kitchens = await db.kitchen.findMany({
    where: { churchId: membership.churchId },
    select: { id: true, name: true, slug: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-slate-950 p-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Select a kitchen</h1>
      {kitchens.length === 0 ? (
        <p className="text-slate-400">No kitchens configured yet. Ask an admin to set one up.</p>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kitchens.map((kitchen) => (
            <Link
              key={kitchen.id}
              href={`/kitchen/${kitchen.slug}`}
              className="block rounded-lg border border-slate-700 bg-slate-900 p-6 text-white hover:border-slate-500 transition-colors"
            >
              <span className="text-lg font-medium">{kitchen.name}</span>
              {kitchen.isDefault && (
                <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">Default</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
