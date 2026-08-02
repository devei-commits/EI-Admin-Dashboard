# DEDUP_AUDIT — Mission 1 · Deliverable A (component de-duplication audit)

Read-only audit. **No refactor performed.** Awaiting approval before Deliverable B.

Scope walked: whole `src/` (ui, procurement, orders, masters, warehouse, production, planning, bd, enquiry, task, role, quality, pis, shell, auth, hooks, lib). ~115 component files in the surveyed areas; ~200 total incl. shared/hooks/lib. Note: much of Mission 2 (tokens, semantic status colors, focus rings, focus-trap, skeleton/empty/error, AA contrast) is **already done** by the P0–P5 design overhaul — this audit builds on that, not from scratch. App accent = blue `#0071e3`, fonts Montserrat/JetBrains Mono (the prompt's "teal / Space Grotesk" is a generic template — ignored).

---

## A. Concept → current implementations → proposed shared → est. impact

Ranked by impact (LOC removed + consistency).

| # | Concept | Current implementations (paths, importers) | Divergences | Proposed shared | Est. LOC saved |
|---|---|---|---|---|---|
| 1 | **Modal shell** | 5 shells: `procurement/ProcModalShell`(15), `ui/UnifiedComponents.UnifiedModal`(11), `orders/Modal`(8), `procurement/PrPopupShell`(3), `planning/PlanningModalShell`(1) — **PLUS ~40 inline modals** (Production 15, masters 9–16, warehouse ~6, bd 6, enquiry 6, quality 7, pis 12) each rebuilding backdrop/scroll/close. `pis/components/ui/dialog.tsx` = own Radix dialog. | light vs dark-gradient header; centered-title vs eyebrow; header primary-action (PrPopup); dismissable gating (Planning) | ONE `Modal` in `ui/` w/ slots (`header`/`body`/`footer`) + variants (`light|gradient`), built on existing `useFocusTrap`. Keep `ModalSection`/`Field`/`StatCell` helpers. | **~1,500+** (biggest single win) |
| 2 | **Masters near-dup family** | 4 typeaheads `Material/Rm/Pm/VendorClient` (~90% dup), `Rm/PmQualitySpecTable`(95%), `Rm/PmSchemaFieldRenderer`(95%), `Rm/PmMasterSectionContent`(80%) | RM vs PM = type params + labels only | Generic `Typeahead<T>`, `QualitySpecTable` (RM/PM as config), `SchemaFieldRenderer` (schema-driven), `MasterSectionContent` (config) | **~921** |
| 3 | **Nav sidebar** | 10 impls: `Sidebar`(main), `ProcurementSidebar`,`PlanningSidebar`,`FulfillmentSidebar`,`WarehouseSidebar`,`WarehouseInventorySidebar`,`bd/BDSidebar`,`QualitySidebar`, `Production`(inline), `pis/Sidebar`+`PISCodeSidebar` | 6–8 are ~verbatim (mobile header + collapse toggle + localStorage key + `sectionButtonClass`) | `NavSidebar` shell (sections slot + collapse persistence) + `useSidebarState()` | **~540** |
| 4 | **PIS `ui/` re-impls** | 16 primitives in `pis/components/ui/*` (dialog, table, select, dropdown, card, badge, button, tabs, input, alert…) ~1,127 LOC, Radix-based | **separate design system** (Radix + own tokens) vs main `ui/` | ⚠ FALSE-MERGE RISK — see §C. Likely migrate PIS onto main `ui/` gradually, drop Radix dup. | **~1,127** (if merged) |
| 5 | **Data table** | `ui/DataTable`(1 importer!), `ProcTableCard`+`ProcThead`(10+ via ProcSection), `orders/OrderTable`(1585 LOC monolith), `orders/BatchSplitTable`, masters `QualitySpecTable`+`VendorCommercialEditor` table, warehouse/prod/planning inline `<table>`, `pis/ui/table` | sticky header, 2-line cells, hover row-actions, rowspan groups vary | Converge on `ProcThead`/`ProcTableCard` (already the de-facto std) or promote `DataTable`; adopt across; kill inline theads | **~800+** |
| 6 | **Stat / KPI card** | `ui/StatCard`(14), `orders/KPICard`(12), `ProcStatCards`(in ProcSection, 10+) | icon tile vs plain; tone colors | ONE `StatCard` (icon optional, tone prop) | ~120 |
| 7 | **Status pill** | `ui/StatusBadge`(37), `orders/StatusBadge`(50 LOC, icon+FF/SO config), `Production` inline `Badge`, `pis/ui/badge` | icon variant + domain config = real requirement | `StatusBadge` w/ optional `icon`/config map (fold orders into it) | ~120 |
| 8 | **Filter bar + search** | `orders/FilterBar`(80), `ProcFilterBar`+`ProcSearch` (used by procurement + already reused by orders SO/Batches dashboards), `ui/SearchInput`(11) | chip taxonomy vs generic | Promote `ProcFilterBar`/`ProcSearch` to `ui/`; retire `orders/FilterBar` | ~120 |
| 9 | **Tabs / segmented** | `Production` inline `TabBar`, `warehouse/TransfersTabBar`, `ProcTabs`, `masters/MasterApprovalStatusTabs`, `ui/Segmented`(2) | underline vs pill vs count-badge | ONE `Tabs` (underline + optional counts) | ~150 |
| 10 | **Lifecycle stepper** | `warehouse/GrnReceiptStepper`(62), `Production` inline pipeline arrays, planning stage bars (lib) | horizontal vs vertical; count | `Stepper` (steps + orientation) | ~120 |
| 11 | **Progress / coverage bar** | inline `<div>` in warehouse/production/planning/PDS (many) | — | `ProgressBar` (value, tone) | ~150 |
| 12 | **File-upload row** | inline in warehouse (COA, photos), quality, production, masters | validity-date vs plain | `FileUploadRow` (accept, validity, onFile) | ~120 |
| 13 | **Toast** | `context/ToastContext` (main, 35 files) + `sonner` (pis only) | two APIs | Standardize on `ToastContext`; drop pis sonner | ~40 |
| 14 | **Layout wrapper** | `StandaloneModuleLayout`(66) + `SwipeableModuleLayout`(167) | swipe gesture | ONE `ModuleLayout` w/ optional `swipe` | ~120 |
| 15 | **Price / date format** | `.toLocaleString('en-IN')` inline ×15+ (orders, procurement, masters) | — | `utils/format.ts` → `formatINR`, `formatDate`, `formatQty` (some exist scattered) | ~80 |
| 16 | **Form field wrapper** | `ui/FormField`(6) exists but **underused**; inline `<label><input>` everywhere; `ProcModalShell.Field`; masters local `InputField/SelectField` | — | Adopt `FormField` app-wide | ~200 (adoption, not new) |
| 17 | **Missing composites (net-new)** | none shared: detail-sheet (summary rail + kv rows + tab strip), callout/banner, avatar cluster, document-header (PO/GRN/SO # + status + party), approval/sign-off block, batch/lot picker | — | build in `patterns/` | net-new |

**Rough total removable: ~4,000–6,000 LOC** (excl. PIS-merge and monolith extraction).

---

## B. Deliverable C preview — waste / dead code (evidence needed before deletion)

Candidates (must produce evidence-based manifest + your approval before removal — no inference deletes):
- **Dead pages (0 importers, confirmed earlier):** `src/pages/Warehouse.tsx`, `src/pages/WarehouseInventory.tsx` (routed page is `WarehousePage`).
- **Unused component:** `orders/StatusBadge` (0 importers — `ui/StatusBadge` used instead). Verify no dynamic import.
- Unused `ui/` exports where masters ignore the kit (after adoption).
- Commented-out blocks, `*_old`/`*_v2`/backup files (grep), stale feature flags.
- Orphaned assets / CSS with no matching selector.
- **Caution (do NOT auto-delete):** print/PDF templates (BMR/BPR/GrnLabelPreview) loaded at runtime, router/config-referenced files, entry points, pis Radix (if kept). These have purpose with few/zero static imports.

---

## C. False-merge cautions (keep separate, justified)

- **PIS mini-app `ui/` (Radix) vs main `ui/`** — different design system + provider. Merging is high-value (~1,127 LOC) but risky; recommend **phased migration**, not a big-bang merge. Could also legitimately stay separate if PIS is a distinct product surface.
- **`orders/StatusBadge` icon+FF/SO config** — real requirement, not drift → fold as a `StatusBadge` variant, don't drop the capability.
- **RM spec table vs PM PDS table** — may have genuinely different columns/semantics; verify before merging (prompt explicitly warns).
- **Print/PDF templates** — share tokens but keep their own layout (paper ≠ screen).

---

## D. Proposed library shape (Deliverable B, after approval)

```
components/ui/         primitives  — Modal, StatusBadge, StatCard, Tabs, ProgressBar,
                                     FileUploadRow, Callout, FormField, SearchInput,
                                     FilterBar, Skeleton/Empty/Error (done), Pagination (done)
components/patterns/   composites  — DataTable (ProcTable), DetailSheet, Wizard, NavSidebar,
                                     Stepper, DocumentHeader, ApprovalBlock, BatchPicker, Typeahead<T>
hooks/                 useDebounce(done), useFocusTrap(done), useSidebarState(new),
                       useCascadeSelect(new)
utils/format.ts        formatINR / formatDate / formatQty
```
Rules: composition over config (slots/children); shared must cover every current usage before deleting the old; **no behavior change in Mission 1** (pixel-parity, screenshot-compare per screen); divergences resolved only per this report.

---

## E. Recommended execution order (each gated)

1. **You approve this audit (A).**
2. Build primitives + `patterns/`; migrate **highest-impact first**: (1) Modal shell → (2) NavSidebar → (3) DataTable convergence → (4) Masters family → (5) Stat/StatusBadge/FilterBar/Tabs → (6) format utils + FormField adoption. Screenshot-compare per screen; delete old as covered.
3. Deliverable C: evidence-based deletion manifest → your approval → remove in small commits, build+routes-walk after each.
4. Mission 2: short design audit (most already satisfied by P0–P5) → confirm tokens doc → apply through the now-shared components.
5. (Separate, optional) extract Production.tsx (10k) + Planning.tsx (11.5k) monolith modals/rows into files — structural, not strictly dedup.

**Estimated scale: multi-session.** Recommend committing at every module boundary (per the earlier stash-loss incident).
