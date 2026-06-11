"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isDefault: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  defaultMinSelections: number;
  defaultMaxSelections: number;
  defaultIsRequired: boolean;
  options: ModifierOption[];
}

interface ItemModifierGroup {
  id: string;
  sortOrder: number;
  overrideMin: number | null;
  overrideMax: number | null;
  overrideIsRequired: boolean | null;
  group: ModifierGroup;
}

interface CatalogRef {
  id: string;
  name: string;
}

interface CatalogItemRef {
  id: string;
  catalog: CatalogRef;
}

interface ItemData {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number;
  imageUrl: string | null;
  status: string;
  catalogItems: CatalogItemRef[];
  modifierGroups: ItemModifierGroup[];
}

interface ItemEditPageProps {
  item: ItemData;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function displayToCents(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// ── Add Modifier Group Form ────────────────────────────────────────────────

interface AddGroupFormProps {
  itemId: string;
  onAdded: (binding: ItemModifierGroup) => void;
  onCancel: () => void;
}

function AddGroupForm({ itemId, onAdded, onCancel }: AddGroupFormProps) {
  const [name, setName] = useState("");
  const [required, setRequired] = useState(false);
  const [minSel, setMinSel] = useState("0");
  const [maxSel, setMaxSel] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/menu/items/${itemId}/modifier-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          required,
          minSelections: parseInt(minSel, 10),
          maxSelections: parseInt(maxSel, 10),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to add modifier group");
      }

      const data = await res.json() as { binding: ItemModifierGroup };
      onAdded(data.binding);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 space-y-3"
    >
      <p className="text-sm font-medium text-slate-700">New modifier group</p>

      <div className="space-y-1">
        <Label htmlFor="group-name">Group name</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Choose a size"
          required
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="space-y-1">
          <Label htmlFor="group-min">Min selections</Label>
          <select
            id="group-min"
            value={minSel}
            onChange={(e) => setMinSel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="group-max">Max selections</Label>
          <select
            id="group-max"
            value={maxSel}
            onChange={(e) => setMaxSel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-5">
          <Switch
            id="group-required"
            checked={required}
            onCheckedChange={setRequired}
          />
          <Label htmlFor="group-required">Required</Label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add group"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Add Option Form ────────────────────────────────────────────────────────

interface AddOptionFormProps {
  itemId: string;
  groupId: string;
  onAdded: (option: ModifierOption) => void;
  onCancel: () => void;
}

function AddOptionForm({ itemId, groupId, onAdded, onCancel }: AddOptionFormProps) {
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("0.00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/menu/items/${itemId}/modifier-groups/${groupId}/options`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            priceDelta: displayToCents(priceStr),
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to add option");
      }

      const data = await res.json() as { option: ModifierOption };
      onAdded(data.option);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor={`opt-name-${groupId}`} className="text-xs">
          Option name
        </Label>
        <Input
          id={`opt-name-${groupId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Large"
          required
          className="h-8 text-sm"
        />
      </div>
      <div className="w-24 space-y-1">
        <Label htmlFor={`opt-price-${groupId}`} className="text-xs">
          Price add-on
        </Label>
        <Input
          id={`opt-price-${groupId}`}
          type="number"
          min="0"
          step="0.01"
          value={priceStr}
          onChange={(e) => setPriceStr(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600 self-end pb-1">{error}</p>}
      <Button type="submit" size="sm" disabled={saving || !name.trim()}>
        {saving ? "…" : "Add"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onCancel}
        className="px-2"
      >
        <X size={14} />
      </Button>
    </form>
  );
}

// ── Modifier Group Card ────────────────────────────────────────────────────

interface ModifierGroupCardProps {
  itemId: string;
  binding: ItemModifierGroup;
  onGroupDeleted: (bindingId: string) => void;
  onOptionAdded: (bindingId: string, option: ModifierOption) => void;
  onOptionDeleted: (bindingId: string, optionId: string) => void;
}

function ModifierGroupCard({
  itemId,
  binding,
  onGroupDeleted,
  onOptionAdded,
  onOptionDeleted,
}: ModifierGroupCardProps) {
  const [showAddOption, setShowAddOption] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { group } = binding;
  const minSel = binding.overrideMin ?? group.defaultMinSelections;
  const maxSel = binding.overrideMax ?? group.defaultMaxSelections;
  const isRequired = binding.overrideIsRequired ?? group.defaultIsRequired;

  async function handleDeleteGroup() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/menu/items/${itemId}/modifier-groups/${binding.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete group");
      onGroupDeleted(binding.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleDeleteOption(optionId: string) {
    setDeletingOptionId(optionId);
    try {
      const res = await fetch(
        `/api/menu/items/${itemId}/modifier-groups/${binding.id}/options/${optionId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete option");
      onOptionDeleted(binding.id, optionId);
    } catch {
      // revert silently
    } finally {
      setDeletingOptionId(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      {/* Group header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{group.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isRequired ? "Required" : "Optional"} · {minSel}–{maxSel} selection
            {maxSel !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {confirmDelete ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={handleDeleteGroup}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
              onClick={handleDeleteGroup}
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* Options list */}
      <ul className="space-y-1">
        {group.options.map((opt) => (
          <li
            key={opt.id}
            className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-slate-50"
          >
            <span className="text-slate-700">{opt.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-xs">
                {opt.priceDelta > 0 ? `+${formatPrice(opt.priceDelta)}` : "Included"}
              </span>
              <button
                type="button"
                aria-label="Remove option"
                onClick={() => handleDeleteOption(opt.id)}
                disabled={deletingOptionId === opt.id}
                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <X size={13} />
              </button>
            </div>
          </li>
        ))}
        {group.options.length === 0 && (
          <p className="text-xs text-slate-400 px-2">No options yet.</p>
        )}
      </ul>

      {/* Add option */}
      {showAddOption ? (
        <AddOptionForm
          itemId={itemId}
          groupId={binding.id}
          onAdded={(opt) => {
            onOptionAdded(binding.id, opt);
            setShowAddOption(false);
          }}
          onCancel={() => setShowAddOption(false)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-slate-500 h-7 px-1"
          onClick={() => setShowAddOption(true)}
        >
          <Plus size={12} className="mr-1" />
          Add option
        </Button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ItemEditPage({ item }: ItemEditPageProps) {
  // ── Core item fields ──
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [priceStr, setPriceStr] = useState(centsToDisplay(item.defaultPrice));
  const [isActive, setIsActive] = useState(item.status === "ACTIVE");
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");

  // ── Modifier groups ──
  const [modifierGroups, setModifierGroups] = useState<ItemModifierGroup[]>(
    item.modifierGroups,
  );
  const [showAddGroup, setShowAddGroup] = useState(false);

  // ── Save state ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          defaultPrice: displayToCents(priceStr),
          status: isActive ? "ACTIVE" : "INACTIVE",
          imageUrl: imageUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to save item");
      }

      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function handleGroupAdded(binding: ItemModifierGroup) {
    setModifierGroups((prev) => [...prev, binding]);
    setShowAddGroup(false);
  }

  function handleGroupDeleted(bindingId: string) {
    setModifierGroups((prev) => prev.filter((b) => b.id !== bindingId));
  }

  function handleOptionAdded(bindingId: string, option: ModifierOption) {
    setModifierGroups((prev) =>
      prev.map((b) => {
        if (b.id !== bindingId) return b;
        return {
          ...b,
          group: { ...b.group, options: [...b.group.options, option] },
        };
      }),
    );
  }

  function handleOptionDeleted(bindingId: string, optionId: string) {
    setModifierGroups((prev) =>
      prev.map((b) => {
        if (b.id !== bindingId) return b;
        return {
          ...b,
          group: {
            ...b.group,
            options: b.group.options.filter((o) => o.id !== optionId),
          },
        };
      }),
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/menu">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <h2 className="text-base font-semibold text-slate-800 truncate max-w-xs">
            {name || "Untitled item"}
          </h2>
          <Badge
            variant={isActive ? "default" : "destructive"}
            className="text-xs shrink-0"
          >
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {item.catalogItems.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
            In:&nbsp;
            {item.catalogItems.map((ci, i) => (
              <span key={ci.id}>
                {i > 0 && ", "}
                <span className="text-slate-600">{ci.catalog.name}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSave}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ── Left column: core info ── */}
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4">
                  Item details
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="item-name">Name</Label>
                    <Input
                      id="item-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Item name"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="item-description">Description</Label>
                    <Textarea
                      id="item-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description…"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="item-price">Price (USD)</Label>
                    <Input
                      id="item-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceStr}
                      onChange={(e) => setPriceStr(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="item-active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <Label htmlFor="item-active">
                      {isActive ? "Active (visible to customers)" : "Inactive (hidden)"}
                    </Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="item-image">Image URL</Label>
                    <Input
                      id="item-image"
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    {imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="mt-2 h-40 w-full rounded-lg object-cover border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Save button + feedback */}
              {saveError && (
                <p className="text-sm text-red-600">{saveError}</p>
              )}
              {savedAt && !saveError && (
                <p className="text-sm text-green-600">
                  Saved at {savedAt.toLocaleTimeString()}
                </p>
              )}
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>

            {/* ── Right column: modifiers ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Modifier groups
                </h3>
                {!showAddGroup && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddGroup(true)}
                    className="flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Add group
                  </Button>
                )}
              </div>

              {modifierGroups.length === 0 && !showAddGroup && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                  <p className="text-sm text-slate-400">No modifier groups yet.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-slate-500"
                    onClick={() => setShowAddGroup(true)}
                  >
                    <Plus size={14} className="mr-1" />
                    Add first group
                  </Button>
                </div>
              )}

              {modifierGroups.map((binding) => (
                <ModifierGroupCard
                  key={binding.id}
                  itemId={item.id}
                  binding={binding}
                  onGroupDeleted={handleGroupDeleted}
                  onOptionAdded={handleOptionAdded}
                  onOptionDeleted={handleOptionDeleted}
                />
              ))}

              {showAddGroup && (
                <AddGroupForm
                  itemId={item.id}
                  onAdded={handleGroupAdded}
                  onCancel={() => setShowAddGroup(false)}
                />
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
