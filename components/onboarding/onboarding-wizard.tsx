"use client";

import { useId, useState } from "react";

type Step = 1 | 2 | 3;

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
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

interface ChurchForm {
  churchName: string;
  slug: string;
  timezone: string;
}

interface ProfileForm {
  displayName: string;
  phone: string;
}

interface FormErrors {
  churchName?: string;
  slug?: string;
  displayName?: string;
  submit?: string;
}

interface OnboardingWizardProps {
  initialDisplayName?: string;
}

export function OnboardingWizard({ initialDisplayName = "" }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [churchForm, setChurchForm] = useState<ChurchForm>({
    churchName: "",
    slug: "",
    timezone: "America/New_York",
  });

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    displayName: initialDisplayName,
    phone: "",
  });

  // IDs for accessibility
  const nameId = useId();
  const slugId = useId();
  const timezoneId = useId();
  const displayNameId = useId();
  const phoneId = useId();

  function handleChurchNameChange(value: string) {
    setChurchForm((prev) => ({
      ...prev,
      churchName: value,
      slug: generateSlug(value),
    }));
    setErrors((prev) => ({ ...prev, churchName: undefined }));
  }

  function handleSlugChange(value: string) {
    setChurchForm((prev) => ({ ...prev, slug: value }));
    setErrors((prev) => ({ ...prev, slug: undefined }));
  }

  function validateStep1(): boolean {
    const next: FormErrors = {};

    if (!churchForm.churchName.trim()) {
      next.churchName = "Church name is required.";
    }

    if (!churchForm.slug) {
      next.slug = "URL slug is required.";
    } else if (
      !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(churchForm.slug) ||
      churchForm.slug.length < 3
    ) {
      next.slug = "Must be at least 3 characters: lowercase letters, numbers, and hyphens only.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: FormErrors = {};

    if (!profileForm.displayName.trim()) {
      next.displayName = "Display name is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleStep2Continue() {
    if (!validateStep2()) return;
    await submitOnboarding();
  }

  async function submitOnboarding() {
    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchName: churchForm.churchName.trim(),
          slug: churchForm.slug,
          timezone: churchForm.timezone,
          displayName: profileForm.displayName.trim(),
          phone: profileForm.phone.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        // Already has membership
        window.location.href = "/";
        return;
      }

      if (res.status === 422) {
        const data: unknown = await res.json().catch(() => null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "That URL is already taken.";
        setErrors({ slug: message });
        setStep(1);
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

      setStep(3);
    } catch {
      setErrors({ submit: "Network error. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const appUrl =
    typeof window !== "undefined"
      ? window.location.hostname.includes("localhost")
        ? "yoursite.com"
        : window.location.hostname
      : "yoursite.com";

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Step indicator */}
      <div className="px-8 pt-6 pb-0 flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-slate-900" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Church Info */}
      {step === 1 && (
        <div className="p-8">
          <div className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
              <span className="text-white text-sm font-semibold">ST</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">Set up your church</h1>
            <p className="text-sm text-slate-500">Step 1 of 2 — Church details</p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor={nameId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Church name <span className="text-red-500">*</span>
              </label>
              <input
                id={nameId}
                type="text"
                value={churchForm.churchName}
                onChange={(e) => handleChurchNameChange(e.target.value)}
                placeholder="Grace Community Church"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {errors.churchName && (
                <p className="mt-1.5 text-xs text-red-600">{errors.churchName}</p>
              )}
            </div>

            <div>
              <label htmlFor={slugId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Church URL <span className="text-red-500">*</span>
              </label>
              <input
                id={slugId}
                type="text"
                value={churchForm.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="grace-community"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {churchForm.slug && !errors.slug && (
                <p className="mt-1.5 text-xs text-slate-400">{churchForm.slug}.table.steward.app</p>
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
                value={churchForm.timezone}
                onChange={(e) => setChurchForm((prev) => ({ ...prev, timezone: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-slate-800 transition-colors mt-2"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Your Profile */}
      {step === 2 && (
        <div className="p-8">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors"
            >
              Back
            </button>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Your profile</h2>
            <p className="text-sm text-slate-500">Step 2 of 2 — How should we address you?</p>
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor={displayNameId}
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Display name <span className="text-red-500">*</span>
              </label>
              <input
                id={displayNameId}
                type="text"
                value={profileForm.displayName}
                onChange={(e) => {
                  setProfileForm((prev) => ({ ...prev, displayName: e.target.value }));
                  setErrors((prev) => ({ ...prev, displayName: undefined }));
                }}
                placeholder="Pastor John"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {errors.displayName && (
                <p className="mt-1.5 text-xs text-red-600">{errors.displayName}</p>
              )}
            </div>

            <div>
              <label htmlFor={phoneId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id={phoneId}
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            {errors.submit && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {errors.submit}
              </p>
            )}

            <button
              type="button"
              onClick={handleStep2Continue}
              disabled={submitting}
              className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {submitting ? "Setting up..." : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: All Set */}
      {step === 3 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Your church is ready</h2>
          <p className="text-sm text-slate-500 mb-6">
            {churchForm.churchName} has been set up successfully.
          </p>

          {/* Summary card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Church
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{churchForm.churchName}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {appUrl}/{churchForm.slug}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
