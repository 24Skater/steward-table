"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface DeliveryZone {
  id: string;
  name: string;
  postalCodes: string[];
  feeCents: number;
  minOrderCents: number;
}

interface DeliveryZonesManagerProps {
  initialZones: DeliveryZone[];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function DeliveryZonesManager({ initialZones }: DeliveryZonesManagerProps) {
  const [zones, setZones] = useState<DeliveryZone[]>(initialZones);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formPostalCodes, setFormPostalCodes] = useState("");
  const [formFee, setFormFee] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/settings/delivery-zones?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to delete zone");
      }
      setZones((prev) => prev.filter((z) => z.id !== id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const parsedPostalCodes = formPostalCodes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!formName.trim()) {
      setAddError("Zone name is required.");
      return;
    }
    if (parsedPostalCodes.length === 0) {
      setAddError("At least one postal code is required.");
      return;
    }

    const feeValue = Number.parseFloat(formFee);
    if (Number.isNaN(feeValue) || feeValue < 0) {
      setAddError("Delivery fee must be a non-negative number.");
      return;
    }

    const minOrderValue = formMinOrder.trim() === "" ? 0 : Number.parseFloat(formMinOrder);
    if (Number.isNaN(minOrderValue) || minOrderValue < 0) {
      setAddError("Minimum order must be a non-negative number.");
      return;
    }

    const feeCents = Math.round(feeValue * 100);
    const minOrderCents = Math.round(minOrderValue * 100);

    setAdding(true);
    try {
      const res = await fetch("/api/settings/delivery-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          postalCodes: parsedPostalCodes,
          feeCents,
          minOrderCents,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to create zone");
      }

      const newZone = (await res.json()) as DeliveryZone;
      setZones((prev) => [...prev, newZone]);
      setFormName("");
      setFormPostalCodes("");
      setFormFee("");
      setFormMinOrder("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Zone list */}
      {zones.length === 0 ? (
        <p className="text-sm text-slate-500">No delivery zones configured yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Zone</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Postal codes</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Fee</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Min. order</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-700" />
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => {
                const codesPreview =
                  zone.postalCodes.length > 4
                    ? `${zone.postalCodes.slice(0, 4).join(", ")} +${zone.postalCodes.length - 4} more`
                    : zone.postalCodes.join(", ");

                return (
                  <tr key={zone.id} className="border-b border-slate-100 last:border-0 bg-white">
                    <td className="px-4 py-3 font-medium text-slate-900">{zone.name}</td>
                    <td className="px-4 py-3 text-slate-600">{codesPreview}</td>
                    <td className="px-4 py-3 text-slate-600">{formatCents(zone.feeCents)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {zone.minOrderCents === 0 ? "None" : formatCents(zone.minOrderCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(zone.id)}
                        disabled={deletingId === zone.id}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        aria-label={`Delete ${zone.name}`}
                      >
                        <Trash2 size={13} />
                        {deletingId === zone.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteError && <p className="text-sm text-rose-600">{deleteError}</p>}

      {/* Add zone form */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Add delivery zone</h3>
        <form onSubmit={handleAdd} className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label htmlFor="zone-name">Zone name</Label>
            <Input
              id="zone-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Downtown"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zone-postal-codes">Postal codes (comma-separated)</Label>
            <Input
              id="zone-postal-codes"
              value={formPostalCodes}
              onChange={(e) => setFormPostalCodes(e.target.value)}
              placeholder="e.g. 20715, 20705, 20706"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="zone-fee">Delivery fee ($)</Label>
              <Input
                id="zone-fee"
                type="number"
                min={0}
                step={0.01}
                value={formFee}
                onChange={(e) => setFormFee(e.target.value)}
                placeholder="e.g. 2.99"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zone-min-order">Minimum order ($, 0 = none)</Label>
              <Input
                id="zone-min-order"
                type="number"
                min={0}
                step={0.01}
                value={formMinOrder}
                onChange={(e) => setFormMinOrder(e.target.value)}
                placeholder="e.g. 15.00"
              />
            </div>
          </div>

          {addError && <p className="text-sm text-rose-600">{addError}</p>}

          <Button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add zone"}
          </Button>
        </form>
      </div>
    </div>
  );
}
