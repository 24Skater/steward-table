"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface FulfillmentSettingsProps {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  deliveryRadiusMiles: number | null;
  pickupInstructions: string | null;
  pickupWindowStartHour: number;
  pickupWindowEndHour: number;
  slotIntervalMinutes: number;
  maxOrdersPerSlot: number;
}

function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function FulfillmentSettings({
  pickupEnabled: initialPickup,
  deliveryEnabled: initialDelivery,
  dineInEnabled: initialDineIn,
  deliveryRadiusMiles: initialRadius,
  pickupInstructions: initialInstructions,
  pickupWindowStartHour: initialStartHour,
  pickupWindowEndHour: initialEndHour,
  slotIntervalMinutes: initialInterval,
  maxOrdersPerSlot: initialMaxOrders,
}: FulfillmentSettingsProps) {
  const [pickupEnabled, setPickupEnabled] = useState(initialPickup);
  const [deliveryEnabled, setDeliveryEnabled] = useState(initialDelivery);
  const [dineInEnabled, setDineInEnabled] = useState(initialDineIn);
  const [deliveryRadiusMiles, setDeliveryRadiusMiles] = useState(
    initialRadius !== null ? String(initialRadius) : "",
  );
  const [pickupInstructions, setPickupInstructions] = useState(initialInstructions ?? "");
  const [pickupWindowStartHour, setPickupWindowStartHour] = useState(initialStartHour);
  const [pickupWindowEndHour, setPickupWindowEndHour] = useState(initialEndHour);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(initialInterval);
  const [maxOrdersPerSlot, setMaxOrdersPerSlot] = useState(initialMaxOrders);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const radiusValue =
        deliveryEnabled && deliveryRadiusMiles.trim()
          ? Number(deliveryRadiusMiles)
          : null;

      const res = await fetch("/api/settings/fulfillment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupEnabled,
          deliveryEnabled,
          dineInEnabled,
          deliveryRadiusMiles: radiusValue,
          pickupInstructions: pickupEnabled ? pickupInstructions.trim() || null : null,
          pickupWindowStartHour,
          pickupWindowEndHour,
          slotIntervalMinutes,
          maxOrdersPerSlot,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to save fulfillment settings",
        );
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Pickup */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Enable Pickup orders</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Customers can pick up their orders at your location.
          </p>
        </div>
        <Switch
          checked={pickupEnabled}
          onCheckedChange={setPickupEnabled}
          aria-label="Enable pickup orders"
        />
      </div>

      {pickupEnabled && (
        <div className="space-y-4 pl-1">
          <div className="space-y-1.5">
            <Label htmlFor="pickup-instructions">Pickup Instructions (optional)</Label>
            <Textarea
              id="pickup-instructions"
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              placeholder="Enter your pickup location or special instructions..."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-900">Pickup Window Hours</p>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pickup-window-start">Window Start</Label>
                <select
                  id="pickup-window-start"
                  value={pickupWindowStartHour}
                  onChange={(e) => setPickupWindowStartHour(Number(e.target.value))}
                  className="flex h-9 w-36 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHour(i)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pickup-window-end">Window End</Label>
                <select
                  id="pickup-window-end"
                  value={pickupWindowEndHour}
                  onChange={(e) => setPickupWindowEndHour(Number(e.target.value))}
                  className="flex h-9 w-36 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHour(i)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slot-interval">Slot Interval</Label>
                <select
                  id="slot-interval"
                  value={slotIntervalMinutes}
                  onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
                  className="flex h-9 w-36 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-orders-per-slot">Order Capacity per Slot</Label>
            <Input
              id="max-orders-per-slot"
              type="number"
              min={0}
              max={999}
              step={1}
              value={maxOrdersPerSlot}
              onChange={(e) => setMaxOrdersPerSlot(Number(e.target.value))}
              placeholder="0"
              className="max-w-xs"
            />
            <p className="text-xs text-slate-500">
              Maximum number of orders per time slot. Set to 0 for no limit.
            </p>
          </div>
        </div>
      )}

      {/* Delivery */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Enable Delivery orders</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Drivers can deliver orders to customer addresses.
          </p>
        </div>
        <Switch
          checked={deliveryEnabled}
          onCheckedChange={setDeliveryEnabled}
          aria-label="Enable delivery orders"
        />
      </div>

      {deliveryEnabled && (
        <div className="space-y-1.5 pl-1">
          <Label htmlFor="delivery-radius">Delivery Radius (miles)</Label>
          <Input
            id="delivery-radius"
            type="number"
            min={1}
            max={500}
            step={1}
            value={deliveryRadiusMiles}
            onChange={(e) => setDeliveryRadiusMiles(e.target.value)}
            placeholder="10"
            className="max-w-xs"
          />
        </div>
      )}

      {/* Dine-in */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Enable Dine-in orders</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Customers can place orders to be served on-site.
          </p>
        </div>
        <Switch
          checked={dineInEnabled}
          onCheckedChange={setDineInEnabled}
          aria-label="Enable dine-in orders"
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button type="submit" disabled={saveState === "saving"}>
        {saveState === "saving" && "Saving..."}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            Saved
          </span>
        )}
        {(saveState === "idle" || saveState === "error") && "Save fulfillment settings"}
      </Button>
    </form>
  );
}
