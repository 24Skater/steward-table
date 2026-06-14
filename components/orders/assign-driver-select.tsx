"use client";

import { useState } from "react";

export interface DriverOption {
  id: string;
  name: string | null;
}

interface AssignDriverSelectProps {
  orderId: string;
  currentDriverId: string | null;
  drivers: DriverOption[];
}

export function AssignDriverSelect({ orderId, currentDriverId, drivers }: AssignDriverSelectProps) {
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(currentDriverId ?? "");

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newDriverId = e.target.value || null;
    setSelectedId(e.target.value);
    setSaving(true);
    try {
      await fetch(`/api/orders/${orderId}/driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: newDriverId }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={selectedId}
        onChange={handleChange}
        disabled={saving}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name ?? d.id}
          </option>
        ))}
      </select>
      {saving && <p className="text-xs text-slate-400">Saving…</p>}
    </div>
  );
}
