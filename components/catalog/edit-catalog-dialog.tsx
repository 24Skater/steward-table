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
import { Switch } from "@/components/ui/switch";
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
  _count: { items: number };
}

interface EditCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Catalog;
  onUpdated: (catalog: Catalog) => void;
}

type LangTab = "EN" | "ES";

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
  const [isActive, setIsActive] = useState(catalog.isActive);
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
          isActive,
          translations: Object.keys(translations).length > 0 ? translations : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update catalog");
      }

      const updated = await res.json();
      onUpdated({
        ...updated,
        _count: catalog._count,
        isActive: (updated.status ?? catalog.status) === "OPEN",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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

          <div className="flex items-center gap-3">
            <Switch
              id="edit-catalog-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="edit-catalog-active">Active</Label>
          </div>
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
