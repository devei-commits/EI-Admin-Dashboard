# DEAD-CODE AUDIT — EI-Admin-Dashboard

Generated 2026-08-02. **READ-ONLY analysis. Nothing was deleted.**

## Method

Reachability graph built by BFS from the real entry `src/main.tsx` (→ `src/App.tsx`,
the router, which `lazy(() => import())`s every page). Followed all static
`import` / `export … from`, dynamic `import()`, and `require()` specifiers transitively
across `src/**`. Resolved relative, `@/` → `src/`, and bare `src/` specifiers plus
`index.*` barrels. (Note: `tsconfig.app.json` defines **no `paths` alias**; imports are
effectively all relative. Two stray `@/…` specifiers exist only inside already-dead files.)

A file is DEAD only if **nothing reachable from `main.tsx`** imports it — statically,
dynamically, or via a barrel. Excluded from the candidate set: `*.test.*`, `*.spec.*`,
`setupTests`, `*.d.ts`, `vite-env.d.ts`, and `__tests__/**`. Files reachable **only** from
test files are reported separately as test-only.

**Result:** 629 files under `src/`; 547 candidate `.ts/.tsx/.css` (excl. tests/d.ts);
**537 reachable, 8 unreachable (dead), 4 test-only.**

Compared to the prior `DELETION_MANIFEST.md` (2026-08-01), **70 of its listed src paths
have since been deleted** — the bulk of that manifest's Group A was acted on. What remains
is one small dead cluster (below).

---

## Totals

| Bucket | Files |
|---|---|
| (a) Confirmed dead — DELETE | **8** |
| (b) Test-only source (KEEP per rule) | 4 |
| (c) Uncertain / needs human judgment | 2 groups (see below) |
| Reachable (live) | 537 |

Bundle impact is ~zero (these are already tree-shaken out of `dist`). The win is repo
hygiene / faster typecheck & lint.

---

## (a) CONFIRMED DEAD — safe to delete (8 files)

One self-contained cluster. Deleting all 8 together leaves **no dangling imports**
(each importer is itself in this list). Verified via `grep -rn "<basename>" src`.

### Dead sidebar/module-layout cluster (legacy, superseded by AppShell + `ui/NavSidebar`)

| path | why dead | who imports it |
|---|---|---|
| `src/components/StandaloneModuleLayout.tsx` | legacy layout, unrouted | **none** |
| `src/components/SwipeableModuleLayout.tsx` | legacy layout, unrouted | **none** |
| `src/components/Sidebar.tsx` | old top-level sidebar | only `StandaloneModuleLayout` + `SwipeableModuleLayout` (both dead). NB: this is `components/Sidebar.tsx`, distinct from the live `ui/NavSidebar`, `pis/.../Sidebar`, `WarehouseSidebar`, etc. |
| `src/hooks/useSidebarViewport.ts` | viewport hook for old sidebar | only `Sidebar.tsx` (dead) |
| `src/assets/logos/Logo.tsx` | logo wrapper for old sidebar | only `Sidebar.tsx` (dead) |

### Dead orders print-template cluster (importers already deleted with the old orders module)

| path | why dead | who imports it |
|---|---|---|
| `src/components/orders/BMRPrintTemplate.tsx` | BMR print template | **none** — no static or dynamic/string ref anywhere (`grep BMRPrintTemplate` = self only) |
| `src/components/orders/BPRPrintTemplate.tsx` | BPR print template | **none** — same |
| `src/utils/manufacturing.ts` | `fmtNum` helper | only `BMR/BPRPrintTemplate.tsx` (both dead) |

> These two print templates were "Group C — uncertain" in the old manifest (pending a check
> for a runtime print-compose flow). Re-checked: no string/dynamic reference exists anywhere,
> and their former static importers (the old `orders/` dashboard files) have since been
> deleted. They are now fully orphaned → promoted to confident-dead. If any server-driven
> print flow is later found to compose them by name, re-evaluate; none exists in `src/`.

---

## (b) TEST-ONLY source — KEEP (4 files)

Reachable only from their own `.test.ts` (alive per the "test counts as a reference" rule),
but NOT wired into the running app. Candidate for a later product decision, not a dead-code
delete. Same 4 flagged by the prior manifest.

- `src/lib/issuedPoGrnLineStatus.ts`
- `src/lib/rmClubItems.ts`
- `src/lib/rmConditionalFields.ts`
- `src/lib/weekVendorConsolidation.ts`

---

## (c) UNCERTAIN / needs human judgment

### 1. Task's "known-now-dead" suspects that are actually STILL LIVE — do NOT delete

The task premise (dead since the AppShell nav rewrite) is **outdated** for these two —
they are still transitively reachable from `main.tsx`:

| path | status | who imports it |
|---|---|---|
| `src/components/AdminMainMenuButton.tsx` | **LIVE** | `pages/Production.tsx`, `pages/TreasuryApp.tsx`, `pages/ClientHub.tsx`, `components/pis/components/layout/Header.tsx` |
| `src/context/AdminSidebarContext.tsx` | **LIVE** | `AdminMainMenuButton.tsx` (live) via `useAdminSidebar`, plus the two dead layouts |

Judgment call: `AdminMainMenuButton` + `AdminSidebarContext` are the remnants of the old
sidebar system but are still mounted by 4 live pages. If those pages no longer need a
main-menu button post-rewrite, this pair (plus its provider) could be retired — but that is
a **product/UX decision**, not a mechanical dead-code delete. Keep for now.

### 2. `UniversalSwap.tsx` vs `UniversalSwapPage.tsx` — both routed, likely one legacy

Both are `lazy`-imported and each has its own live route in `App.tsx`:
`/universal-swap` → `UniversalSwap`, `/universal-swap-page` → `UniversalSwapPage`
(`UniversalSwap` is also in `lib/preloadRoutes.ts`). Both are technically reachable, so
neither is dead-code — but having two near-identically-named routes strongly suggests one is
a superseded legacy screen. **Human decision** on which route to retire before removal.

Not duplicates (both LIVE, keep): `warehouse/Overview.tsx` (→ `WarehousePage`) and
`warehouse/OverviewComplete.tsx` (→ `Outbound.tsx` as the outbound dashboard) are different
screens despite the similar name.

---

## Cross-check vs prior `DELETION_MANIFEST.md` (2026-08-01)

- **70 of its listed src paths already deleted** (its Groups A1–A9 largely actioned).
- Still-present dead from it: `BMRPrintTemplate`, `BPRPrintTemplate`, `utils/manufacturing.ts`
  (covered in section (a) above).
- Still-present KEEP entries it named (all correctly LIVE): `orders/StatusBadge.tsx`,
  `components/ui/index.ts`, `warehouse/GrnLabelPreview.tsx`, `WarehouseInventorySidebar.tsx`,
  `pages/Production.tsx`, `warehouse/Inventory.tsx`, `vite-env.d.ts`, and the 4 test-only libs.
- No `*_old` / `*_v2` / `*copy*` / `*.bak` / `*Legacy*` files exist under `src/`.

---

## Confident-delete list (copy/paste)

```
src/components/StandaloneModuleLayout.tsx
src/components/SwipeableModuleLayout.tsx
src/components/Sidebar.tsx
src/hooks/useSidebarViewport.ts
src/assets/logos/Logo.tsx
src/components/orders/BMRPrintTemplate.tsx
src/components/orders/BPRPrintTemplate.tsx
src/utils/manufacturing.ts
```

After deletion run `npm run build:check` (`tsc -b && vite build`) + `npm run test:run`.
