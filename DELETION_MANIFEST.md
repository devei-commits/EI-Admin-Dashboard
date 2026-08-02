# DEAD-CODE DELETION MANIFEST — EI-Admin-Dashboard

Generated 2026-08-01. **READ-ONLY analysis. Nothing was deleted.**

## Method

Reachability graph, not naive grep. An import graph was built over all 691 `.ts/.tsx`
files under `src/` (static `import`/`export…from`, dynamic `import()` / `lazy(() => import())`,
and `require()`), resolving relative, `@/`, and `src/` specifiers plus `index.*` barrels.
BFS was run from the real entry chain `src/main.tsx → src/App.tsx` (the router, which
lazy-loads every page). Result: **537 reachable, 154 unreachable.**

A file is listed for deletion only if **nothing reachable from the entry** imports it —
statically, dynamically, via a barrel, or via a test. Transitive-dead clusters were
verified to their roots (e.g. a component whose only importer is itself unreachable).
Suspects called out in the task were each checked individually (results below).

**Suspect adjudication (task list):**
- `src/pages/Warehouse.tsx` + `src/pages/WarehouseInventory.tsx` → **DEAD** (legacy; live page is `WarehousePage.tsx`). Cluster confirmed.
- `src/components/WarehouseInventorySidebar.tsx` → **LIVE / KEEP** — imported by `src/pages/warehouse/Inventory.tsx` and `Locations.tsx` (both reachable).
- `src/components/orders/KPICard.tsx` → **DEAD** — only importers are dead orders files (`SaleOrdersView`, `index.ts`).
- `src/components/orders/StatusBadge.tsx` → **LIVE / KEEP** — imported by `src/components/ui/index.ts` and `src/pages/Production.tsx`.
- `src/components/pis/components/auth/{Login,RoleSelector,WaitingForRole}.tsx` → **DEAD** — only reachable via the `pis/components/index.ts` barrel, which nothing imports. Not on the rendered PIS path.

---

## Totals

| Bucket | Files | LOC |
|---|---|---|
| High-confidence dead (delete) | **69** | **~16,391** |
| Uncertain — verify before delete (BMR/BPR print templates) | 2 | ~469 |
| Test-only source (KEEP per rule — referenced by tests) | 4 | ~420 |
| Unreachable test files (KEEP — this is the test suite) | 78 | — |
| Unused npm deps | **2** | — |
| Orphaned assets | 0 | — |

**Est. bundle delta:** near-zero runtime bundle savings. Nearly all dead files are already
tree-shaken out of `dist` (they are unreachable from `main.tsx`, so Vite/Rollup never
includes them). The win is **repo hygiene / maintainer cognitive load / faster typecheck &
lint**, not shipped-JS size. The only real bundle/`node_modules` win is removing the 2 unused deps.

---

## GROUP A — High-confidence dead application code (DELETE)

### A1. `orders/` legacy dashboard cluster — 18 files, ~5,351 LOC
The `orders/index.ts` barrel is imported by nothing; the live Fulfillment path
(`pages/Fulfillment.tsx → pages/OrderFulfillment.tsx`) imports specific orders components
(`SODashboardView`, `BatchesDashboardView`, `FulfillmentSidebar`, `Modal`, `SODetailModal`,
`StatusBadge`) directly — NOT these. `utils/manufacturing.ts` is imported only by dead orders files.

| path | kind | evidence |
|---|---|---|
| `src/components/orders/index.ts` | barrel | EVIDENCE: `grep components/orders` shows only `orders/*` self-imports + direct-file imports from `OrderFulfillment.tsx`; barrel importers = [] |
| `src/components/orders/SaleOrdersView.tsx` | view | importers: `index.ts` (dead) only |
| `src/components/orders/ProductsBatchesView.tsx` | view | importers: `index.ts` (dead) only |
| `src/components/orders/FilterBar.tsx` | component | importers: SaleOrdersView, ProductsBatchesView, index.ts — all dead |
| `src/components/orders/KPICard.tsx` | component | importers: SaleOrdersView, index.ts — all dead |
| `src/components/orders/PipelineStrip.tsx` | component | importers: SaleOrdersView, index.ts — dead |
| `src/components/orders/ProgressBar.tsx` | component | importers: index.ts — dead |
| `src/components/orders/SOCard.tsx` | component | importers: index.ts — dead |
| `src/components/orders/Stepper.tsx` | component | importers: index.ts — dead |
| `src/components/orders/Alert.tsx` | component | importers: index.ts — dead |
| `src/components/orders/BatchSplitTable.tsx` | component | importers: index.ts — dead |
| `src/components/orders/ConsolidatedMRModal.tsx` | modal | importers: [] |
| `src/components/orders/DelayImpactModal.tsx` | modal | importers: [] |
| `src/components/orders/DraftSplitModal.tsx` | modal | importers: [] |
| `src/components/orders/ItemDetailModal.tsx` | modal | importers: [] |
| `src/components/orders/OrderTable.tsx` | component | importers: [] |
| `src/components/orders/SwapMaterialModal.tsx` | modal | importers: [] |
| `src/utils/manufacturing.ts` | util | importers: only dead orders files (ItemDetailModal, BPR/BMRPrintTemplate, ConsolidatedMRModal, DelayImpactModal) |

### A2. Legacy Warehouse pages cluster — 5 files, ~1,104 LOC
Live warehouse UI is `pages/WarehousePage.tsx` (lazy in router). These are the superseded set.

| path | kind | evidence |
|---|---|---|
| `src/pages/Warehouse.tsx` | page | importers: [] (not in router; router uses `WarehousePage`) |
| `src/pages/WarehouseInventory.tsx` | page | importers: `Warehouse.tsx` (dead) only |
| `src/pages/warehouse/GRNModal.tsx` | modal | importers: [] |
| `src/pages/warehouse/LogisticsSchedule.tsx` | page | importers: [] |
| `src/services/logisticsSchedule.service.ts` | service | importers: `LogisticsSchedule.tsx` (dead) only |

### A3. `services/` + paired `types/` cluster — 7 files, ~2,549 LOC
Abandoned service layer; each `*.service.ts` has zero live importers, and its dedicated
type file is imported only by that dead service.

| path | kind | evidence |
|---|---|---|
| `src/services/itemsMaster.service.ts` | service | importers: [] |
| `src/services/master.service.ts` | service | importers: [] |
| `src/types/common.types.ts` | types | importers: `master.service.ts` (dead) only |
| `src/services/order.service.ts` | service | importers: [] |
| `src/types/order.types.ts` | types | importers: `order.service.ts` (dead) only |
| `src/services/task.service.ts` | service | importers: [] |
| `src/types/task.types.ts` | types | importers: `task.service.ts` (dead) only |

### A4. `mocks/` zoho fixtures — 4 files, ~2,592 LOC

| path | kind | evidence |
|---|---|---|
| `src/mocks/zohoClients.mock.ts` | mock | importers: [] |
| `src/mocks/zohoItems.mock.ts` | mock | importers: [] |
| `src/mocks/zohoRawMaterials.mock.ts` | mock | importers: [] |
| `src/mocks/zohoVendors.mock.ts` | mock | importers: [] |

### A5. Dead `procurement` components + pages — 8 files, ~1,933 LOC

| path | kind | evidence |
|---|---|---|
| `src/components/procurement/InventoryAuditView.tsx` | component | importers: [] |
| `src/components/procurement/ProcurementRequestPrGroupCard.tsx` | component | importers: [] |
| `src/components/procurement/ReleaseToDraftPopup.tsx` | component | importers: [] |
| `src/components/procurement/UpdatePriceListPopup.tsx` | component | importers: [] |
| `src/components/procurement/WeekVendorConsolidationView.tsx` | component | importers: [] (its lib `weekVendorConsolidation.ts` is referenced only by a test — see GROUP D) |
| `src/pages/procurement/ProcurementReports.tsx` | page | importers: [] (not in procurement router) |
| `src/pages/procurement/ProcurementVendors.tsx` | page | importers: [] |
| `src/pages/procurement/ProcurementTypes.ts` | types | importers: [] |

### A6. `hooks/` query-factory cluster — 11 files, ~426 LOC
Ten unused hooks + the `queryHooksFactory` they alone consume. (Live code uses
`@tanstack/react-query` directly / context hooks like `VendorClientContext.useVendorClient`,
which is a different symbol.)

| path | kind | evidence |
|---|---|---|
| `src/hooks/useAutoSave.ts` | hook | importers: [] |
| `src/hooks/useBOM.ts` | hook | importers: [] |
| `src/hooks/useDraftLoader.ts` | hook | importers: [] |
| `src/hooks/useGRN.ts` | hook | importers: [] |
| `src/hooks/useMRN.ts` | hook | importers: [] |
| `src/hooks/useProducts.ts` | hook | importers: [] |
| `src/hooks/useRawMaterials.ts` | hook | importers: [] |
| `src/hooks/useRoles.ts` | hook | importers: [] |
| `src/hooks/useSearchFilter.ts` | hook | importers: [] |
| `src/hooks/useVendorClient.ts` | hook | importers: [] (distinct from `context/VendorClientContext`'s `useVendorClient`) |
| `src/lib/queryHooksFactory.ts` | lib | importers: only the 5 dead hooks above |

### A7. PIS auth barrel cluster — 7 files, ~789 LOC
Reachable only through `pis/components/index.ts`, which nothing imports. Not on the rendered
PIS path (live PIS chrome lives elsewhere under `pis/components/{layout,views,...}`).

| path | kind | evidence |
|---|---|---|
| `src/components/pis/components/index.ts` | barrel | importers: [] (grep for `pis/components` barrel = none) |
| `src/components/pis/components/auth/index.ts` | barrel | importers: `components/index.ts` (dead) |
| `src/components/pis/components/auth/Login.tsx` | page | importers: `auth/index.ts` (dead) |
| `src/components/pis/components/auth/RoleSelector.tsx` | page | importers: `auth/index.ts` (dead) |
| `src/components/pis/components/auth/WaitingForRole.tsx` | page | importers: `auth/index.ts` (dead) |
| `src/components/pis/components/layout/Logo.tsx` | component | importers: `auth/RoleSelector.tsx` (dead) only |
| `src/components/pis/components/ui/alert.tsx` | ui | importers: `index.ts` + `auth/Login.tsx` — both dead |

### A8. `salesPurchase` tabs — 2 files, ~714 LOC

| path | kind | evidence |
|---|---|---|
| `src/pages/salesPurchase/PurchaseTab.tsx` | page | importers: [] |
| `src/pages/salesPurchase/SalesTab.tsx` | page | importers: [] |

### A9. Singles — 7 files, ~933 LOC

| path | kind | evidence |
|---|---|---|
| `src/components/FeasibilityCard.tsx` | component | importers: [] |
| `src/components/FeasibilityCardIcon.tsx` | component | importers: `FeasibilityCard.tsx` (dead) only |
| `src/components/masters/MasterApprovalStatusHistoryPanel.tsx` | component | importers: [] |
| `src/components/packaging/PmConditionalFieldBlocks.tsx` | component | importers: [] |
| `src/constants/routes.ts` | constants | importers: [] (route table not consumed; router hardcodes paths) |
| `src/lib/errorHandler.ts` | lib | importers: [] |
| `src/lib/exportUtils.ts` | lib | importers: [] |

---

## GROUP B — Unused npm dependencies (DELETE from package.json)

Zero references across `src/`, `vite.config.ts`, `index.html`. `lib/queryClient.ts` uses a
plain `QueryClient` with no persistence layer.

| dep | evidence |
|---|---|
| `@tanstack/query-sync-storage-persister` | `grep query-sync-storage-persister\|createSyncStoragePersister` → 0 hits |
| `@tanstack/react-query-persist-client` | `grep react-query-persist-client\|PersistQueryClient\|persistQueryClient` → 0 hits |

All other deps confirmed referenced (phosphor 30, sonner 22, xlsx 12, jspdf 4, recharts 3,
qrcode.react 3, cva 3, each Radix pkg ≥1, file-saver 1, next-themes 1, jspdf-autotable 2).

---

## GROUP C — UNCERTAIN: verify before deleting (print/PDF templates)

Graph-dead, but flagged KEEP-pending-human-confirm because the task singles out BMR/BPR
print templates as runtime-composed. No string/dynamic reference was found anywhere
(`grep BMRPrint|BPRPrint` → only self-definitions), and their only static importers are dead
orders files. They are almost certainly dead, but confirm no server-driven print flow
composes them before removing.

| path | kind | ~LOC | evidence |
|---|---|---|---|
| `src/components/orders/BMRPrintTemplate.tsx` | print template | ~part of 469 | importers: [] ; no string ref anywhere |
| `src/components/orders/BPRPrintTemplate.tsx` | print template | ~part of 469 | importers: [] ; no string ref anywhere |

Note: the OTHER print asset called out in the task, `GrnLabelPreview` (`src/components/warehouse/GrnLabelPreview.tsx`),
is **LIVE / KEEP** — imported by `warehouse/GrnCopyReceiptModal.tsx`.

---

## GROUP D — KEEP (do not delete)

- **`src/vite-env.d.ts`** — ambient Vite type declaration; unimported by design, required by tsconfig.
- **Test-only source (4 files, ~420 LOC)** — used only by their `.test.ts`, so alive per the "test counts as a reference" rule, but note they are exercised by tests yet not wired into the app (candidate for a later product decision, not a dead-code delete):
  `src/lib/issuedPoGrnLineStatus.ts`, `src/lib/rmClubItems.ts`, `src/lib/rmConditionalFields.ts`, `src/lib/weekVendorConsolidation.ts`.
- **78 unreachable `.test.ts` files** — this is the Vitest suite (run by `vitest`, not by `main.tsx`). KEEP. A few are "orphan tests" whose subject is otherwise app-dead (e.g. `components/__tests__/VendorClientNameTypeahead.test.ts`); revisit only if the tested module is deleted.
- **Assets** — none orphaned. `src/assets/logo/eilogofull.svg` (many importers), `src/assets/logos/ei_logo.png` (via `assets/logos/Logo.tsx` → `Sidebar.tsx`), `public/eilogo.svg` (favicon in `index.html`), `public/robots.txt` all referenced.
- No `*_old` / `*_v2` / `*copy*` / `*.bak` files exist (the only `Copy` match is the live `GrnCopyReceiptModal`).

---

## Suggested deletion order (safest → confirm)

1. GROUP B deps — trivial, isolated.
2. GROUP A whole-folder clusters (A4 mocks, A3 services+types, A6 hooks, A8 salesPurchase) — self-contained, low risk.
3. GROUP A component/page clusters (A1, A2, A5, A7, A9) — delete cluster-atomically (barrel + members together) so no dangling imports.
4. GROUP C — only after confirming no runtime print composition of BMR/BPR.

After any deletion, run `npm run build:check` (`tsc -b && vite build`) and `npm run test:run` to confirm nothing regressed.
