"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CatalogTranslations {
  es?: { name?: string; description?: string };
}

interface Catalog {
  id: string;
  name: string;
  description: string | null;
  translations?: unknown;
  isActive: boolean;
  status: string;
  opensAt?: Date | string | null;
  closesAt?: Date | string | null;
  _count: { items: number };
}

interface EditCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Catalog;
  onUpdated: (catalog: Catalog) => void;
}

type LangTab = "EN" | "ES";

function toDatetimeLocal(val: Date | string | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditCatalogDialog({
  open,
  onOpenChange,
  catalog,
  onUpdated,
}: EditCatalogDialogProps) {
  const existingEs = (catalog.translations as CatalogTranslations | null)?.es ?? {};

  const [langTab, setLangTab] = useState<LangTab>("EN");
  const [name, setName] = useState(catalog.name);
  const [description, setDescription] = useState(catalog.description ?? "");
  const [nameEs, setNameEs] = useState(existingEs.name ?? "");
  const [descriptionEs, setDescriptionEs] = useState(existingEs.description ?? "");
  const [opensAt, setOpensAt] = useState(toDatetimeLocal(catalog.opensAt));
  const [closesAt, setClosesAt] = useState(toDatetimeLocal(catalog.closesAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMissingEs = !nameEs.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const translations: CatalogTranslations = {};
    if (nameEs.trim() || descriptionEs.trim()) {
      translations.es = {
        ...(nameEs.trim() && { name: nameEs.trim() }),
        ...(descriptionEs.trim() && { description: descriptionEs.trim() }),
      };
    }

    try {
      const res = await fetch(`/api/catalogs/${catalog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          translations: Object.keys(translations).length > 0 ? translations : null,
          opensAt: opensAt ? new Date(opensAt).toISOString() : null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update catalog");
      }

      const updated = await res.json() as {
        id: string;
        name: string;
        description: string | null;
        translations: unknown;
        status: string;
        opensAt: string | null;
        closesAt: string | null;
      };

      onUpdated({
        ...updated,
        _count: catalog._count,
        isActive: updated.status === "OPEN",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Catalog</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Language tabs */}
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            {(["EN", "ES"] as LangTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLangTab(tab)}
                className={cn(
                  "flex-1 py-1.5 font-medium transition-colors relative",
                  langTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {tab}
                {tab === "ES" && hasMissingEs && (
                  <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            ))}
          </div>

          {langTab === "EN" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-catalog-name">Name</Label>
                <Input
                  id="edit-catalog-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-catalog-desc">Description (optional)</Label>
                <Textarea
                  id="edit-catalog-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-catalog-name-es">Name (Spanish)</Label>
                <Input
                  id="edit-catalog-name-es"
                  value={nameEs}
                  onChange={(e) => setNameEs(e.target.value)}
                  placeholder="Spanish translation (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-catalog-desc-es">Description (Spanish, optional)</Label>
                <Textarea
                  id="edit-catalog-desc-es"
                  value={descriptionEs}
                  onChange={(e) => setDescriptionEs(e.target.value)}
                  placeholder="Spanish translation (optional)"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Scheduling window */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-catalog-opens">Opens at (optional)</Label>
              <Input
                id="edit-catalog-opens"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-catalog-closes">Closes at (optional)</Label>
              <Input
                id="edit-catalog-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Schedule when this catalog opens and closes. Leave blank for manual control.
          </p>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
