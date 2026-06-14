"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
}

interface ModifierGroupRow {
  id: string;
  name: string;
  defaultMinSelections: number;
  defaultMaxSelections: number;
  defaultIsRequired: boolean;
  options: ModifierOption[];
  _count: { itemBindings: number };
}

interface ModifierGroupsManagerProps {
  groups: ModifierGroupRow[];
  churchId: string;
}

function rulesLabel(g: ModifierGroupRow): string {
  const { defaultMinSelections: min, defaultMaxSelections: max, defaultIsRequired: req } = g;
  const range = min === max ? `Pick ${max}` : `Pick ${min}–${max}`;
  return `${range} · ${req ? "required" : "optional"}`;
}

function formatDelta(cents: number): string {
  if (cents === 0) return "";
  const sign = cents > 0 ? "+" : "";
  return ` (${sign}$${(Math.abs(cents) / 100).toFixed(2)})`;
}

// ── Create Group Dialog ──────────────────────────────────────────────────────

interface CreateGroupDialogProps {
  churchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: ModifierGroupRow) => void;
}

function CreateGroupDialog({ churchId, open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/modifier-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchId,
          name: name.trim(),
          defaultMinSelections: Number.parseInt(min, 10) || 0,
          defaultMaxSelections: Number.parseInt(max, 10) || 1,
          defaultIsRequired: required,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create group");
      }

      const data = (await res.json()) as ModifierGroupRow;
      onCreated({ ...data, options: [], _count: { itemBindings: 0 } });
      setName("");
      setMin("0");
      setMax("1");
      setRequired(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Modifier Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="mg-name">Name</Label>
            <Input
              id="mg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Filling Choice"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mg-min">Min selections</Label>
              <Input
                id="mg-min"
                type="number"
                min="0"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mg-max">Max selections</Label>
              <Input
                id="mg-max"
                type="number"
                min="1"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="accent-emerald-600"
            />
            <span className="text-sm text-slate-700">Required</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Option Dialog ────────────────────────────────────────────────────────

interface AddOptionDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (groupId: string, option: ModifierOption) => void;
}

function AddOptionDialog({ groupId, open, onOpenChange, onAdded }: AddOptionDialogProps) {
  const [optionName, setOptionName] = useState("");
  const [priceStr, setPriceStr] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!optionName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/modifier-groups/${groupId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optionName.trim(),
          priceDelta: Math.round(Number.parseFloat(priceStr || "0") * 100),
          isDefault,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to add option");
      }

      const data = (await res.json()) as ModifierOption;
      onAdded(groupId, data);
      setOptionName("");
      setPriceStr("0");
      setIsDefault(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Option</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="opt-name">Option name</Label>
            <Input
              id="opt-name"
              value={optionName}
              onChange={(e) => setOptionName(e.target.value)}
              placeholder="e.g. Revuelta"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opt-price">Price delta (USD)</Label>
            <Input
              id="opt-price"
              type="number"
              step="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="accent-emerald-600"
            />
            <span className="text-sm text-slate-700">Default selection</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !optionName.trim()}>
              {saving ? "Adding…" : "Add option"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Group Row ────────────────────────────────────────────────────────────────

interface GroupRowProps {
  group: ModifierGroupRow;
  onDeleted: (groupId: string) => void;
  onOptionAdded: (groupId: string, option: ModifierOption) => void;
}

function GroupRow({ group, onDeleted, onOptionAdded }: GroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/modifier-groups/${group.id}`, { method: "DELETE" });
      onDeleted(group.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{rulesLabel(group)}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {group.options.length} {group.options.length === 1 ? "option" : "options"}
          </Badge>
          {group._count.itemBindings > 0 && (
            <Badge variant="outline" className="text-xs">
              {group._count.itemBindings} {group._count.itemBindings === 1 ? "item" : "items"}
            </Badge>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || group._count.itemBindings > 0}
            title={group._count.itemBindings > 0 ? "Remove from all items first" : "Delete group"}
            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Options list */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50">
          {group.options.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No options yet.</p>
          ) : (
            <ul className="space-y-1">
              {group.options.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <span>
                    {opt.name}
                    {opt.isDefault && (
                      <span className="ml-1.5 text-xs text-emerald-600 font-medium">default</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDelta(opt.priceDelta) || "free"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 h-7 px-2"
            onClick={() => setAddOptionOpen(true)}
          >
            <Plus size={12} className="mr-1" />
            Add option
          </Button>
        </div>
      )}

      <AddOptionDialog
        groupId={group.id}
        open={addOptionOpen}
        onOpenChange={setAddOptionOpen}
        onAdded={onOptionAdded}
      />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ModifierGroupsManager({
  groups: initialGroups,
  churchId,
}: ModifierGroupsManagerProps) {
  const [groups, setGroups] = useState<ModifierGroupRow[]>(initialGroups);
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreated(group: ModifierGroupRow) {
    setGroups((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleDeleted(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function handleOptionAdded(groupId: string, option: ModifierOption) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, options: [...g.options, option] };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Modifier Groups</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Define reusable choices attached to menu items.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
          <Plus size={15} />
          New group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-slate-500 text-sm">No modifier groups yet.</p>
          <p className="text-slate-400 text-xs mt-1">
            Create a group (e.g. "Filling Choice") then attach it to items.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" />
            Create first group
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onDeleted={handleDeleted}
              onOptionAdded={handleOptionAdded}
            />
          ))}
        </div>
      )}

      <CreateGroupDialog
        churchId={churchId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
