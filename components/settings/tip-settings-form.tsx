"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const PRESET_OPTIONS = [5, 10, 15, 18, 20, 25];

interface TipSettingsFormProps {
  initialEnabled: boolean;
  initialPercentages: number[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function TipSettingsForm({ initialEnabled, initialPercentages }: TipSettingsFormProps) {
  const [tipEnabled, setTipEnabled] = useState(initialEnabled);
  const [percentages, setPercentages] = useState<number[]>(initialPercentages);
  const [customInput, setCustomInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function togglePreset(pct: number) {
    setPercentages((prev) =>
      prev.includes(pct) ? prev.filter((p) => p !== pct) : [...prev, pct].sort((a, b) => a - b),
    );
  }

  function addCustom() {
    const val = parseInt(customInput.trim(), 10);
    if (!val || val < 1 || val > 100) return;
    if (!percentages.includes(val)) {
      setPercentages((prev) => [...prev, val].sort((a, b) => a - b));
    }
    setCustomInput("");
  }

  function removePercentage(pct: number) {
    setPercentages((prev) => prev.filter((p) => p !== pct));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (percentages.length === 0) return;

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/tips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipEnabled, tipPercentages: percentages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to save tip settings");
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div className="space-y-0.5">
          <Label htmlFor="tip-enabled" className="text-sm font-medium text-slate-900">
            Enable Tips
          </Label>
          <p className="text-xs text-slate-500">
            Show a tip selection step on the checkout page.
          </p>
        </div>
        <Switch
          id="tip-enabled"
          checked={tipEnabled}
          onCheckedChange={setTipEnabled}
        />
      </div>

      {tipEnabled && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Tip Percentages</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => togglePreset(pct)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    percentages.includes(pct)
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Toggle presets on/off. Customers will also see a "No tip" option.
            </p>
          </div>

          {percentages.some((p) => !PRESET_OPTIONS.includes(p)) && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Custom percentages:</p>
              <div className="flex flex-wrap gap-2">
                {percentages.filter((p) => !PRESET_OPTIONS.includes(p)).map((pct) => (
                  <span
                    key={pct}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-slate-100 text-slate-700"
                  >
                    {pct}%
                    <button
                      type="button"
                      onClick={() => removePercentage(pct)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="custom-tip">Add custom percentage</Label>
            <div className="flex gap-2 max-w-xs">
              <Input
                id="custom-tip"
                type="number"
                min={1}
                max={100}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                placeholder="e.g. 12"
                className="max-w-24"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustom}>
                Add
              </Button>
            </div>
          </div>

          {percentages.length === 0 && (
            <p className="text-sm text-amber-600">
              Select at least one tip percentage to save.
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button
        type="submit"
        disabled={saveState === "saving" || (tipEnabled && percentages.length === 0)}
      >
        {saveState === "saving" && "Saving…"}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            Saved
          </span>
        )}
        {(saveState === "idle" || saveState === "error") && "Save tip settings"}
      </Button>
    </form>
  );
}
