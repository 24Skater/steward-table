"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CashZelleSettingsFormProps {
  initialAcceptCash: boolean;
  initialAcceptZelle: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function CashZelleSettingsForm({
  initialAcceptCash,
  initialAcceptZelle,
}: CashZelleSettingsFormProps) {
  const [acceptCash, setAcceptCash] = useState(initialAcceptCash);
  const [acceptZelle, setAcceptZelle] = useState(initialAcceptZelle);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/payment/methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptCash, acceptZelle }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save settings");
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <ToggleRow
          id="accept-cash"
          label="Accept cash"
          description="Customers can choose to pay with cash when picking up their order."
          checked={acceptCash}
          onChange={setAcceptCash}
        />
        <ToggleRow
          id="accept-zelle"
          label="Accept Zelle"
          description="Customers can choose to pay via Zelle. Instructions are emailed after ordering."
          checked={acceptZelle}
          onChange={setAcceptZelle}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button type="submit" disabled={saveState === "saving"}>
        {saveState === "saving" && "Saving…"}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            Saved
          </span>
        )}
        {(saveState === "idle" || saveState === "error") && "Save"}
      </Button>
    </form>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-slate-800 cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
          checked ? "bg-emerald-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
