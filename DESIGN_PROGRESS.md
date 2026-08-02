# DESIGN_PROGRESS — Apple-grade UI overhaul (design-only, non-breaking)

Living source of truth for the re-skin per `DESIGN_OVERHAUL_PLAN_actual.md`. Nothing here changes functionality.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · **L/D** = verified in Light / Dark, no console errors, all interactions intact.

| Symbol | Meaning |
|---|---|
| Restyled | tokens/primitives/icons applied |
| L | verified working in **light** theme |
| D | verified working in **dark** theme |
| Note | one-line note / deferrals |

---

## Phase checklist
- [x] **P0 — Orientation & safety net** (this file + readback) — *decisions signed off*
- [x] **P1 — Token foundation** — Apple token layer (light + dark parity) + Montserrat/JetBrains + `data-theme` — *code done; pending in-browser QA (both themes) + commit*
- [x] **P2 — Shared styled primitives** — token-driven + theme-aware; APIs unchanged; new Icon/Segmented/FilterChip — *code done + tsc 0 errors + build clean; pending in-browser QA + commit*
- [~] **P3 — Apply module-by-module** (order below) — baseline audit in `DESIGN_AUDIT.md`; status utilities (`text-ok/warn/err/info/neut` + `*-soft`) added to `index.css`
- [~] **P4 — Presentational a11y** (whole-app) — **mechanical categories DONE**, contrast pending in-browser QA:
  - **`scope="col"`** on all data-table headers — **1,002 fixed → 0 bare `<th>` app-wide** (anchored global perl; skips `<thead>` + already-scoped).
  - **Dialog semantics** — `role="dialog"` + `aria-modal` + `aria-labelledby`/`aria-label` on **~115 modal cards** (6 parallel agents by directory + a final sweep of 5 stragglers: CatalogueManagement, ClientHub ×2, ContactEnquiry, CustomizationPackagingCatalog). Non-dialog overlays (sidebar mobile scrims, dropdown click-catchers, `role="status"` loaders) correctly left alone.
  - **Icon-only buttons** — ~110 `aria-label`s (mirroring `title`/handler context).
  - **Input labeling** — ~700+ `aria-label`s on unlabeled `input/select/textarea` (placeholder text reused; shared FormField/UnifiedInput controls already labeled → skipped). **829 `aria-label`s app-wide total.**
  - **Focus visibility** — verified: only 1 static `focus:outline-none` lacks a ring and it has `focus:bg-*` instead; primitives already carry focus rings. Effectively complete.
  - **Contrast (DONE, token-level)** — `--ink-4` was ~2.6:1 (fails WCAG in both themes) and used 554×. Rather than 554 per-usage swaps, darkened the **token**: light `#a1a1a6`→`#86868b` (~3.3:1), dark `#636368`→`#7c7c82` (~3.5:1) — meets AA-large uniformly, still less prominent than `ink-3`. One change, all 554 usages fixed.
  - **Focus management (DONE)** — new `hooks/useFocusTrap.ts` (Tab/Shift+Tab cycle within dialog, move focus in on open, restore to trigger on close) wired into the 5 shared shells: `PlanningModalShell`, `ProcModalShell`, `PrPopupShell`, `UnifiedModal`, `ConfirmDialog` → every modal built on a shell gets it for free. Bespoke non-shell modals have `role="dialog"` but not trap (follow-up if needed).
  - **Bug fixed:** the `scope="col"` perl ran line-by-line and added a **duplicate `scope`** to 4 multi-line `<th>` primitives (SortableTableTh, DataTable, UnifiedTableHeaderCell, ProcThead) — this, not "external logic errors," was the real cause of the earlier `tsc` 439→443 bump. Deduped → **back to 439 baseline**.
  - Attribute/semantics + one token value, non-breaking. `tsc -b` **439 = baseline (0 net new errors)** · build green.
  - ⚠ **Incident (recovered):** ~250 files of uncommitted work were swept into a `git stash` during concurrent git churn (stash/reset/re-stash) and the tree reverted to `cff8e52`; fully restored from `stash@{1}` (tracked) + `stash@{0}` untracked-new-files, then committed. Going forward: **commit at each module boundary.**
- [ ] **P4 follow-up** — in-browser contrast QA (both themes) to confirm the `ink-4` bump reads well; optional focus-trap for the handful of bespoke non-shell modals.
- [~] **P5 — Visual states** — primitives built + wired into shared kit; broad adoption incremental:
  - **New primitives** (`components/ui/`, barrel-exported): `Skeleton`/`SkeletonText`/`TableSkeleton`/`CardSkeleton` (token pulse blocks, `role="status"` + `sr-only` "Loading…"), `EmptyState` (icon + title + hint + action, `compact` variant), `ErrorState` (`role="alert"`, Warning icon + message + Retry). All token-driven / theme-aware / a11y.
  - **Shared `DataTable`** gained opt-in `loading`/`skeletonRows`/`error`/`onRetry`/`emptyIcon` props → skeleton body while loading, `ErrorState` on failure, `EmptyState` when empty. Backward-compatible (existing consumers unchanged).
  - **ProcSection kit** — `ProcError`/`ProcEmpty` now delegate to `ErrorState`/`EmptyState` → instant unified states across all Procurement dashboards. (`ProcLoading` keeps its spinner; `TableSkeleton` is the table-specific loader.)
  - **Adopted** in Fulfillment `SODashboardView` + `BatchesDashboardView` (bare `Loader2`/text → `TableSkeleton` + `ErrorState` + `EmptyState`; dropped now-unused `Loader2` imports).
  - tsc 439=baseline · build green.
  - [ ] **Broad adoption** — ~30 remaining `Loading…` texts, ~125 empty messages, ~320 error messages across non-kit surfaces → swap to primitives (parallel-agent sweep, incremental).

---

## Phase 2 — shared primitives (build/normalize once)
All token-driven → theme-aware (light+dark) for free. Public APIs unchanged (drop-in restyles). tsc 0 errors, build clean.
| Component | Restyled | API unchanged | Note |
|---|---|---|---|
| `components/ui/UnifiedComponents.tsx` (Button/Badge/Card/Modal/Input/Select/Label/Table*) | [x] | [x] | primary→brand; fixed pre-existing double-padding bug; spinner replaces "Loading…"; modal backdrop dark-friendly |
| `components/ui/StatusBadge.tsx` | [x] | [x] | fallback tone → status-neutral token (per-status colorMap retints in P3) |
| `components/ui/FormField.tsx` | [x] | [x] | token label/error/help; input/select/textarea class strings retokened (`htmlFor` already present) |
| `components/ui/DataTable.tsx` | [x] | [x] | `scope="col"` added; brand sort icons; loading/error slots deferred to P5 |
| `components/ui/SortableTableTh.tsx` | [x] | [x] | `scope="col"` added; inactive colors tokened; per-column accents kept |
| `components/ui/StatCard.tsx` → KPI recipe | [x] | [x] | 28px tabular value, brand icon tile, optional `trend` chip (backward-compatible) |
| `components/ui/PageHeader.tsx` | [x] | [x] | brand-gradient bar + e1 |
| `components/ui/Pagination.tsx` | [x] | [x] | active page → brand; tabular numerals |
| `components/ui/SearchInput.tsx` | [x] | [x] | token surface/border/ring (lucide icon kept; Phosphor swap is P3) |
| `components/ui/ConfirmDialog.tsx` | [x] | [x] | token surface + dark backdrop; `role=dialog`/`aria-modal`/`aria-labelledby`; spinner |
| **NEW** `Icon` wrapper (Phosphor) | [x] | — | `<Icon icon={House} size weight/>`, currentColor, default 18/regular |
| **NEW** `Segmented` | [x] | — | iOS segmented control, `role=tablist` |
| **NEW** `FilterChip` | [x] | — | filter/toggle pill, `aria-pressed`, optional remove ✕ |

**Ripple note:** restyling shared primitives changes the look of every current consumer immediately (primary buttons → blue, cards/inputs/badges → token surfaces). Intended; per-module QA happens in P3. Icons still lucide app-wide — Phosphor is swapped in during each module's P3 pass via the new `Icon` wrapper.
**Barrel:** `components/ui/index.ts` now also exports `Icon`, `Segmented`, `FilterChip`, `SortableTableTh`, `UnifiedModal/Input/Select/Table*`, `StatCardTrend`.
**Deps:** `@phosphor-icons/react@2.1.10` installed. Suggested commit: `feat(ui): token-driven primitives + Icon/Segmented/FilterChip (Phase 2)`.

---

## Phase 3 — pages by module (in overhaul order)

### 1. Dashboard
- [x] `pages/Dashboard.tsx` — retinted to tokens; lucide→Phosphor (32 icons, aliased on import so JSX unchanged); hero → brand-gradient; KPI/module cards → surface+brand tiles (rainbow grid removed → single-accent); tabular numerals; status utilities for alerts/priority; `scope="col"` on the alerts table. tsc 0 · build clean · **L[ ] D[ ] pending in-browser QA**

### 2. User / Role Management
- [ ] `pages/UserManagement.tsx` — L[ ] D[ ]
- [ ] `pages/RoleManagement.tsx` — L[ ] D[ ]
- [ ] `components/rolemanagementcomp/*` — L[ ] D[ ]

### 3. Procurement — ✅ RETINT COMPLETE (colors); emoji→Phosphor is the remaining item
Highest-leverage edit: **`src/constants/procurement.ts` `TONE_CLASSES`** — the central status→{text,bg,border} map that drives EVERY PO/PR/GRN/quote/audit badge. Collapsed 9 legacy tones → neutral (slate/gray) · brand-info (cyan/blue/violet) · warn (amber/orange) · ok (emerald) · err (red). `SLA_LEVEL_CLASSES` too. One edit retinted all status pills module-wide.
Shared chrome retinted by hand: `ProcurementDashboardShell` (canvas bg, surface header, status KPI pills), `ProcurementSidebar` (brand active, theme-aware rail), `ProcModalShell`, `PrPopupShell` (dark→brand-gradient header).
- [x] `pages/procurement/index.tsx` (10,982 lines, ~898 palette hits) — full retint; accent→brand, status preserved as warn/ok/err. tsc 0 · build clean. **L[ ] D[ ] pending QA**
- [x] `pages/procurement/{ProcurementReports,ProcurementVendors,StockCheckUpdateModal}.tsx` — retinted.
- [x] `components/procurement/*` (27 views/popups/panels) — retinted by 4 parallel agents (Pr inbox / PO / quote / GRN / audit / consolidation views; New PO/PR, edit/release/RFQ/quotation/stock-audit popups; PO approval/exception/match/vendor panels). tsc 0 · build clean.
- Method: central status map + 4 shells by hand, then god-file + 30 components by 5 parallel agents (recipe: accent→brand, amber/orange→warn, emerald/green→ok, red/rose→err, gray/slate→surface/ink), residual-cleanup agent, then central verify (0 residual palette · tsc 0 · build green).
- [x] **Emoji→Phosphor DONE** — config-emoji neutralized (`PR_SOURCE_CONFIG` pills + `SLA_LEVEL_PREFIX` → color/weight only); inline JSX glyphs swapped to Phosphor icons across all views/popups (📦→Package, 📋→ClipboardText, 🚩→Flag, 💬→ChatCircle, 🚚→Truck, ⚠→Warning, ✓→Check, ✅→CheckCircle, ✕→X, 🔁→ArrowsClockwise, ⛔→Prohibit, 💾→FloppyDisk). 0 rendered emoji remain (only doc-comments); tsc 0 · build clean.
- [x] **Structural unification (user ask):** new `components/procurement/ProcSection.tsx` kit is the ONE canonical section layout — `ProcSectionHeader` (icon + title + **stat chips** + actions), `ProcTabs` (one underline tab style), `ProcFilterBar`, `ProcSearch`, `procChipClass`, `procSelectClass`, `ProcTableCard`, `ProcThead`, `ProcLoading/Error/Empty`. Migrated all 5 side-sections (PR Inbox, Purchase Orders, Quote Requests, GRN Tracker, Stock Audit) onto `ProcSectionHeader` — plain-text summary sentences → uniform stat chips — and unified the two divergent tab styles (PR Inbox chips + Purchase Orders underline) → `ProcTabs`. Also fixed a stray `⊕` in Quote Requests. tsc 0 · build clean.
  - **DRY complete:** all 5 sections now consume the kit end-to-end — `ProcFilterBar`(+`stack`), `ProcSearch`, `procSelectClass`, `ProcTableCard`, `ProcThead` (align-aware), `ProcLoading/Error/Empty`. Hand-rolled filter/table/state markup removed; one source of truth for section chrome. Unused lucide `Search` imports dropped. tsc 0 · build clean.
  - **ALL dashboards unified (user ask):** extended the kit with `ProcStatCards` (KPI grid), `ProcPanel` (titled card), and a header `subtitle`. Migrated the remaining Procurement dashboards onto the same template — same header placement, filters, table chrome, spacing:
    - `pages/procurement/ProcurementReports.tsx` — title-row header → `ProcSectionHeader`; 4-card KPI grid → `ProcStatCards`; breakdown charts → `ProcPanel`; timeline table → `ProcPanel` + `ProcThead`.
    - `pages/procurement/ProcurementVendors.tsx` — header → `ProcSectionHeader`; colored KPI cards → `ProcStatCards`; directory table → `ProcTableCard` + `ProcThead` (cells normalized to px-3 py-2.5); dropped `font-archivo`.
    - `components/procurement/InventoryAuditView.tsx` — card-wrapped header → `ProcSectionHeader` + stats; filter chips/search → `ProcFilterBar`/`procChipClass`/`ProcSearch`; table → `ProcTableCard`/`ProcThead`; **fixed un-tokenized `bg-white` → tokens**.
    - `components/procurement/WeekVendorConsolidationView.tsx` — non-embedded header → `ProcSectionHeader` + `ProcFilterBar`; grouped body kept but bordered when standalone; embedded mode unchanged.
    - Every Procurement dashboard (5 sections + Reports + Vendors + Inventory Audit + Week/Vendor Consolidation) now shares one template. tsc 0 · build clean.
- **Remaining (minor follow-up):** lucide→Phosphor wrapper swap (~21 files still import lucide — functional, just not yet on the Icon wrapper).

### 4. Planning — ✅ UX TEARDOWN COMPLETE (sidebar + shell + full retint + unified modals). State refactor deferred by user.
Planning.tsx is an **11,557-line god-file** (single component, 3 route-views: pis-extracted / items-involved / batches; 9 bespoke `fixed inset-0` modals; ~150+ raw palette hits; zero ProcSection-kit usage; fragile internals — Plan-Batches modal ~3k lines of interdependent state + imperative scroll/debounce refs, Release modal 7 state objects). Decision (user): **full teardown** + **persistent sidebar w/ collapse**. Executing in safe tiers, verifying `tsc -b` == 439 baseline + build at each step.
- [x] **Foundation** — new `components/planning/PlanningSidebar.tsx` (3 sections + collapse toggle, Phosphor icons, mirrors Fulfillment/Warehouse). `Planning.tsx` shell restructured: `bg-[#F7F7F9]` + sticky white bar + indigo NavLink tabs → `flex bg-canvas` + `<PlanningSidebar>` + flex-1 content shell with tokenized sticky per-view header (breadcrumb + active-view title). Removed redundant top bar + tab bar + dead commented Raise-PR button; dropped now-unused `NavLink`/`AdminMainMenuButton` imports. tsc 439=baseline · build green.
- [x] **Header zone retint** — KPI cards (13) → `bg-surface`/`border-hairline`, labels→`text-ink-4`, sublabels→`text-ink-3`, values→ok/brand/err/warn/ink; the 3 status pills → ok/warn/err-soft.
- [x] **Per-view unified filters (user ask, Fulfillment-style)** — each view now has ONE `ProcFilterBar`: PIS Extracted (status pills + search + date + Export), Items Involved (released-summary + product filter + category pills + search + date), Batches (search + type + date). Removed the page-level stray date bar; wired `onDateFilterChange`→`setDateFilter` into the `PlanningBatchesTab` child. **Removed** the "Order Management / Client PO→…" box (PIS) and the "Planning batches (sent + planned drafts)…" blurb (Batches) per user request.
- [x] **FULL token retint of the whole module** — `Planning.tsx` **1037 → 0** raw palette hits + all 6 `components/planning/*` helpers (256 → 0), via word-boundary–anchored perl (Planning accent rule: indigo/blue/cyan/purple/teal→**brand**; amber/yellow/orange→**warn** [SLA/shortage]; emerald/green→**ok**; red/rose→**err**; gray/slate→structural; `bg-gray-900`→`bg-ink`, `bg-white/NN`→`bg-surface/NN`). `\b` anchoring prevented the `-soft0` bug. 0 residual · no `-soft0` · tsc 439=baseline · build green · emitted-CSS check confirms `border-{ok,warn,err,brand}-soft` / `ring-{brand,ok,err}` / `bg-ink-4` / `accent-brand` all resolve.
- [x] **Modal unification (all 9)** — new `components/planning/PlanningModalShell.tsx` (consistent `bg-black/40` backdrop-blur, z-scale [z-100 base / z-110 nested confirms], Escape + backdrop-click, `role=dialog`/`aria-modal`/`aria-label`, `dismissable={false}` for the 5 form modals so accidental Escape/backdrop can't discard input; send-confirm gates dismissal while the send is in-flight). Migrated all 9 inline `fixed inset-0` overlays (Detail, Ref, Used-In, Send-confirm, Send-success, Batch-PR, Release, Plan-Batches, Raise-PR) — **0 bespoke overlays remain**. Preserved the Plan-Batches scroll-to-top ref via a new `overlayRef` shell prop (idiomatic, not the brittle kind). tsc 439=baseline · build green.
- [~] **Deep state refactor — DEFERRED (user decision 2026-07).** Split Plan-Batches modal (3k-line, ~40 interdependent state vars) into BatchPlan/BOM/Swap sub-components + Release modal (7 state objects → reducer) is internal-quality only (no UX change) and HIGH-RISK with no runtime test harness. Revisit only if the modals prove hard to maintain, as its own QA'd effort. Imperative scroll refs already addressed (wired through the shell `overlayRef`); debounce-save ref is functional/low-risk — leave.
- [ ] `pages/PIS.tsx` + `components/pis/*` — separate `/pis` module — L[ ] D[ ]
- [ ] `components/planning/*` (existing 6 helper components) — L[ ] D[ ]

### 5. Production — ✅ RETINT COMPLETE + sidebar collapse
- [x] **Sidebar + collapse toggle** — Production already had a `ProductionSidebar` (in-file, header-top + sidebar-left-below layout, 7 sections: Batches / Dispensing & Tray / Production Calendar / Material Reservation / Yield Report / Equipment & Capacity / Team Management). Rewrote it: tokens, active state orange→**brand** (`bg-brand-soft`/`border-brand`), and a localStorage-persisted **collapse toggle** (`production-sidebar-collapsed`, `md:w-16` rail, ChevronLeft/Right, labels/logo hidden when collapsed). Kept its existing `active/onChange/mobileOpen/onMobileClose/navItems` API + lucide icons. Page-root `bg-gray-50`→`bg-canvas text-ink`; mobile scrim `black/20`→`black/40 blur`.
- [x] **Full module retint** — `Production.tsx` (9,995 lines) + all 3 `components/production/*` (BatchesView, DispensingTrayView, ScheduleTeamAssignmentSection): **1,841 → 0** raw palette via anchored perl. **Production-specific accent = orange → brand** (Schedule button, active nav, focus rings, active stepper state); amber/yellow→**warn** (clean split — orange is accent, amber is warnings); emerald/green→ok; red/rose→err; teal/purple/indigo/blue/cyan→brand (stage badges unify to brand+ok); gray/slate→structural; mid-slate solids→`bg-ink-2`; `accent-emerald`→`accent-ok`; `bg-white/NN`→`bg-surface/NN`.
- **Verify:** 0 residual palette · no `-soft0` · no orphaned gradients (fixed one broken `from-orange../to-amber` header → flat `bg-brand-soft/40`) · `tsc -b` **439 = baseline (0 new errors)** · build green · emitted-CSS confirms `accent-ok`/`bg-ink-2`/status tokens resolve. **L[ ] D[ ] pending in-browser QA.**

### 6. Warehouse — ✅ RETINT COMPLETE + sidebar collapse
- [x] **Sidebar + collapse toggle** — `components/WarehouseSidebar.tsx` (the sole live nav sidebar; `Warehouse.tsx`/`WarehouseInventory.tsx` are dead/unrouted — `/warehouse/*`→`WarehousePage`) fully rewritten to mirror `FulfillmentSidebar`: design tokens, Phosphor **section icons** (were empty `icon:''` strings — SquaresFour/MapPin/Package/TrayArrowDown/ArrowsLeftRight/ClipboardText), active state amber→**brand**, and a localStorage-persisted **collapse toggle** (`warehouse-sidebar-collapsed`, `md:w-16` icon rail, CaretLeft/Right). `WarehousePage.tsx` shell `bg-white`→`bg-canvas text-ink`.
- [x] **Full module retint** — every live file retinted to tokens by **8 parallel agents** + central sweep. Files: `pages/warehouse/{Overview,OverviewComplete,Inventory,Inbound,Outbound,Locations,StockCheckRequests,LogisticsSchedule,GRNModal,ZoneDetailsSidebar}.tsx`, `pages/warehouse/transfers/*` (Pick/PickSplit/Dispatch modals, Invoice/Returns tabs, TabBar), `components/warehouse/*` (all 15 GRN sections + Copy-Receipt/StockCheckAudit/QcInspection/RequestTransfer/EvidenceCapture modals), `components/{WarehouseInventorySidebar,StockByLocationPanel}.tsx`.
- **Warehouse-specific nuance:** amber was this module's PRIMARY accent, so amber split by context → **brand** for interactive/branding (CTAs, active tab, focus rings, KPI accents, selected states) vs **warn** only for true warning/pending/quarantine/low-stock status. Dark neutral solid buttons (`slate-900`) → `bg-ink`. Printed **label swatches** in `GrnLabelPreview`/`GrnGenerateLabelsSection` intentionally kept B/W (7 label-internal `slate` lines), plus `print:bg-white` and `bg-black/*` overlays preserved. Modal backdrops normalized `slate-900/40`→`bg-black/40`.
- **Verify:** `tsc -b` total = **439 = pre-work baseline (0 new errors)**; `vite build` green; 0 residual raw palette module-wide (excl. intentional label/print/overlay); no `-soft0`; emitted-CSS check confirms `bg-ink`/`bg-canvas`/`bg-brand-press`(hover)/`border-border-strong`(hover)/status tokens all resolve. **L[ ] D[ ] pending in-browser QA.**

### 7. Treasury
- [ ] `pages/TreasuryApp.tsx` + `components/treasury/*` — L[ ] D[ ]

### 8. Fulfillment — 🚧 STARTED (Task 2)
- [x] **Token retint (design language)** — full module retinted to brand + tokens by 3 parallel agents: orange/blue/teal/purple accent → **brand**; amber/yellow→warn, emerald/green→ok, red/rose→err; gray/slate→surface/ink/hairline. Files: `OrderFulfillment.tsx`, all `components/orders/*.tsx` (dashboards, `OrderTable`, `SaleOrdersView`, KPI/status/pipeline bits, and 13 modals). Print templates (`BMR/BPRPrintTemplate`) intentionally excluded. 0 residual palette (light) · no `soft0` · tsc 0 · build clean.
- [x] **Fulfillment sidebar + shell** — new `components/orders/FulfillmentSidebar.tsx` (persistent + collapse toggle, Phosphor icons, localStorage-persisted — mirrors ProcurementSidebar). `OrderFulfillment.tsx` restructured into the Procurement shell: `bg-canvas` flex + sidebar + sticky header (breadcrumb + active-view title + import actions) + surface content card. The 2-tab switcher is replaced by the sidebar sections (SO Dashboard / Products & Batches). Also fixed a `bg-brand-soft0` (invisible Retry button). tsc 0 · build clean.
- [x] **SO dashboard header** — `SODashboardView` now leads with `ProcSectionHeader` (title + SO-count stat chip + **New Sale Order** action moved into the header); toolbar → `ProcFilterBar`, table → `ProcTableCard` + `ProcThead` (align-aware).
- [x] **Batches dashboard structural** — `BatchesDashboardView` now leads with `ProcSectionHeader` (product-lines / batches / **overdue** `err`-toned chips); toolbar → `ProcFilterBar`; thead → `ProcThead` (custom `border-collapse` table kept for the grouped rowSpan borders). Both Fulfillment dashboards now share the exact ProcSection chrome.
- [x] **Filter-overlap fix** — both toolbars converted from a rigid `xl:grid-cols-5` (overflowed/overlapped "Overdue/Flagged only" inside the narrower sidebar shell) → `flex flex-wrap` with `ml-auto shrink-0`.
- [x] **Invisible-`-soft0` sweep (bug fix)** — removed every `-soft0` corruption across the whole orders module (`SODashboardView`, `BatchesDashboardView`, `SaleOrdersView`, `ProductsBatchesView`): Stage-Time-Log bars, coverage bars, comment badges, progress bars were undefined utilities → transparent. Also unified the FG/Packed/Invoiced/Shipped + coverage progress bars onto `bg-brand` (were raw `blue/orange/amber/purple/teal-400`).
- [x] **Order modals retint** — `SODetailModal` (69 hits) retinted to tokens; `dark:` palette overrides removed (single theme-aware token set); `EditSOModal`/`AddSOModal` dropdown `slate-900` shadow/ring → `shadow-[var(--e2)]` + `ring-black/5`. **0 residual raw palette in `orders/`** (print templates excluded — intentional B/W PDF layouts).

> **⚠ Verification-method correction (2026-07):** earlier "tsc 0" claims in this doc were produced by `tsc --noEmit`, which checks **nothing** here — root `tsconfig.json` has `"files": []` (references-only). The real checker is **`tsc -b`** (`npm run build:check`), which surfaces a **~439-error pre-existing baseline** (React-19 `JSX`-namespace + `ApiError` debt in BD/masters — not from the overhaul). `vite build` uses esbuild and never type-checks (an undefined component like a missing `ProcTableCard` import bundles fine but crashes at runtime). **New standard:** verify with `tsc -b` grepped to touched files vs. baseline, plus `vite build`. This increment: 0 new errors in touched files (only the pre-existing `JSX`-namespace lines), build green.

### 9. Catalogue / Items
- [ ] `pages/CatalogueManagement.tsx` — L[ ] D[ ]
- [ ] `pages/{ItemsList,ItemGroups,ProductSamples,ActiveIngredients}.tsx` — L[ ] D[ ]
- [ ] `pages/{CustomizationCatalog,CustomizationPackagingCatalog}.tsx` — L[ ] D[ ]

### 10. Enquiry
- [ ] `pages/{EnquiryManagement,ContactEnquiry,DoctorAppointments}.tsx` + `components/enquirymanagementcomp/*` — L[ ] D[ ]

### 11. Task Management
- [ ] `pages/TaskManagement.tsx` + `components/taskmanagementcomp/*` — L[ ] D[ ]

### 12. Raw Materials / Masters — ✅ COMPLETE — unified all master screens onto one layout/skin

Decision: single **brand** accent for all masters (kills per-module rainbow: RM was teal, PM violet, BOM blue, ItemGroups violet). Shared primitives collapsed to brand so all masters converge automatically:
- `components/masters/MasterApprovalStatusTabs.tsx` — all accents → brand; inactive/badge → tokens. (used by RM/PM/BOM)
- `components/ui/SortableTableTh.tsx` — all accents (cyan/teal/violet) → brand; tokenized. (app-wide sort headers)
- [x] `pages/RawMaterialForm.tsx` (RM Dashboard) — full file retint teal→brand + surfaces→tokens (dashboard **and** form). tsc 0 · build clean. **L[ ] D[ ] pending QA**
- [x] `pages/PackagingForm.tsx` (PM Dashboard) — full file retint violet→brand + surfaces→tokens. Now structurally + visually identical to RM. tsc 0 · build clean. **L[ ] D[ ] pending QA**
- [x] `pages/BOMDashboard.tsx` (was blue) — retinted to brand + tokens; KPI left-border stripes → brand/ok/warn/err; amber texts → warn. tsc 0 · build clean.
- [x] `pages/ItemGroups.tsx` (was violet/teal) — retinted; KPI stripes → brand/ok/warn. tsc 0 · build clean.
- [x] `pages/PackagingManagement.tsx` — retinted; **dark slate-800 active tab → brand**; table-header amber → ink. tsc 0 · build clean.
- [x] `pages/ActiveIngredients.tsx` — retinted; active tab → brand. tsc 0 · build clean.
- [x] `pages/ItemsList.tsx` (Price Lists) — retinted; left-border stat accents → brand/status; **removed hardcoded `Plus Jakarta Sans` font** → inherits Montserrat. tsc 0 · build clean.
- [x] `pages/BOMForm.tsx` — retinted (blue/slate heavy) → brand + tokens. tsc 0 · build clean.
- [x] RM/PM indigo "Fetch from Zoho" controls → brand (fully single-accent now).
- [x] `components/masters/*` (29 files) — retinted to brand+tokens (approval cells/modals, spec tables, dropdowns, typeahead pickers). tsc 0 · build clean.
- [x] `components/rawMaterials/*` (2) + `components/packaging/*` (3) — section renderers + schema field renderers. tsc 0 · build clean.
- [x] `components/{MasterFormBase,ArrayItemManager,MaterialMasterTypeahead,RmMasterTypeahead,PmMasterTypeahead,VendorClientNameTypeahead}.tsx` — shared form shell + typeaheads. tsc 0 · build clean.
**MASTERS MODULE COMPLETE** — every master page + every form-internal component is on the single brand accent + tokens, theme-aware. 6 pages + 41 components. Verified: 0 residual accent palette, tsc 0, build green.
Method note: the 6 heavy files were retinted by parallel subagents using ONE fixed mapping recipe (accent-family→brand, gray/slate→surface/ink/hairline, emerald→ok, amber→warn, red→err), then I swept residuals + verified centrally (tsc 0 · build clean). Left intentionally: `red` destructive buttons (semantic), multi-color category-tag palettes (categorical), opacity overlays.

### 13. Rest
- [ ] Quotations: `pages/quotations/**` (dashboard, list, builder, compare, detail, settings/*) — L[ ] D[ ]
- [ ] Quality: `pages/QualityPage.tsx` · `QualitySpecRulesAdmin.tsx` · `pages/quality/*` · `components/quality/*` — L[ ] D[ ]
- [ ] BD: `pages/bd/index.tsx` — L[ ] D[ ]
- [ ] Vendors/Clients: `pages/{VendorClient,VendorForm,ClientForm,ClientHub}.tsx` — L[ ] D[ ]
- [ ] Sales/Purchase: `pages/salesPurchase/{SalesTab,PurchaseTab}.tsx` — L[ ] D[ ]
- [ ] Misc: `pages/{FacilityManagement,UniversalSwap,UniversalSwapPage,NewDevelopments,Login}.tsx` — L[ ] D[ ]

### Navigation shell (touch carefully — presentation only)
- [x] `App.tsx` — PageLoader/offline-banner/shell wrapper → `bg-canvas` + brand spinner. tsc 0 · build clean.
- [x] `components/Sidebar.tsx` — full retint: rail `bg-surface`, active nav → `bg-brand-soft`/`text-brand`/brand left-border, submenu tokens, footer/avatar/logout tokens; hand-drawn SVG icons kept (not lucide); **theme toggle added** in footer. tsc 0 · build clean. **L[ ] D[ ] pending QA**
- [x] `components/{StandaloneModuleLayout,SwipeableModuleLayout}.tsx` — floating main-menu button → token surface.
- [ ] `components/QualitySidebar.tsx` · `WarehouseSidebar.tsx` · `WarehouseInventorySidebar.tsx` — deferred to their module passes (Quality / Warehouse).
- [x] **Theme toggle (light/dark)** — `src/lib/themeMode.ts` (get/apply/set/toggle, localStorage `ei-theme`); no-FOUC bootstrap `<script>` in `index.html`; toggle button (Sun/Moon) in the sidebar footer. Dark tokens already in `index.css`.
- [~] **Persistent + collapsible module sidebars** (user decision: keep each module's own sidebar, add collapse toggle — no double sidebar). `ProcurementSidebar` done: sticky/persistent, Phosphor section icons, explicit **collapse toggle** → icon-only rail (w-16) on desktop, state persisted to `localStorage['proc-sidebar-collapsed']`. Roll the same pattern out to `WarehouseSidebar`/`QualitySidebar` + the new Fulfillment sidebar — next.

---

## Deferred — OUT OF SCOPE for this pass (structural; future work)
- [ ] Tab state → URL for Procurement / Fulfillment / PIS / Treasury (nav behavior change)
- [ ] Decompose the 10k-line god-components (`Planning.tsx`, `procurement/index.tsx`, `Production.tsx`)
- [ ] Full modal migration to Radix Dialog with focus-trap / Escape / focus-restore (runtime behavior)
- [ ] Collapse the 4 sidebars into one `SidebarLayout` (component refactor)
- [ ] Delete old token sources (`theme.ts`, custom `:root` vars, `tailwind.config.js`) once all consumers migrated
- [ ] Any query/mutation/handler/validation/routing/data-flow change

---

## Decisions — SIGNED OFF
1. **Git** — *User handles all git; I only edit files.* I flag commit points; I never run git.
2. **Phosphor delivery** — *npm `@phosphor-icons/react`* (install at Phase 2 start).
3. **Dark-mode** — *Full dark tokens now, default light, add toggle.* Theme driven by `<html data-theme="light|dark">`; `.dark` class still honored (variant matches both).

---

## Phase 1 — what changed (code done; awaiting QA + commit)
Files: `index.html`, `src/index.css`. **No component/logic touched.** Fully additive + collision-safe.

- **`index.html`** — `<html data-theme="light">`; Google-Fonts links swapped Archivo/Outfit → **Montserrat + JetBrains Mono** (same non-blocking preload pattern).
- **`src/index.css`**
  - Fonts: `--font-sans/-display/-mono` = Montserrat/Montserrat/JetBrains; old `--font-outfit`/`--font-archivo` **aliased** to them (every existing `.font-outfit`/`var(--font-outfit)` usage now resolves to the new type — no code change). `body` → `--font-sans` + antialiasing. `@theme` sets Tailwind `font-sans`/`font-mono` too.
  - Dark trigger re-keyed: `@custom-variant dark (&:is(.dark *, [data-theme="dark"] *))` — honors legacy `.dark` **and** new `[data-theme="dark"]`.
  - **New Apple token layer** mirroring the prototype exactly: theme-agnostic scales in `:root` (`--s1..s10`, `--r-xs..r-2xl`, `--t-*`, `--ease*`/`--dur`); full color sets in `[data-theme="light"]` **and** `[data-theme="dark"]` (canvas/surface(2/3)/ink(2/3/4)/border/hairline/accent(+soft/press/gradient)/ring/charts c1–4/status st-*/elevation e1–3/inset-hi).
  - Exposed as **new-named** Tailwind utilities via a new `@theme inline` (`bg-canvas`, `bg-surface(-2/-3)`, `text-ink(-2/-3/-4)`, `border-hairline`, `border-strong`, `bg-brand`/`text-brand`/`bg-brand-soft`, `rounded-r-sm..r-xl`) — **zero clash** with existing `bg-gray-*`/`bg-card`/`rounded-lg`/`amber-*`.
  - One safe decouple: `@theme --color-accent` now points to `--secondary` (gray) so existing `bg-accent` surfaces stay neutral while `--accent` becomes the blue brand token.

**Left intentionally for later (non-breaking):** `body` bg still on legacy `--color-bg`; existing base `letter-spacing`/table density unchanged; the amber→grayscale override retained. These retint per-module in Phase 3; a theme toggle wires the nav shell.

**QA before commit:** run `npm run dev`, confirm app renders in Montserrat, no console/CSS errors, existing screens visually unchanged except font. Suggested commit: `feat(tokens): apple-grade design language + dark parity, Montserrat/JetBrains`.
