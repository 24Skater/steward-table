"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import {
  archiveKitchen,
  createKitchen,
  renameKitchen,
  setDefaultKitchen,
} from "@/app/(dashboard)/kitchens/actions";

export interface KitchenRow {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  catalogCount: number;
}

interface KitchenManagerProps {
  initialKitchens: KitchenRow[];
}

export function KitchenManager({ initialKitchens }: KitchenManagerProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <main className="p-6 space-y-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          run(async () => {
            await createKitchen(name);
            setNewName("");
          });
        }}
      >
        <input
          className="flex-1 rounded-md border px-3 py-2"
          placeholder="New kitchen name (e.g. Media Kitchen)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={isPending}
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          disabled={isPending}
        >
          Add kitchen
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y rounded-md border">
        {initialKitchens.map((kitchen) => (
          <li key={kitchen.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{kitchen.name}</span>
                {kitchen.isDefault && (
                  <span className="text-xs uppercase tracking-wide text-slate-500">Default</span>
                )}
              </div>
              <div className="text-sm text-slate-500">
                /kitchen/{kitchen.slug} · {kitchen.catalogCount} catalog
                {kitchen.catalogCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <Link className="text-blue-600 hover:underline" href={`/kitchens/${kitchen.id}` as Route}>
                Assign catalogs
              </Link>
              <button
                type="button"
                className="text-slate-600 hover:underline disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  const name = window.prompt("Rename kitchen", kitchen.name);
                  if (name && name.trim()) run(() => renameKitchen(kitchen.id, name.trim()));
                }}
              >
                Rename
              </button>
              {!kitchen.isDefault && (
                <button
                  type="button"
                  className="text-slate-600 hover:underline disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => run(() => setDefaultKitchen(kitchen.id))}
                >
                  Make default
                </button>
              )}
              {!kitchen.isDefault && (
                <button
                  type="button"
                  className="text-red-600 hover:underline disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm(`Archive "${kitchen.name}"? Its catalogs move to the default kitchen.`)) {
                      run(() => archiveKitchen(kitchen.id));
                    }
                  }}
                >
                  Archive
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
