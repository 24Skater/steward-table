"use client";

import { useId, useState } from "react";

type Step = "welcome" | "details" | "done";

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time - Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

interface FormState {
  name: string;
  slug: string;
  timezone: string;
}

interface FormErrors {
  name?: string;
  slug?: string;
  timezone?: string;
  submit?: string;
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("welcome");
  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    timezone: "America/Chicago",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const nameId = useId();
  const slugId = useId();
  const timezoneId = useId();

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  }

  function handleSlugChange(value: string) {
    setForm((prev) => ({ ...prev, slug: value }));
    setErrors((prev) => ({ ...prev, slug: undefined }));
  }

  function validate(): boolean {
    const next: FormErrors = {};

    if (!form.name.trim()) {
      next.name = "Church name is required.";
    }

    if (!form.slug) {
      next.slug = "URL is required.";
    } else if (!/^[a-z0-9-]{3,50}$/.test(form.slug)) {
      next.slug = "Must be 3–50 lowercase letters, numbers, or hyphens.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/onboarding/church", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug,
          timezone: form.timezone,
        }),
      });

      if (res.status === 409) {
        setErrors({ slug: "That URL is already taken. Please choose another." });
        return;
      }

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Something went wrong. Please try again.";
        setErrors({ submit: message });
        return;
      }

      setStep("done");
    } catch {
      setErrors({ submit: "Network error. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {step === "welcome" && (
        <div className="p-8">
          <div className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
              <span className="text-white text-sm font-semibold">ST</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Welcome to Steward Table</h1>
            <p className="text-sm text-slate-500">
              Let&apos;s set up your church so your team can start managing orders.
            </p>
          </div>
          <button
            onClick={() => setStep("details")}
            className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Get started
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="p-8">
          <div className="mb-6">
            <button
              onClick={() => setStep("welcome")}
              className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors"
            >
              Back
            </button>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Church details</h2>
            <p className="text-sm text-slate-500">This can be changed later in settings.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor={nameId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Church name
              </label>
              <input
                id={nameId}
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Grace Community Church"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor={slugId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Church URL
              </label>
              <input
                id={slugId}
                type="text"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="grace-community"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {form.slug && !errors.slug && (
                <p className="mt-1.5 text-xs text-slate-400">{form.slug}.table.steward.app</p>
              )}
              {errors.slug && <p className="mt-1.5 text-xs text-red-600">{errors.slug}</p>}
            </div>

            <div>
              <label
                htmlFor={timezoneId}
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Timezone
              </label>
              <select
                id={timezoneId}
                value={form.timezone}
                onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {errors.submit && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {errors.submit}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {submitting ? "Setting up..." : "Create church"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Your church is ready</h2>
          <p className="text-sm text-slate-500 mb-6">
            {form.name} has been set up. You can now start managing orders.
          </p>
          <button
            onClick={() => {
              window.location.href = "/orders";
            }}
            className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
