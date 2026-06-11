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
import { CATALOG_TEMPLATES } from "@/lib/catalog-templates";
import { cn } from "@/lib/utils";

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

const BLANK_TEMPLATE_KEY = "__blank__";

export function CreateCatalogDialog({
  open,
  onOpenChange,
  churchId,
  onCreated,
}: CreateCatalogDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(BLANK_TEMPLATE_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTemplateSelect(key: string) {
    setSelectedTemplateKey(key);
    if (key !== BLANK_TEMPLATE_KEY) {
      const template = CATALOG_TEMPLATES.find((t) => t.key === key);
      if (template && !name.trim()) {
        setName(template.name);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const isTemplate = selectedTemplateKey !== BLANK_TEMPLATE_KEY;
      const endpoint = isTemplate ? "/api/catalogs/from-template" : "/api/catalogs";
      const payload = isTemplate
        ? { catalogName: name.trim(), templateKey: selectedTemplateKey, churchId }
        : { name: name.trim(), description: description.trim() || null, churchId };

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
      const catalogId: string = isTemplate ? (data as { catalogId: string }).catalogId : (data as { id: string }).id;

      onCreated({
        id: catalogId,
        name: name.trim(),
        description: description.trim() || null,
        isActive: false,
        status: "DRAFT",
        _count: { items: isTemplate ? CATALOG_TEMPLATES.find((t) => t.key === selectedTemplateKey)?.items.length ?? 0 : 0 },
      });

      setName("");
      setDescription("");
      setSelectedTemplateKey(BLANK_TEMPLATE_KEY);
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
          <div className="space-y-2">
            <Label>Start from template</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedTemplateKey(BLANK_TEMPLATE_KEY)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selectedTemplateKey === BLANK_TEMPLATE_KEY
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span className="block font-medium">Blank</span>
                <span className="block text-xs text-muted-foreground">Start from scratch</span>
              </button>
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
                  <span className="block text-xs text-muted-foreground">{template.description}</span>
                </button>
              ))}
            </div>
          </div>
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
          {selectedTemplateKey === BLANK_TEMPLATE_KEY && (
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
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
