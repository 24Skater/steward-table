"use client";

import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Catalog } from "./catalog-card";
import { CreateCatalogDialog } from "./create-catalog-dialog";
import { EditCatalogDialog } from "./edit-catalog-dialog";

interface CatalogListProps {
  initialCatalogs: Catalog[];
  churchId: string;
}

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatWindow(catalog: Catalog): string {
  if (!catalog.opensAt && !catalog.closesAt) return "No schedule";
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  if (catalog.opensAt && catalog.closesAt)
    return `${fmt(catalog.opensAt)} – ${fmt(catalog.closesAt)}`;
  if (catalog.opensAt) return `Opens ${fmt(catalog.opensAt)}`;
  return `Closes ${fmt(catalog.closesAt!)}`;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  CLOSED: "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED: "bg-red-50 text-red-500 border-red-100",
};

interface CatalogRowProps {
  catalog: Catalog;
  onUpdated: (catalog: Catalog) => void;
  onDeleted: (id: string) => void;
}

function CatalogRow({ catalog, onUpdated, onDeleted }: CatalogRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete catalog "${catalog.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/catalogs/${catalog.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(catalog.id);
  }

  async function handleToggleStatus() {
    const newStatus = catalog.status === "OPEN" ? "CLOSED" : "OPEN";
    setToggling(true);
    try {
      const res = await fetch(`/api/catalogs/${catalog.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = (await res.json()) as { status: string };
        onUpdated({ ...catalog, status: updated.status, isActive: updated.status === "OPEN" });
      }
    } finally {
      setToggling(false);
    }
  }

  const statusColor = STATUS_COLORS[catalog.status] ?? STATUS_COLORS.DRAFT;
  const isArchived = catalog.status === "ARCHIVED";

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
        {/* Name */}
        <td className="py-3 pl-4 pr-3">
          <Link
            href={`/catalog/${catalog.id}` as never}
            className="text-sm font-medium text-slate-800 hover:underline underline-offset-2"
          >
            {catalog.name}
          </Link>
          {catalog.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{catalog.description}</p>
          )}
        </td>

        {/* Status */}
        <td className="py-3 px-3">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {catalog.status}
          </span>
        </td>

        {/* Window */}
        <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
          {formatWindow(catalog)}
        </td>

        {/* Items */}
        <td className="py-3 px-3 text-sm text-slate-700 text-center tabular-nums">
          {catalog._count.items}
        </td>

        {/* Orders */}
        <td className="py-3 px-3 text-sm text-slate-700 text-center tabular-nums">
          {catalog._count.orders ?? 0}
        </td>

        {/* Revenue */}
        <td className="py-3 px-3 text-sm text-slate-700 text-right tabular-nums whitespace-nowrap">
          {(catalog.revenue ?? 0) > 0 ? (
            formatRevenue(catalog.revenue!)
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="py-3 pl-3 pr-4">
          <div className="flex items-center justify-end gap-1">
            {!isArchived && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggling}
                className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-slate-100"
              >
                {toggling ? "…" : catalog.status === "OPEN" ? "Close" : "Open"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      <EditCatalogDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        catalog={catalog}
        onUpdated={(updated) => {
          onUpdated(updated);
          setEditOpen(false);
        }}
      />
    </>
  );
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
            Manage your sales, menus, and event catalogs.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          New Catalog
        </Button>
      </div>

      {catalogs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <p className="text-slate-500 text-sm">No catalogs yet.</p>
          <p className="text-slate-400 text-xs mt-1">Build your first sale to get started.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus size={15} className="mr-1.5" />
            New Catalog
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="py-2.5 pl-4 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Name
                </th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Window
                </th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
                  Items
                </th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
                  Orders
                </th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">
                  Revenue
                </th>
                <th className="py-2.5 pl-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {catalogs.map((catalog) => (
                <CatalogRow
                  key={catalog.id}
                  catalog={catalog}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                />
              ))}
            </tbody>
          </table>
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
