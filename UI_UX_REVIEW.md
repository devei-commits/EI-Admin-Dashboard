# UI/UX Audit — EI-Admin-Dashboard

**Audited:** 2026-07-30 · **Scope:** frontend only (`EI-Admin-Dashboard`, 227k LOC, 86 pages + 232 components). Backend excluded.
**Stack (from `package.json`):** React 19 · Vite · Tailwind v4 · TanStack Query v5 · Radix UI · CVA + clsx + tailwind-merge · lucide-react · recharts · React Router v7.
**Product intent (confirmed):** desktop-first **internal operations ERP** — planners, procurement, production, warehouse, admins. Not customer-facing; density & speed matter more than delight.
**Stated pain (confirmed, drives weighting):** visual inconsistency · slow/janky feel · users get lost · maintainability · *"the design language itself is bad"* (reference design language to be provided).
**Constraints:** ship incrementally · no new dependencies · design-system changes need sign-off · reduce duplication · **goal = one unified design language + shared components everywhere.**
**A11y bar:** none formal → audited against **WCAG 2.2 AA**.

> Convention: **FACT** = what the code does (cited) · **JUDGMENT** = what's wrong · **ASSUMPTION** = inferred intent. Everything cites `path:line`.

---

## Executive Summary

**Overall UI/UX score: 3 / 10** (weighted toward your stated concerns).

The app is not missing a design system — it has **three or four competing ones** and **uses none of them (~10% adoption)**, while 82 screens hand-roll their own modals and three pages exceed **10,000 lines each**. The result is exactly the four things bugging you: visual chaos, jank, lost-in-flow, and near-un-maintainable code — all traceable to the same root cause: **no enforced shared foundation.**

### The 5 things dragging it down most
1. **No design system in practice.** 3–4 conflicting token sources, and the brand color is defined three contradictory ways (`theme.ts:6` says "Amber/Orange", `theme.ts:12` uses `slate-800`, `index.css:28` uses zinc-950). Only **31 of 318** files import `components/ui`; only **6** `var(--token)` references exist in components. → *drags: DS health, visual, maintainability.*
2. **Three 10k-line god-components** (`Planning.tsx` 11,557 · `procurement/index.tsx` 10,982 · `Production.tsx` 9,995) with **0 `React.memo`, 0 virtualization**, 90–157 `useState` each. → *drags: maintainability, perf.*
3. **147 hand-rolled modals across 82 files** (vs 7 using the accessible Radix Dialog already installed) — no focus trap, ESC, or `aria-modal`. WCAG blocker + massive duplication. → *drags: a11y, visual, maintainability.*
4. **Navigation is three incompatible paradigms.** Procurement/Fulfillment/PIS/Treasury keep tab state in component state, so **the browser Back button exits the module and deep-links/refresh lose state**; **breadcrumbs exist on 9 pages only**. → *drags: lost-in-flow.*
5. **No perceived-performance hygiene.** No skeletons anywhere, text-only loaders, chained `useMemo` waterfalls, `useQueries` returning fresh arrays, 100+ row tables un-virtualized → visible flash-in and re-render storms. → *drags: jank.*

### Single highest-leverage next step
**Build one accessible `<Modal>` (wrap the already-installed Radix Dialog) and one `<Button>`, then codemod the 147 ad-hoc modals and the raw button markup onto them.** This is the rare move that fixes an **a11y blocker**, **visual consistency**, and **duplication** simultaneously, is shippable incrementally, needs no new deps, and doesn't require the (pending) visual redesign to start.

---

## Phase 2 — Scorecard

| # | Dimension | Score | One-line justification |
|---|---|---|---|
| 1 | Design-system health | **2/10** | Foundation exists but bypassed; 3–4 token sources; ~10% adoption; contradictory brand color (`theme.ts:6` vs `:12` vs `index.css:28`). |
| 2 | Visual design & consistency | **3/10** | Two neutral palettes (gray 8,000+ vs slate 5,000+ usages), 6 radii / 8 shadow levels, per-module bespoke dashboards; you rate the language itself bad. |
| 3 | Component architecture | **2/10** | 10k-line god-components, 0 memo, 4 near-duplicate sidebars (60% dup), 4 typeaheads, dead code. |
| 4 | Accessibility (WCAG 2.2 AA) | **3/10** | 147 inaccessible modals, ~901 low-contrast + ~4,600 sub-12px text, icon buttons w/o names, 218/226 tables w/o `scope`. Some good spots (FormField, Radix where used). |
| 5 | Interaction & feedback | **4/10** | States exist but ad-hoc per screen; **no skeletons**, text-only loaders, silent success, no per-section error boundaries. |
| 6 | Responsiveness & cross-device | **4/10** | Desktop-first is fine, but **95 forced-scroll `min-w-[…px]` tables**, sub-44px touch targets, swipe layout on 1 module only. |
| 7 | Information architecture & flow | **3/10** | Broken Back/deep-link in Procurement/Fulfillment/PIS/Treasury; breadcrumbs on 9 pages; 3–4-level nested modals; no unsaved-changes guard. |
| 8 | Content & microcopy | **6/10** | Error toasts mostly clear/actionable (`Add at least one line.`), but inconsistent verbs ("could not"/"failed") and many lists lack empty-state copy. |
| 9 | Perceived performance | **3/10** | God-component re-render storms, `useMemo` waterfalls, no virtualization/skeletons; 500KB+ source pages. |

**Overall (weighted): 3 / 10.**

---

## Phase 1 — Findings by dimension

### 1. Design-system health — 2/10

**FACT — multiple competing token sources:**
- Custom CSS tokens (`--color-primary: #09090b`, `--color-bg`, `--color-text`, `--color-border`, `--radius: .75rem`) — `src/index.css:26-69`.
- shadcn `@theme inline` tokens (`--color-card`, `--color-muted`, `--radius-sm/md/lg/xl`, chart/sidebar colors) — `src/index.css:80-113`.
- A JS "design system" of Tailwind **class strings** (`COLORS`, `SPACING`, `TYPOGRAPHY`, `BUTTON_VARIANTS`, `BADGE_VARIANTS`, `CARD_VARIANTS`, `MODAL_VARIANTS`, `INPUT_VARIANTS`) — `src/components/ui/theme.ts:7-176`.
- `tailwind.config.js` (repo root) — a 4th config surface (Tailwind v4 typically needs none).

**FACT — the "single source of truth" contradicts itself:** `theme.ts:2` "Single source of truth", `theme.ts:6` "**Amber/Orange Theme**", yet `theme.ts:9-15` sets `primary` to `bg-slate-800`, and `index.css:28` sets `--color-primary: #09090b` (zinc-950). Three different answers to "what is the brand color." `theme.ts:133` also ships a dead hover (`bg-slate-800 hover:bg-slate-800`).

**FACT — near-zero adoption:** only **31/318** page+component files import from `components/ui`; components contain only **6** `var(--token)` references and **202** token-class usages (`bg-primary`/`bg-card`/…) versus **20,000+** raw-palette usages. Even the primitives bypass tokens (`StatusBadge.tsx` uses `bg-gray-100`/`text-gray-600`).

**JUDGMENT:** Tokens are decorative. There is effectively no enforced system, so every screen re-derives its look. This is the taproot of dimensions 2, 3, and 4.

**Problems:** `Critical` — 4 token sources + contradictory brand color; `Critical` — ~10% primitive adoption; `High` — 2,257 arbitrary `[..]` magic values, 28 inline-`style` files.

**10/10 here:** one token layer (the `@theme` block), one brand color signed off, `theme.ts`/duplicate `:root`/`tailwind.config.js` deleted, primitives token-based, lint rule banning raw hex + off-token palette in new code.

---

### 2. Visual design & consistency — 3/10

**FACT — two neutral palettes used interchangeably:** `text-gray` ×4,769 vs `text-slate` ×2,814; `border-gray` ×1,903 vs `border-slate` ×1,176; `bg-gray` ×1,340 vs `bg-slate` ×957. Modules picked different neutrals.
**FACT — no radius/elevation rhythm:** radii in the wild — `rounded-lg` ×2,338, `rounded` ×703, `rounded-full` ×550, `rounded-xl` ×496, `rounded-md` ×257, `rounded-2xl` ×90; shadows — `shadow-sm` ×334, `shadow-lg` ×89, `shadow-md` ×85, `shadow-2xl` ×70, `shadow-xl` ×59, `shadow` ×43. Cards/modals mix `rounded-lg`/`rounded-xl`/`rounded-2xl` and `shadow-sm`…`shadow-2xl` with no elevation logic.
**FACT — density/type:** ~1,598 arbitrary sub-12px sizes (`text-[10px]/[11px]`) + 2,993 `text-xs`.
**FACT — bespoke dashboards:** only Procurement has a structured shell (`components/procurement/ProcurementDashboardShell.tsx:75-85` — breadcrumb + title + stat badges); Fulfillment (`OrderFulfillment.tsx`), Planning (`Planning.tsx`), Warehouse render headers/filters ad-hoc. "Different app per module."

**JUDGMENT (design language):** Per your own assessment, the *language itself* is weak — but I can't specify the target until your references land. What's objectively fixable now regardless of aesthetic: the **gray/slate split, radius/shadow chaos, and per-module header divergence.**

**Problems:** `High` — dual neutrals; `High` — bespoke module chrome; `Medium` — radius/shadow/type variety.
**10/10:** single neutral ramp, a 3-step elevation scale, a shared `ModuleDashboardShell`, and the forthcoming reference language tokenized once and applied everywhere. *(Needs design sign-off.)*

---

### 3. Component architecture — 2/10

**FACT — god-components:** `pages/Planning.tsx` **11,557 lines** (~36 `useState`, ~11 `useMemo`, 10+ queries, inline modals at `:6478+`, dead code `:6740-6752`); `pages/procurement/index.tsx` **10,982 lines** (~48 `useState` at `:921-1077`, 15+ queries, all modals inline); `pages/Production.tsx` **9,995 lines** (array-index keys `:2101`, 13-setter prop-drill `:2264-2277`).
**FACT — no memoization discipline:** **0 `React.memo`** across the three; row components (`PlanningBatchTableRow`) receive **14 inline handler props created inside `.map()`** (`Planning.tsx:2543-2561`) → new refs every render.
**FACT — duplication:** 4 sidebars (`Sidebar.tsx` 1,024 · `QualitySidebar.tsx` 111 · `WarehouseSidebar.tsx` 123 · `WarehouseInventorySidebar.tsx` 926) with ~60% shared mobile-header/overlay/active-item code (`Sidebar.tsx:233-254`, `QualitySidebar.tsx:41-77`, `WarehouseSidebar.tsx:37-100`); 4 typeaheads (`Material/Pm/Rm/VendorClientName`); `WarehouseInventorySidebar.tsx` is **misnamed** (it's a detail inspector, `:70-926`).

**JUDGMENT:** These files are effectively un-reviewable and re-render broadly; every change is high-risk. This is your maintainability + jank problem in one place.

**Problems:** `Critical` — 10k-line components + no memo; `High` — sidebar/typeahead duplication; `Low` — dead code, misnamed component.
**10/10:** god-pages split into memoized sub-views + row components; one `SidebarLayout` + data-driven nav; one generic `MaterialTypeahead`.

---

### 4. Accessibility (WCAG 2.2 AA) — 3/10

**FACT — `Blocker`: 147 hand-rolled modals / 82 files** (`fixed inset-0`) vs 7 using Radix. Sampled: `components/ui/ConfirmDialog.tsx:60-62` (no `role="dialog"`/`aria-modal`/focus restore), `components/rolemanagementcomp/RoleDetailPopup.tsx:22-33` (overlay no role, close-`X` no `aria-label`), `components/taskmanagementcomp/TaskApp.tsx:114-119`. The shared `MODAL_VARIANTS.backdrop` itself (`theme.ts:165`) has no dialog semantics. Correct pattern already exists: `components/pis/components/ui/dialog.tsx:37-72` (Radix: focus trap, ESC, `aria-modal`, `sr-only` "Close" `:68`).
**FACT — `High`: contrast + tiny text.** ~901 `text-gray-400/300` / `text-slate-400`, frequently combined with `text-[10px]` (e.g. `StockByLocationPanel.tsx:134`, `MaterialMasterTypeahead.tsx:172,185`, `DateRangeFilterInputs.tsx:54`) → ~2.8–3:1, fails 4.5:1.
**FACT — `High`: icon-only buttons w/o names** (`TaskApp.tsx:67-70` Bell; `RoleDetailPopup.tsx:26-33` close). **`High`: clickable divs** (`ClientHub.tsx:289`, `Production.tsx:8384`).
**FACT — `Medium`: tables** — 218/226 `<table>` lack `<th scope>` (`ArrayItemManager.tsx:124-139`); good counter-example `UniversalSwapPage.tsx:124-132`. **`Medium`: motion** — 162 `animate-*`; only a global catch-all guard `index.css:527-535`.
**FACT — good:** `components/ui/FormField.tsx:44` uses `<label htmlFor>`; focus rings mostly compensated (`FormField.tsx:57-63`, `UnifiedComponents.tsx:23-26`).

**JUDGMENT:** Real users on keyboard/SR are blocked by the modals; low-vision users are hurt by the gray-on-white micro-text. Both are systemic, both fixable via shared components.

**10/10:** all overlays via one Radix-based `<Modal>`; icon buttons named; `text-gray-600` floor + 12px min; `scope` in the shared table header.

---

### 5. Interaction & feedback — 4/10

**FACT:** Loading is **text-only, no skeletons** (`Production.tsx:2056` "Loading RM/PM requirements…"; `Planning.tsx` single `isLoading` spinner). Empty states are **partial/ad-hoc** — present on Planning's batch table (`Planning.tsx:2574-2579`) and Production's RM/PM panel (`Production.tsx:2062-2064`) but **missing on Items-Involved, Procurement lists, PO lists**. Many mutations are **silent on success** (batch delete `Planning.tsx:2983`); errors are toasts with inconsistent extraction (`procurement/index.tsx:1443-1446`). **No per-section error boundaries** (a 500 renders empty). Disabled buttons lack in-button spinners (`reserveDisabled` `Production.tsx:2043`).

**JUDGMENT:** The building blocks exist but aren't standardized, so every screen feels slightly different and slow.

**Problems:** `High` — no skeletons + inconsistent empty/error; `Medium` — silent success, no error boundaries.
**10/10:** `<DataTable>` with built-in loading (skeleton) / empty / error slots used everywhere; consistent success toasts; section-level error boundaries with retry.

---

### 6. Responsiveness & cross-device — 4/10

**FACT:** **95 `min-w-[…px]`** table/grid constraints force horizontal scroll below the width (`Planning.tsx:2512` `min-w-[1440px]`; items-involved ~`1280px`; `Production.tsx:8060` cal-grid `min-w-[900px]`). Touch targets on icon buttons are `p-1`/`p-2` (~28–32px, < 44px AA target). `SwipeableModuleLayout` (swipe-to-open) is used by **Fulfillment only** (`App.tsx:310-340`); 9 other modules use `StandaloneModuleLayout` — inconsistent with no stated reason.

**JUDGMENT:** Acceptable for desktop (your primary case), but "internal ERP on a 1366 laptop" already gets sideways-scroll on the biggest tables, and any tablet use degrades.

**10/10:** responsive table strategy (sticky first column / horizontal scroll contained to the table, not the page), 44px targets, one layout shell.

---

### 7. Information architecture & flow — 3/10

**FACT — three nav paradigms:** URL-driven tabs in Planning/Warehouse/Quality (`Planning.tsx:2680-2682`, `WarehousePage.tsx:13-15`) → Back/deep-link work; **component-state tabs** in Procurement (`procurement/index.tsx:921-923`), Fulfillment (`OrderFulfillment.tsx:32-38`), PIS, Treasury → **Back exits the module, refresh loses state.**
**FACT — no wayfinding:** `components/ui/PageHeader.tsx` used on **9 pages only**; document title is module-level only (`App.tsx:99-128`) — every Procurement tab is "eiadmin - Procurement".
**FACT — deep modal nesting:** Procurement PR→Quote→Record→"Approve & Create PO" is **3–4 modal levels** (`procurement/index.tsx:10141-10770`); Planning PIS→detail→Plan-Batches→sub-tabs is 4 levels (`Planning.tsx:2626-2686`) with **silent loss of edits** if you click outside (no unsaved-changes guard).
**FACT — 4 sidebars, bespoke dashboards** (see §3, §2).

**JUDGMENT:** This is your "users get lost." The Back button betraying users in half the app is the single most disorienting thing.

**Problems:** `Critical` — tab-state-not-in-URL (Back/deep-link broken); `High` — no breadcrumbs, deep modal nesting, no unsaved guard.
**10/10:** all module tabs in the URL (`useSearchParams`/nested routes), a breadcrumb in a shared shell, modal nesting capped at 2, unsaved-changes prompts.

---

### 8. Content & microcopy — 6/10

**FACT:** Validation/error copy is largely clear and actionable — `Add at least one line.`, `Add at least one price tier (MOQ + price…)`, `At least one Formula BOM line is required.` **JUDGMENT:** the *best* dimension. **Problems:** inconsistent verbs ("could not…" vs "Failed…"), some developer-ish phrasing, and empty-state guidance is missing wherever empty states are (see §5).
**10/10:** one voice guide (sentence case, consistent verb, "what + how to fix"), empty states with a next action everywhere.

---

### 9. Perceived performance — 3/10

**FACT:** Re-render storms — no `React.memo`, inline handler props in big maps (`Planning.tsx:2543-2561`), chained `useMemo` waterfalls (`Planning.tsx:2397-2432`), `useQueries` returning new arrays each render (`Planning.tsx:4419-4427`). **No virtualization** on 100+ row tables. **No skeletons** → late data flashes in; pagination resets mid-flight (`Planning.tsx:2468-2473`). Source pages are enormous (Planning/procurement ~500KB each) → heavy chunks even when lazy-loaded.

**JUDGMENT:** This is the "janky" feeling — mostly a consequence of the god-components; fixing §3 fixes most of this.
**10/10:** memoized rows, virtualized long tables, stable callbacks, skeletons, and decomposed pages so chunks are smaller.

---

## Phase 3 — Roadmap to 10/10

Sequenced so foundational work unblocks the rest. Effort: **S** ≤1d · **M** ≈2–5d · **L** >1wk. All fits your constraints (incremental, no new deps — Radix/CVA/Tailwind already present).

### NOW — quick wins & critical (a11y blockers + broken states)

| Action | Components | Why / score moved | Effort | Risk if skipped |
|---|---|---|---|---|
| **One accessible `<Modal>`** (wrap installed Radix Dialog) + migrate `ConfirmDialog` and the highest-traffic ad-hoc overlays; codemod the rest of the 147 | `components/ui/ConfirmDialog.tsx`, `theme.ts:164-170`, the 82 `fixed inset-0` files | Fixes the **a11y blocker** + consistency + duplication at once → **#4 +3, #2 +1, #3 +1** | Keyboard/SR users blocked; legal/usability risk |
| **Name every icon-only button** (`aria-label`), convert `div/span onClick` → `<button>` | `TaskApp.tsx:67`, `RoleDetailPopup.tsx:26`, `ClientHub.tsx:289`, `Production.tsx:8384` | **#4 +1** | Actions invisible to SR/keyboard |
| **Contrast + min-font pass** — `text-gray-400/300`→`gray-600`; floor body text at 12px | shared table/typeahead/help-text spots (§4 cites) | **#4 +1, #2 +0.5** | Low-vision users can't read micro-text |
| **`scope="col"` in the shared header** | `components/ui/SortableTableTh.tsx` | One change → many tables; **#4 +0.5** | SR table nav broken |
| **Add empty/error slots to the shared table** and use on the lists that lack them | `components/ui/DataTable.tsx` + Procurement/Items-Involved lists | **#5 +1** | Blank screens read as "broken" |

### NEXT — structural (design-system consolidation + component refactors)

| Action | Why / score moved | Effort | Deps |
|---|---|---|---|
| **Collapse to ONE token layer** — keep the `@theme` block (`index.css:80-113`), delete `theme.ts` class-string system + duplicate `:root` (`index.css:26-69`) + reconcile `tailwind.config.js`; **decide the brand color** | Kills the root cause; **#1 +4, #2 +2** | **Design sign-off** (amber vs slate vs zinc — `theme.ts:6` / `:12` / `index.css:28`) |
| **Ship the core shared primitives** (`Button`, `Card`, `Badge`/reuse `StatusBadge`, `Input`/`FormField`, `DataTable`, `PageHeader`, `ModuleDashboardShell`) and migrate module-by-module | Shared components everywhere; **#1 +2, #2 +2, #3 +2** | token layer above |
| **One `SidebarLayout`** (mobile header + overlay + active-item) → refactor the 4 sidebars onto it; rename `WarehouseInventorySidebar`→`…DetailPanel` | **#3 +2** | — |
| **Move Procurement/Fulfillment/PIS/Treasury tab state to the URL** (`useSearchParams`) | Restores Back/deep-link/refresh; **#7 +3** | — |
| **Decompose the 3 god-components** into memoized sub-views + `React.memo` row components; stabilize `.map()` handlers; virtualize 100+ row tables; add skeletons | **#3 +3, #9 +4, maintainability** | primitives help |
| **One generic `MaterialTypeahead`** replacing the 4 | **#3 +1** | — |

### LATER — strategic (needs design input / buy-in)

| Action | Why | Effort | Needs |
|---|---|---|---|
| **Adopt your reference design language** — retokenize the single token layer to the new brand once references arrive | Fixes "the language itself is bad"; **#2 → 9+** | **L** | your references + sign-off |
| **Unify module chrome + breadcrumbs** — every module in `ModuleDashboardShell` (breadcrumb, title, filter bar, stat badges) matching one pattern | Consistent app feel; **#2 +1, #7 +2** | shell built in NEXT |
| **Flatten deep flows** — cap modal nesting at 2, add unsaved-changes guards, reconsider PR→PO and Plan-Batches step counts | **#7 +1** | product input |

**Foundational ordering:** token consolidation (NEXT-1) unblocks primitives (NEXT-2) which unblock module migration + shell (NEXT/LATER). The **NOW** items are independent and safe to ship immediately — start with the `<Modal>`, since it clears the biggest a11y blocker and is reused by nearly everything else.

### Decisions I need from you (not code fixes)
1. **Brand color** — amber, slate, or near-black/zinc? (Three definitions today.) Blocks token consolidation.
2. **Reference design language** — you'll provide; parks the LATER visual work until then.
3. **Neutral ramp** — standardize on `gray` *or* `slate` (currently both). One-line decision, large blast radius.
