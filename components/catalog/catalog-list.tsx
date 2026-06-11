"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogCard } from "./catalog-card";
import type { Catalog } from "./catalog-card";
import { CreateCatalogDialog } from "./create-catalog-dialog";

interface CatalogListProps {
  initialCatalogs: Catalog[];
  churchId: string;
}

export function CatalogList({ initialCatalogs, churchId }: CatalogListProps) {
  const [catalogs, setCatalogs] = useState(initialCatalogs);
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreated(catalog: Catalog) {
    setCatalogs((prev) => [catalog, ...prev]);
    setCreateOpen(false);
  }

  function handleUpdated(catalog: Catalog) {
    setCatalogs((prev) => prev.map((c) => (c.id === catalog.id ? catalog : c)));
  }

  function handleDeleted(id: string) {
    setCatalogs((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catalogs</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Organize your menu items into catalogs for different occasions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          New Catalog
        </Button>
      </div>

      {catalogs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No catalogs yet</p>
          <p className="text-sm mt-1">Create your first catalog to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              catalog={catalog}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      <CreateCatalogDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        churchId={churchId}
        onCreated={handleCreated}
      />
    </div>
  );
}
