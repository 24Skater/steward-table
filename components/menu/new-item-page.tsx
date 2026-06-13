"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewItemPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const priceFloat = parseFloat(priceStr);
    if (!trimmedName || isNaN(priceFloat) || priceFloat < 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          priceCents: Math.round(priceFloat * 100),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to create item");
      }

      const data = await res.json() as { item: { id: string } };
      router.push(`/menu/items/${data.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-14 border-b border-slate-200 bg-white shrink-0">
        <Link href="/menu">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <h2 className="text-base font-semibold text-slate-800">New Item</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-md space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pupusa Revuelta"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-price">Default price (USD)</Label>
            <Input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="3.00"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-description">Description (optional)</Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={saving || !name.trim() || !priceStr}>
              {saving ? "Creating…" : "Create item"}
            </Button>
            <Link href="/menu">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>

          <p className="text-xs text-slate-400">
            You can add Spanish translations, modifiers, and a photo after saving.
          </p>
        </form>
      </div>
    </div>
  );
}
