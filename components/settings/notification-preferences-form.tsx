"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotificationValues {
  emailConfirmationEnabled: boolean;
  emailStatusEnabled: boolean;
  emailStaffOnNewOrder: boolean;
  smsEnabled: boolean;
  smsConfirmationEnabled: boolean;
  smsReadyEnabled: boolean;
}

interface NotificationPreferencesFormProps {
  initialValues: NotificationValues;
  twilioEnabled: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function NotificationPreferencesForm({
  initialValues,
  twilioEnabled,
}: NotificationPreferencesFormProps) {
  const [values, setValues] = useState<NotificationValues>(initialValues);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggle(field: keyof NotificationValues) {
    setValues((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to save notification settings",
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email notifications */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Email notifications</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Transactional emails sent to customers and staff via your configured sending
            domain.
          </p>
        </div>

        <ToggleRow
          id="email-confirmation"
          label="Send confirmation emails to customers"
          description="Email customers when their order is placed."
          checked={values.emailConfirmationEnabled}
          onCheckedChange={() => toggle("emailConfirmationEnabled")}
        />

        <ToggleRow
          id="email-status"
          label="Send status emails to customers"
          description="Notify customers when their order is ready or has been updated."
          checked={values.emailStatusEnabled}
          onCheckedChange={() => toggle("emailStatusEnabled")}
        />

        <ToggleRow
          id="email-staff"
          label="Notify staff by email for new orders"
          description="Send an email to your reply-to address each time a new order is submitted."
          checked={values.emailStaffOnNewOrder}
          onCheckedChange={() => toggle("emailStaffOnNewOrder")}
        />
      </div>

      {/* SMS notifications */}
      <div
        className={
          !twilioEnabled
            ? "rounded-lg border border-slate-200 bg-white p-6 space-y-5 opacity-60"
            : "rounded-lg border border-slate-200 bg-white p-6 space-y-5"
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">SMS notifications</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {twilioEnabled
                ? "Text messages sent to customers via Twilio."
                : "Requires Twilio configuration — set TWILIO_ACCOUNT_SID to enable."}
            </p>
          </div>
          {!twilioEnabled && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Not configured
            </span>
          )}
        </div>

        <ToggleRow
          id="sms-enabled"
          label="Enable SMS notifications"
          description="Master toggle for all outbound SMS messages."
          checked={values.smsEnabled}
          onCheckedChange={() => toggle("smsEnabled")}
          disabled={!twilioEnabled}
        />

        <ToggleRow
          id="sms-confirmation"
          label="Send SMS confirmation to customers"
          description="Text customers when their order is placed."
          checked={values.smsConfirmationEnabled}
          onCheckedChange={() => toggle("smsConfirmationEnabled")}
          disabled={!twilioEnabled || !values.smsEnabled}
        />

        <ToggleRow
          id="sms-ready"
          label="Send SMS when order is ready"
          description="Text customers when their order is ready for pickup or delivery."
          checked={values.smsReadyEnabled}
          onCheckedChange={() => toggle("smsReadyEnabled")}
          disabled={!twilioEnabled || !values.smsEnabled}
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
        {(saveState === "idle" || saveState === "error") && "Save changes"}
      </Button>
    </form>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label
          htmlFor={id}
          className={
            disabled ? "text-sm font-medium text-slate-400" : "text-sm font-medium text-slate-800"
          }
        >
          {label}
        </Label>
        <p className={disabled ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}
