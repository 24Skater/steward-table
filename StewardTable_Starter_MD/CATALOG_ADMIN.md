# Steward Table — Catalog & Modifier Admin UX

The admin workflow for setting up a sale end-to-end. The screens where IAYO's volunteer admin sits down on a Tuesday afternoon and configures the upcoming Sunday pupusa sale.

## 1. Who this is for

- **STAFF / ADMIN / OWNER roles only.** COOK, DRIVER, VIEWER never see these screens.
- Volunteer admins, not engineers. Some technical comfort assumed; bilingual ability is common.
- Usually working on a laptop or a tablet, not a phone. Designs prioritize 1024px+ but work down to 768px.
- Setting up a recurring sale should take **under 15 minutes** end-to-end for an experienced admin.

## 2. Information architecture

Hybrid library + in-context creation (per §18). Three top-level library pages plus the catalog editor as the primary workflow surface.

**Top-level admin sidebar nav:**

```
Dashboard
Orders
Customers
Catalogs              ← list of all catalogs (DRAFT, OPEN, CLOSED, ARCHIVED)
Items                 ← all church items (the library)
Modifier groups       ← all modifier groups (the library)
Inventory
Reports
Settings
```

Library pages exist for hygiene (rename items, adjust default prices, edit translations once and propagate everywhere). Catalog editor is where most week-to-week work happens.

## 3. Catalogs index (`/admin/catalogs`)

Table view of all the church's catalogs:

| Column | Notes |
|---|---|
| Name | Click to open editor |
| Status | DRAFT / OPEN / CLOSED / ARCHIVED, color-coded |
| Window | "Opens Sun Jun 8, 12pm · Closes 6pm" or "No schedule" |
| Items | Count |
| Orders | Count of orders attached |
| Revenue | Total once at least CONFIRMED |

Top of the page:

- **`+ New Catalog`** button — opens a three-option dialog (see §6)
- Filter: by status, by date range
- Search by name

## 4. Items library (`/admin/items`)

Table of every item the church has, paginated. Editable inline where it's safe (default price), opens the full item editor for everything else.

| Column | Notes |
|---|---|
| Photo | 40×40 thumbnail |
| Name | English (with ES badge if Spanish present) |
| Default price | Inline editable |
| Tax category | Inline editable |
| Modifier groups | Count, click to view |
| Used in | Comma list of catalogs referencing this item |
| Status | ACTIVE / INACTIVE toggle |

Top of page:

- **`+ New Item`** button — opens item editor
- Bulk actions (when rows are selected): set price (fixed or percentage), set tax category, archive, delete
- Filter: by status, by modifier group attached, by translations missing
- Search by name (EN or ES)

A persistent banner at the top if any items are missing Spanish translations: "**3 items missing Spanish translations.** Open the items missing translations →"

## 5. Modifier groups library (`/admin/modifier-groups`)

Table of every modifier group:

| Column | Notes |
|---|---|
| Name | English |
| Default rules | "Pick 1 (required)" / "Pick 1–3 (optional)" — readable shorthand |
| Options | Count, click to view |
| Used by | Comma list of items referencing this group |

Same translation badge + bulk-action surface as items.

## 6. Creating a catalog (the three-entry-point flow)

When admin hits **`+ New Catalog`**, a dialog presents three paths:

```
┌──────────────────────────────────────────────────────────┐
│  Start a new catalog                                     │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │  Start blank   │  │ Clone existing │  │  From a    │  │
│  │                │  │                │  │  template  │  │
│  │  Build from    │  │  Copy a past   │  │            │  │
│  │  scratch.      │  │  catalog and   │  │  Pupusa    │  │
│  │                │  │  edit.         │  │  Sale,     │  │
│  │                │  │                │  │  Bake Sale,│  │
│  │                │  │                │  │  …         │  │
│  └────────────────┘  └────────────────┘  └────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **Blank**: prompts for name + slug + open/close window, creates an empty catalog, opens the editor.
- **Clone**: shows a list of the church's prior catalogs (most recent first), admin picks one. New catalog inherits items, modifier groups, sort order, price overrides, capacity caps. Slug and dates are blanked; admin sets new ones.
- **Template**: shows the four bundled templates as cards (with previews of items and modifier groups). Admin picks one; the template's items, modifier groups, and modifier options are **materialized** as real church-scoped DB records (so the church can edit them freely), and a new catalog is created with all of them attached.

## 7. The catalog editor

Single-page editor with anchored section navigation (sticky left-side TOC). No tabs, no wizard — the admin can see the whole sale at a glance and jump to any section.

```
┌─────────────┬────────────────────────────────────────────────┐
│ JUMP TO     │  Catalog: Pupusa Sale — June 8, 2026           │
│             │                                                │
│ • Basics    │  ┌──────────────────────────────────────────┐  │
│ • Items     │  │ BASICS                                   │  │
│ • Modifiers │  │ Name (EN | ES tabs)                      │  │
│ • Settings  │  │ Slug: pupusa-sale-june-8-2026            │  │
│ • Preview   │  │ Description (EN | ES tabs)               │  │
│             │  │ Status: DRAFT  [Publish]                 │  │
│             │  │ Window: Opens [date/time]                │  │
│             │  │         Closes [date/time]               │  │
│             │  └──────────────────────────────────────────┘  │
│             │                                                │
│             │  ┌──────────────────────────────────────────┐  │
│             │  │ ITEMS                          + Add     │  │
│             │  │ ┌─────────────────────────────────────┐  │  │
│             │  │ │ ⋮⋮ 📸  Pupusa Revuelta              │  │  │
│             │  │ │      $3.00  · Filling: pick 1      │  │  │
│             │  │ │      Override price: [3.00]        │  │  │
│             │  │ │      Max per order: [_____]        │  │  │
│             │  │ │      ☑ Available                   │  │  │
│             │  │ └─────────────────────────────────────┘  │  │
│             │  │ ┌─────────────────────────────────────┐  │  │
│             │  │ │ ⋮⋮ 📸  Curtido                      │  │  │
│             │  │ │ …                                   │  │  │
│             │  │ └─────────────────────────────────────┘  │  │
│             │  └──────────────────────────────────────────┘  │
│             │                                                │
│             │  ┌──────────────────────────────────────────┐  │
│             │  │ MODIFIERS USED                           │  │
│             │  │ Pupusa Filling · pick 1, required        │  │
│             │  │ Side Choice · pick 0–2                   │  │
│             │  │ ↳ used by: Pupusa Revuelta, Queso, …     │  │
│             │  └──────────────────────────────────────────┘  │
│             │                                                │
│             │  ┌──────────────────────────────────────────┐  │
│             │  │ SETTINGS                                 │  │
│             │  │ Tax: STRIPE_TAX                          │  │
│             │  │ (links to global Tax settings)           │  │
│             │  └──────────────────────────────────────────┘  │
│             │                                                │
│             │  ┌──────────────────────────────────────────┐  │
│             │  │ PREVIEW                                  │  │
│             │  │ [Mobile-frame storefront preview]        │  │
│             │  └──────────────────────────────────────────┘  │
└─────────────┴────────────────────────────────────────────────┘
```

**Items section:**
- Each `CatalogItem` row shows the item with its per-catalog overrides (price, availability, sort order, max-per-order).
- Drag handle (⋮⋮) on left for reordering (@dnd-kit-based, keyboard-accessible with arrow buttons as fallback).
- **`+ Add`** button at top opens a picker: search the library, or **`+ Create new item`** at the bottom (which opens the item editor inline — saves create the item in the library AND attach to this catalog).
- Per-row: click anywhere on the item header opens the full item editor in a side panel; clicking on inline fields (price override, max per order, availability checkbox) edits in place.

**Modifiers used section:**
- Read-only summary of modifier groups used by items in this catalog. Click a group to jump to the modifier-group editor.
- Modifier groups aren't "attached to catalogs" — they're attached to items. This section just summarizes what's in play.

## 8. Item editor

Opened in a slide-in side panel (so the admin doesn't lose catalog context) or as a full page from the library.

**Sections (top to bottom):**

```
1. Basics
   - Photo (drag-drop, file picker, or URL paste)
   - Name [EN | ES tabs]
   - Description [EN | ES tabs]
   - Default price
   - Tax category (dropdown of church-defined categories + Steward defaults)
   - Status (ACTIVE / INACTIVE)
   - Station (optional — v2 seam, hidden in v1 UI unless feature flag on)

2. Modifier groups
   - List of attached groups, drag-reorderable
   - Each row shows the resolved rules (default + any per-item override)
   - "Edit overrides" inline panel to set this item's overrideMin / overrideMax / overrideIsRequired
   - + Attach group: picker from library, or + Create new group

3. Inventory link (if InventoryItem exists for this Item)
   - Quantity on hand (read-only here; adjusted via Inventory page)
   - Low-stock threshold (editable here)
   - Tracking enabled (toggle)

4. Where used
   - List of catalogs referencing this item; click to open
```

**Save behavior:** debounced auto-save on field blur (3-second debounce). Toast confirms save success. No "Save" button — the catalog editor itself only commits attachments and overrides explicitly.

## 9. Modifier group editor

Opened in a slide-in panel or full page.

```
1. Basics
   - Name [EN | ES tabs]

2. Rules (defaults — overridable per-item via ItemModifierGroup)
   - Default min selections (number)
   - Default max selections (number)
   - Default required (checkbox)

3. Options
   - List of ModifierOption rows, drag-reorderable
   - Each: Name [EN|ES tabs], price delta, default selection checkbox
   - + Add option

4. Used by
   - List of items attached to this group
```

## 10. Bilingual editing pattern

Every translatable field has a small tab control above the input:

```
┌─────────────────────────────────┐
│ Name                            │
│ ┌─────────┬─────────┐           │
│ │ English │ Español │ ●         │ ← yellow dot indicates ES missing
│ └─────────┴─────────┘           │
│ ┌─────────────────────────────┐ │
│ │ Pupusa Revuelta             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Switching tabs preserves unsaved input. The yellow dot is a global signal: any time it's present, an ES field has not been filled. Catalog and library pages aggregate this into a banner ("3 items missing Spanish translations").

Saving is never blocked by missing translations.

The catalog DRAFT → OPEN transition shows a warning dialog if items in the catalog are missing ES, but the admin can confirm and proceed. Some churches will intentionally run EN-only catalogs.

## 11. Image upload

For ItemPhoto. Three input methods, all supported:

- **Drag-drop** a file onto the photo area
- **Click** the photo area to open the file picker
- **Paste a URL** in a text field below (Steward downloads, validates, stores)

Once uploaded, image is uploaded to the configured S3-compatible storage (`packages/storage` adapter), resized to standard variants (thumbnail 80×80, card 400×400, detail 1200×1200), and stored as a single `ItemPhoto` row with the canonical URL pointing to the original. Variants are derived from the canonical URL at render time via image CDN (or runtime resizing for self-host).

Drag-drop and file picker show a progress indicator and an upload-failed retry. URL paste shows a "validating…" state while the URL is fetched and processed.

## 12. Bulk operations

On the Items library page, selecting multiple rows reveals a bulk-action bar at the bottom of the screen:

- **Set price**: dialog with two modes — set to a fixed value, or adjust by percentage (`+10%`, `-5%`)
- **Set tax category**: dropdown applied to all selected
- **Set status**: toggle ACTIVE / INACTIVE
- **Archive** (soft-delete)
- **Delete** (only available for items not used in any catalog)

Bulk price changes don't affect orders already placed (snapshots persist) or in-progress carts (each cart locks prices at submit). They affect what new orders pay.

## 13. Publishing flow

In the catalog editor, the **Publish** button:

1. Validates: catalog has at least one item available, name is set, slug is set.
2. If catalog has items missing Spanish translations, shows a warning dialog with the count: "3 items in this catalog are missing Spanish translations. Customers viewing in Spanish will see the English name as a fallback. Publish anyway?"
3. If no warnings, single confirmation: "Publish *Pupusa Sale — June 8, 2026*? Customers will be able to place orders at the open time."
4. On confirm: status → OPEN, audit log entry, scheduled job confirms the open window, storefront URL `{slug}.table.steward.app/c/pupusa-sale-june-8-2026` becomes live (or just `{slug}.table.steward.app` if it's the only OPEN catalog at the moment).

Once OPEN, key fields become soft-locked: name, slug, modifier-group rules can't change without first closing (or admin override with a warning). Items can be added or marked unavailable; prices can change but it warns "live orders use the price at submit time."

Closing a catalog (OPEN → CLOSED) is a single tap; orders already placed continue their lifecycle normally.

## 14. Empty states

- **First-time church, no items yet:** Items library shows: "No items yet. Create your first item, or start a catalog from a template to get going." Two CTAs: `+ New Item` and `Use a template`.
- **First-time church, no catalogs:** Catalogs index shows: "No catalogs yet. Build your first sale to get started." CTA: `+ New Catalog`.
- **Items library empty after a search:** "No items match 'xxx'. Try a different search." with a link to clear filters.

## 15. Curated templates (v1 bundled)

Each template ships in `lib/catalog-templates/` as a TypeScript module returning a structured payload. Templates are bilingual (EN canonical, ES native-reviewed for Pupusa Sale; LLM-drafted + reviewed for the others).

**v1 templates:**

1. **Pupusa Sale** (canonical, IAYO-modeled)
   - Items: Pupusa Revuelta, Queso, Frijol, Chicharrón; Curtido; Atol de elote, Atol de piña; sodas
   - ModifierGroups: Pupusa Filling (4 options), Side Choice (curtido + atoles)
2. **Bake Sale**
   - Items: Cookies, brownies, cupcakes, pie slices, whole pies (preorder)
   - ModifierGroups: Cookie Variety, Pie Flavor
3. **Coffee Hour**
   - Items: Coffee (regular / decaf), Tea, Pastries (assortment), Donuts
   - ModifierGroups: Coffee Style, Milk Choice
4. **Fundraiser Dinner** (ticketed)
   - Items: Adult Ticket, Child Ticket, Dietary-restriction Ticket
   - ModifierGroups: Main Course (chicken, fish, vegetarian), Dessert Choice

Each template's items, modifier groups, and options materialize as **real church-owned DB rows** on template selection — they become editable, deletable, renameable. Templates are starting points, not constraints.

## 16. Implementation notes

- Routes: `/admin/catalogs`, `/admin/catalogs/[id]`, `/admin/items`, `/admin/items/[id]`, `/admin/modifier-groups`, `/admin/modifier-groups/[id]`.
- Components live in `app/(dashboard)/admin/` with shared primitives in `components/catalog/`.
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (touch-friendly, keyboard accessible).
- Inline editing via controlled inputs with debounced auto-save (3s); explicit Save button only for structural operations (publish, status changes).
- Optimistic UI for all mutations; rollback + toast on failure.
- Slide-in side panels via `<Sheet>` from shadcn/ui.

## 17. Out of scope for v1

- **Item categories** — explicit category model for grouping items in storefront sections. v1 uses sort order only; v2 introduces a `Category` model and storefront section headers.
- **Item variants** (size / large vs small) — modeled as separate items in v1 (Pupusa Small, Pupusa Large). v2 may add a variant abstraction.
- **Photo galleries** — multiple photos per item in v1 via `ItemPhoto`, but UI shows just one (the primary). Carousel in storefront is v2.
- **Approval workflow** — STAFF proposes changes, ADMIN approves before publish. Useful at large churches; not v1.
- **A/B pricing** — same item at different prices for different customer segments. Not needed.
- **Import / export** — bulk CSV import of items, CSV export. v2.
- **Versioning UI** — see who changed what when (the audit log captures this, but a friendly diff view is v2).
- **Multi-station UI** in catalog editor — station field on Item exists as a schema seam but is hidden in v1 UI.
