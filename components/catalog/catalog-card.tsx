"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditCatalogDialog } from "./edit-catalog-dialog";

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  translations?: unknown;
  isActive: boolean;
  status: string;
  _count: { items: number };
}

interface CatalogCardProps {
  catalog: Catalog;
  onUpdated: (catalog: Catalog) => void;
  onDeleted: (id: string) => void;
}

export function CatalogCard({ catalog, onUpdated, onDeleted }: CatalogCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete catalog "${catalog.name}"?`)) return;
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
        const updated = await res.json();
        onUpdated({
          ...catalog,
          status: updated.status as string,
          isActive: updated.status === "OPEN",
        });
      }
    } finally {
      setToggling(false);
    }
  }

  const isArchived = catalog.status === "ARCHIVED";

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 truncate">{catalog.name}</h3>
              {isArchived ? (
                <Badge variant="secondary" className="text-xs shrink-0">Archived</Badge>
              ) : !catalog.isActive ? (
                <Badge variant="secondary" className="text-xs shrink-0">Inactive</Badge>
              ) : null}
            </div>
            {catalog.description && (
              <p className="text-slate-500 text-sm line-clamp-2">{catalog.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-2 -mt-1">
                <MoreVertical size={16} />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil size={14} className="mr-2" />
                Edit
              </DropdownMenuItem>
              {!isArchived && (
                <DropdownMenuItem onClick={handleToggleStatus} disabled={toggling}>
                  {catalog.status === "OPEN" ? "Close catalog" : "Open catalog"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={handleDelete}
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-sm">
              {catalog._count.items} {catalog._count.items === 1 ? "item" : "items"}
            </span>
            <Link
              href={`/catalog/${catalog.id}` as never}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Manage items
              <ChevronRight size={14} />
            </Link>
          </div>
        </CardContent>
      </Card>

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
