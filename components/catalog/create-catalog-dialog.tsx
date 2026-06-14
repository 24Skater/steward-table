"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG_TEMPLATES } from "@/lib/catalog-templates";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface CreatedCatalog {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  status: string;
  _count: { items: number };
}

interface CreateCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onCreated: (catalog: CreatedCatalog) => void;
}

interface ExistingCatalog {
  id: string;
  name: string;
  _count: { items: number };
}

type CreateMode = "blank" | "template" | "clone";

const BLANK_TEMPLATE_KEY = "__blank__";

export function CreateCatalogDialog({
  open,
  onOpenChange,
  churchId,
  onCreated,
}: CreateCatalogDialogProps) {
  const [mode, setMode] = useState<CreateMode>("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(BLANK_TEMPLATE_KEY);
  const [sourceCatalogId, setSourceCatalogId] = useState<string>("");
  const [existingCatalogs, setExistingCatalogs] = useState<ExistingCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "clone") {
      void fetch(`/api/catalogs?churchId=${churchId}`)
        .then((r) => r.json())
        .then((data: ExistingCatalog[]) => {
          setExistingCatalogs(data);
          if (data.length > 0 && !sourceCatalogId) {
            setSourceCatalogId(data[0]?.id ?? "");
          }
        })
        .catch(() => null);
    }
  }, [open, mode, churchId, sourceCatalogId]);

  function handleTemplateSelect(key: string) {
    setSelectedTemplateKey(key);
    const template = CATALOG_TEMPLATES.find((t) => t.key === key);
    if (template && !name.trim()) {
      setName(template.name);
    }
  }

  function handleModeChange(newMode: CreateMode) {
    setMode(newMode);
    setError(null);
    if (newMode === "clone" && existingCatalogs.length === 0) {
      void fetch(`/api/catalogs?churchId=${churchId}`)
        .then((r) => r.json())
        .then((data: ExistingCatalog[]) => {
          setExistingCatalogs(data);
          if (data.length > 0) setSourceCatalogId(data[0]?.id ?? "");
        })
        .catch(() => null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "clone" && !sourceCatalogId) return;

    setLoading(true);
    setError(null);

    try {
      let endpoint: string;
      let payload: Record<string, unknown>;
      let itemCount = 0;

      if (mode === "template") {
        endpoint = "/api/catalogs/from-template";
        payload = { catalogName: name.trim(), templateKey: selectedTemplateKey, churchId };
        itemCount = CATALOG_TEMPLATES.find((t) => t.key === selectedTemplateKey)?.items.length ?? 0;
      } else if (mode === "clone") {
        endpoint = "/api/catalogs/clone";
        payload = { sourceCatalogId, name: name.trim(), churchId };
        itemCount = existingCatalogs.find((c) => c.id === sourceCatalogId)?._count.items ?? 0;
      } else {
        endpoint = "/api/catalogs";
        payload = { name: name.trim(), description: description.trim() || null, churchId };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create catalog");
      }

      const data = await res.json();
      const catalogId: string =
        mode === "blank" ? (data as { id: string }).id : (data as { catalogId: string }).catalogId;

      onCreated({
        id: catalogId,
        name: name.trim(),
        description: mode === "blank" ? description.trim() || null : null,
        isActive: false,
        status: "DRAFT",
        _count: { items: itemCount },
      });

      setName("");
      setDescription("");
      setSelectedTemplateKey(BLANK_TEMPLATE_KEY);
      setSourceCatalogId("");
      setMode("blank");
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
          <DialogTitle>New Catalog</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode tabs */}
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            {(["blank", "template", "clone"] as CreateMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={cn(
                  "flex-1 py-1.5 font-medium capitalize transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Template grid */}
          {mode === "template" && (
            <div className="grid grid-cols-2 gap-2">
              {CATALOG_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => handleTemplateSelect(template.key)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selectedTemplateKey === template.key
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span className="block font-medium">{template.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Clone source picker */}
          {mode === "clone" && (
            <div className="space-y-2">
              <Label htmlFor="source-catalog">Clone from</Label>
              {existingCatalogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No existing catalogs to clone.</p>
              ) : (
                <select
                  id="source-catalog"
                  value={sourceCatalogId}
                  onChange={(e) => setSourceCatalogId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {existingCatalogs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c._count.items} items)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="catalog-name">Name</Label>
            <Input
              id="catalog-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunday Breakfast Menu"
              required
            />
          </div>
          {mode === "blank" && (
            <div className="space-y-2">
              <Label htmlFor="catalog-desc">Description (optional)</Label>
              <Textarea
                id="catalog-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Available after 9am service"
                rows={3}
              />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !name.trim() ||
                (mode === "clone" && !sourceCatalogId) ||
                (mode === "template" && selectedTemplateKey === BLANK_TEMPLATE_KEY)
              }
            >
              {loading ? "Creating..." : "Create Catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
