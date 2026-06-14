"use client";

import { setKitchenCatalogs } from "@/app/(dashboard)/kitchens/actions";
import { useState, useTransition } from "react";

interface CatalogOption {
  id: string;
  name: string;
  assignedToThis: boolean;
  assignedElsewhere: boolean;
}

interface CatalogAssignmentProps {
  kitchenId: string;
  isDefault: boolean;
  catalogs: CatalogOption[];
}

export function CatalogAssignment({ kitchenId, isDefault, catalogs }: CatalogAssignmentProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(catalogs.filter((c) => c.assignedToThis).map((c) => c.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setKitchenCatalogs(kitchenId, Array.from(selected));
        setSaved(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <main className="p-6 space-y-4">
      <p className="text-sm text-slate-600">
        Select the catalogs whose orders should appear on this kitchen&apos;s screen.
        {isDefault &&
          " As the default kitchen, it also receives any catalog with no kitchen assigned."}
      </p>

      <ul className="divide-y rounded-md border">
        {catalogs.map((catalog) => (
          <li key={catalog.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              id={`cat-${catalog.id}`}
              checked={selected.has(catalog.id)}
              onChange={() => toggle(catalog.id)}
              disabled={isPending}
            />
            <label htmlFor={`cat-${catalog.id}`} className="flex-1">
              {catalog.name}
              {catalog.assignedElsewhere && !selected.has(catalog.id) && (
                <span className="ml-2 text-xs text-amber-600">
                  currently on another kitchen — selecting moves it here
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <button
        type="button"
        className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        disabled={isPending}
        onClick={save}
      >
        Save assignments
      </button>
    </main>
  );
}
