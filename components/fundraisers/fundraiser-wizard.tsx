"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Ministry {
  id: string;
  name: string;
}
interface Kitchen {
  id: string;
  name: string;
}

interface WizardOption {
  name: string;
  priceDelta: number;
}
interface WizardModifierGroup {
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: WizardOption[];
}
interface WizardItem {
  name: string;
  price: number; // cents
  imageUrl?: string | null;
  modifierGroups: WizardModifierGroup[];
}

interface FundraiserWizardProps {
  churchId: string;
  ministries: Ministry[];
  kitchens: Kitchen[];
  cloneFromCatalogId: string | null;
}

type SectionId = "basics" | "items" | "delivery" | "publish";

const EMPTY_ITEM: WizardItem = { name: "", price: 0, modifierGroups: [] };

// Hoisted (not defined inside FundraiserWizard) so its component identity is
// stable across renders — an inline definition would remount the subtree and
// drop input focus on every keystroke.
function Section({
  id,
  number,
  title,
  summary,
  openSection,
  onOpen,
  children,
}: {
  id: SectionId;
  number: number;
  title: string;
  summary?: string;
  openSection: SectionId;
  onOpen: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  const isOpen = openSection === id;
  return (
    <div className={`rounded-xl border-2 ${isOpen ? "border-emerald-500" : "border-slate-200"}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => onOpen(id)}
      >
        <span className="font-semibold">
          {number} · {title}
        </span>
        {!isOpen && summary && <span className="text-sm text-emerald-600">{summary}</span>}
      </button>
      {isOpen && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  );
}

export function FundraiserWizard({
  churchId,
  ministries: initialMinistries,
  kitchens,
  cloneFromCatalogId,
}: FundraiserWizardProps) {
  const router = useRouter();
  const [openSection, setOpenSection] = useState<SectionId>("basics");
  const [ministries, setMinistries] = useState(initialMinistries);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCatalogId, setCreatedCatalogId] = useState<string | null>(null);
  const [volunteerUrl, setVolunteerUrl] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ministryId, setMinistryId] = useState<string>("");
  const [newMinistryName, setNewMinistryName] = useState("");
  const [kitchenId, setKitchenId] = useState<string>(kitchens[0]?.id ?? "");
  const [closesAt, setClosesAt] = useState("");
  const [minItemsForDelivery, setMinItemsForDelivery] = useState("");
  const [items, setItems] = useState<WizardItem[]>([{ ...EMPTY_ITEM }]);

  // Clone prefill
  useEffect(() => {
    if (!cloneFromCatalogId) return;
    fetch(`/api/fundraisers/${cloneFromCatalogId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          name: string;
          description: string | null;
          ministryId: string | null;
          minItemsForDelivery: number | null;
          kitchenId: string | null;
          items: WizardItem[];
        };
        setName(`${data.name} (copy)`);
        setDescription(data.description ?? "");
        setMinistryId(data.ministryId ?? "");
        setKitchenId(data.kitchenId ?? kitchens[0]?.id ?? "");
        setMinItemsForDelivery(data.minItemsForDelivery ? String(data.minItemsForDelivery) : "");
        setItems(data.items.length > 0 ? data.items : [{ ...EMPTY_ITEM }]);
      })
      .catch(() => null);
  }, [cloneFromCatalogId, kitchens]);

  function updateItem(index: number, patch: Partial<WizardItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addOptionGroup(itemIndex: number) {
    const item = items[itemIndex];
    if (!item) return;
    updateItem(itemIndex, {
      modifierGroups: [
        ...item.modifierGroups,
        {
          name: "",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          options: [{ name: "", priceDelta: 0 }],
        },
      ],
    });
  }

  function updateGroup(itemIndex: number, groupIndex: number, patch: Partial<WizardModifierGroup>) {
    const item = items[itemIndex];
    if (!item) return;
    updateItem(itemIndex, {
      modifierGroups: item.modifierGroups.map((g, i) =>
        i === groupIndex ? { ...g, ...patch } : g,
      ),
    });
  }

  async function ensureMinistry(): Promise<string | null> {
    if (ministryId) return ministryId;
    if (!newMinistryName.trim()) return null;
    const res = await fetch("/api/ministries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ churchId, name: newMinistryName.trim() }),
    });
    if (!res.ok) throw new Error("Could not create ministry");
    const ministry = (await res.json()) as Ministry;
    setMinistries((prev) => (prev.some((m) => m.id === ministry.id) ? prev : [...prev, ministry]));
    setMinistryId(ministry.id);
    return ministry.id;
  }

  async function handleSaveDraft(): Promise<string | null> {
    setError(null);
    const validItems = items.filter((item) => item.name.trim() && item.price > 0);
    if (!name.trim() || validItems.length === 0) {
      setError("A fundraiser needs a name and at least one item with a price.");
      return null;
    }
    setSaving(true);
    try {
      const resolvedMinistryId = await ensureMinistry();
      const res = await fetch("/api/fundraisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchId,
          name: name.trim(),
          description: description.trim() || null,
          ministryId: resolvedMinistryId,
          kitchenId: kitchenId || null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          opensAt: new Date().toISOString(),
          minItemsForDelivery: minItemsForDelivery ? Number(minItemsForDelivery) : null,
          items: validItems.map((item) => ({
            ...item,
            modifierGroups: item.modifierGroups
              .filter((g) => g.name.trim() && g.options.some((o) => o.name.trim()))
              .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()) })),
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to save fundraiser");
      }
      const { catalogId } = (await res.json()) as { catalogId: string };
      setCreatedCatalogId(catalogId);
      return catalogId;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const catalogId = createdCatalogId ?? (await handleSaveDraft());
    if (!catalogId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      setOpenSection("publish");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateVolunteerLink() {
    if (!createdCatalogId) return;
    const res = await fetch(`/api/fundraisers/${createdCatalogId}/volunteer-links`, {
      method: "POST",
    });
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      setVolunteerUrl(data.url);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold">New Fundraiser</h1>
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <Section
        id="basics"
        number={1}
        title="Basics"
        summary={name || undefined}
        openSection={openSection}
        onOpen={setOpenSection}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="fr-name">Fundraiser name</Label>
            <Input
              id="fr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pupusa Sale — March 14"
            />
          </div>
          <div>
            <Label htmlFor="fr-desc">Description (optional)</Label>
            <Textarea
              id="fr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fr-ministry">Ministry</Label>
            <div className="flex gap-2">
              <select
                id="fr-ministry"
                className="h-10 flex-1 rounded-md border border-slate-200 px-3"
                value={ministryId}
                onChange={(e) => setMinistryId(e.target.value)}
              >
                <option value="">— none —</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Input
                className="flex-1"
                placeholder="…or type a new ministry"
                value={newMinistryName}
                onChange={(e) => {
                  setNewMinistryName(e.target.value);
                  if (e.target.value) setMinistryId("");
                }}
              />
            </div>
          </div>
          {kitchens.length > 1 && (
            <div>
              <Label htmlFor="fr-kitchen">Kitchen</Label>
              <select
                id="fr-kitchen"
                className="h-10 w-full rounded-md border border-slate-200 px-3"
                value={kitchenId}
                onChange={(e) => setKitchenId(e.target.value)}
              >
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="fr-closes">Orders close</Label>
            <Input
              id="fr-closes"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
          <Button onClick={() => setOpenSection("items")}>Next: Menu items</Button>
        </div>
      </Section>

      <Section
        id="items"
        number={2}
        title="Menu items"
        summary={
          items.filter((i) => i.name.trim()).length > 0
            ? `${items.filter((i) => i.name.trim()).length} items`
            : undefined
        }
        openSection={openSection}
        onOpen={setOpenSection}
      >
        <div className="space-y-4">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are append-only; entries have no stable id until saved
            <div key={index} className="rounded-lg border border-slate-200 p-3">
              <div className="flex gap-2">
                <Input
                  className="flex-[2]"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                />
                <Input
                  className="flex-1"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="$"
                  value={item.price ? (item.price / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    updateItem(index, { price: Math.round(Number(e.target.value) * 100) || 0 })
                  }
                />
                <Button variant="outline" onClick={() => addOptionGroup(index)}>
                  + Options
                </Button>
              </div>
              {item.modifierGroups.map((group, groupIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: groups are append-only; entries have no stable id until saved
                <div key={groupIndex} className="mt-2 rounded-md bg-slate-50 p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Option group (e.g. Filling)"
                      value={group.name}
                      onChange={(e) => updateGroup(index, groupIndex, { name: e.target.value })}
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={group.isRequired}
                        onChange={(e) =>
                          updateGroup(index, groupIndex, { isRequired: e.target.checked })
                        }
                      />
                      Required
                    </label>
                  </div>
                  <div className="mt-2 space-y-1">
                    {group.options.map((option, optIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: options are append-only; entries have no stable id until saved
                      <div key={optIndex} className="flex gap-2">
                        <Input
                          className="flex-[2]"
                          placeholder="Option (e.g. Queso)"
                          value={option.name}
                          onChange={(e) =>
                            updateGroup(index, groupIndex, {
                              options: group.options.map((o, i) =>
                                i === optIndex ? { ...o, name: e.target.value } : o,
                              ),
                            })
                          }
                        />
                        <Input
                          className="w-28"
                          type="number"
                          step="0.01"
                          placeholder="+$"
                          value={option.priceDelta ? (option.priceDelta / 100).toFixed(2) : ""}
                          onChange={(e) =>
                            updateGroup(index, groupIndex, {
                              options: group.options.map((o, i) =>
                                i === optIndex
                                  ? { ...o, priceDelta: Math.round(Number(e.target.value) * 100) || 0 }
                                  : o,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateGroup(index, groupIndex, {
                          options: [...group.options, { name: "", priceDelta: 0 }],
                        })
                      }
                    >
                      + option
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
            >
              + Add item
            </Button>
            <Button onClick={() => setOpenSection("delivery")}>Next: Delivery</Button>
          </div>
        </div>
      </Section>

      <Section
        id="delivery"
        number={3}
        title="Delivery & pickup"
        summary={minItemsForDelivery ? `delivery at ${minItemsForDelivery}+ items` : undefined}
        openSection={openSection}
        onOpen={setOpenSection}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="fr-min-items">Minimum items for delivery (blank = no rule)</Label>
            <Input
              id="fr-min-items"
              type="number"
              min="1"
              value={minItemsForDelivery}
              onChange={(e) => setMinItemsForDelivery(e.target.value)}
              placeholder="e.g. 3"
            />
            <p className="mt-1 text-sm text-slate-500">
              Orders below this count are pickup-only. Delivery zones and fees come from church
              settings.
            </p>
          </div>
          <Button onClick={() => setOpenSection("publish")}>Next: Review & publish</Button>
        </div>
      </Section>

      <Section
        id="publish"
        number={4}
        title="Review & publish"
        openSection={openSection}
        onOpen={setOpenSection}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{name || "Untitled"}</strong> · {items.filter((i) => i.name.trim()).length}{" "}
            items
            {minItemsForDelivery && ` · delivery at ${minItemsForDelivery}+ items`}
            {closesAt && ` · closes ${new Date(closesAt).toLocaleString()}`}
          </p>
          {!createdCatalogId ? (
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => void handleSaveDraft()}>
                Save draft
              </Button>
              <Button disabled={saving} onClick={() => void handlePublish()}>
                {saving ? "Publishing…" : "Publish now"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-emerald-50 p-4">
              <p className="font-medium text-emerald-800">Fundraiser is live 🎉</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void handleGenerateVolunteerLink()}>
                  Generate volunteer link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/fundraisers/${createdCatalogId}/take-orders`)}
                >
                  Take orders now
                </Button>
              </div>
              {volunteerUrl && (
                <div className="rounded-md bg-white p-3">
                  <p className="mb-1 text-sm font-medium">Text this link to your helpers:</p>
                  <code className="block break-all text-sm">{volunteerUrl}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
