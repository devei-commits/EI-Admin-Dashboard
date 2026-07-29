# Batches Dashboard — RM Status & PM Status: Decision Logic

Scope: the **RM Status** and **PM Status** columns of the **Planning → Batches** dashboard
(`/planning/batches`). Branch: `fix/plpr`.

## Where it's computed

| Layer | File | Role |
|---|---|---|
| Display | `src/lib/planningBatchesTableDisplay.ts` → `buildPlanningBatchRmStatusView` / `buildPlanningBatchPmStatusView` → `buildMaterialStatusFromAvailability` | Maps backend numbers → pill label + colour |
| Data | `ei-website-backend/src/fulfillment/controller.js` → `GET /api/v1/fulfillment/so-planning-availability` | Computes `rmStartable`, `rmRemainingTotalKg`, `pmStartable`, `pmRemainingTotalUnits` **per batch** |
| Wiring | `src/pages/Planning.tsx` (`PlanningBatchTableRow`, `availabilityBySoNo`) | Fetches availability per SO, matches the batch by `sequence`, passes it to the view builders |

The dashboard only lists **sent / rework** batches, so availability is fetched per SO for those.

## The status vocabulary

`AVAILABLE` (green) · `SHORTAGE` (red) · `UNDER PROCUREMENT` (amber) · `PLANNING PENDING` (red, fallback only) · `—` (neutral, no data)

---

## Backend inputs (per batch)

For each planning batch of the SO:

- **Required qty** — from the batch's own BOM copy:
  - RM line: `qtyKg = batch.size_kg × pct_w_w / 100` (or a precomputed `line.quantity`). Summed per material → `rmReqById`, total → `rmNeededTotal`.
  - PM line: `qtyUnits = qty_per_unit × batchSizeUnits` (or stored `quantity`) → `pmReqById`, `pmNeededTotal`.
- **Free warehouse stock** — `rmAvailableById[id] = max(0, warehouse.stock_in_hand − warehouse.reserved)` (unreserved stock). Same for PM.
- **Reserved via production** — `rmRequested` / `pmRequested` = `ReservedBatchItem.quantity_reserved` summed for the batch's linked production batch.
- **BMR/BPR "already-fulfilled" overrides**:
  - `BMR_RM_FULFILLED = {dispensing, in_production, bulk_qc, cleared}` → RM treated as consumed.
  - `BPR_PM_FULFILLED = {pm_reserved, scheduled, pm_connected, pm_dispensing, filling, fill_qc, packaging, pack_qc, fg_ready}` → PM treated as reserved/consumed.

### Derived per-batch numbers

- **`rmStartable`** = `BMR is RM-fulfilled` **OR** ( batch has RM requirements **AND** every required RM qty ≤ **simulated** free stock ).
  - The simulation is **greedy across batches in sequence order**: when a batch is deemed startable, its requirements are subtracted from the running free-stock pool, so later batches see less stock. (A batch's status therefore depends on its siblings ahead of it.)
- **`rmRemainingTotalKg`** = `max(0, rmNeededTotal − rmRequested)` — required minus what's already reserved through production.
- **`pmStartable`**, **`pmRemainingTotalUnits`** — the exact PM mirrors of the above.

---

## Display decision (per column)

Applied independently to RM (using `rmStartable` / `rmRemainingTotalKg`) and PM (using `pmStartable` / `pmRemainingTotalUnits`):

| # | Condition | Status | Colour | Sub-label |
|---|---|---|---|---|
| 0 | `neededTotal ≈ 0` (batch needs none of this material) | **AVAILABLE** | green | "no RM/PM required" |
| 1 | `startable === true` | **AVAILABLE** | green | "stock covers batch" |
| 2 | not startable **AND** `remaining > 0.01` (RM) / `> 0` (PM) | **SHORTAGE** | red | "{qty} kg/pcs short" |
| 3 | not startable **AND** `remaining ≈ 0` | **UNDER PROCUREMENT** | amber | "procurement in flight" |

Plain-English meaning:
- **AVAILABLE** — can start this batch right now from free warehouse stock (or production already began consuming its materials).
- **SHORTAGE** — can't start, and part of the requirement is still **not reserved** → genuinely short, needs procurement.
- **UNDER PROCUREMENT** — can't start from *free* stock, but the whole requirement is already **reserved via production** → materials secured / in flight.

### Fallback (no availability row for the batch)

`buildPlanningBatchRmStatusView(avail, releaseSplit)` — when `avail` is absent it uses the release-split `{released, total}`:

| Condition | Status | Colour |
|---|---|---|
| no releaseSplit or `total ≤ 0` | **—** | neutral |
| `released ≥ total` | **UNDER PROCUREMENT** | green |
| `released > 0` | **UNDER PROCUREMENT** | amber |
| `released === 0` | **PLANNING PENDING** ("{total} lines") | red |

---

## Verification — findings

✅ **Core logic is sound and consistent** between RM and PM (identical structure/thresholds). The three-way split (startable → covered-by-reservation → short) is coherent, and BMR/BPR overrides correctly flip a batch to AVAILABLE once production begins.

✅ **Issue 1 — FIXED (2026-07-28).** Previously a batch with NO requirement on one side (e.g. an RM-only intermediate → no PM) showed `UNDER PROCUREMENT` on the empty side, because `remaining = 0` fell into the under-procurement branch. `buildMaterialStatusFromAvailability` now short-circuits: if `rmNeededTotalKg ≈ 0` (or `pmNeededTotalUnits ≈ 0`) it returns **AVAILABLE — "no RM/PM required"** (rule #0 above). Display-only change; no backend edit.

⚠️ **Issue 2 — label nuance.** `UNDER PROCUREMENT` is used for "requirement fully **reserved via production** but not startable from *free* stock". That's accurate as *not-short*, but the wording ("procurement in flight") reads as an open PO; it's really "reserved/allocated". Purely cosmetic.

ℹ️ **Note — sibling dependence.** Because `startable` is a greedy simulation in sequence order, an earlier batch consuming stock can push a later batch from AVAILABLE to SHORTAGE. This is intentional (models starting batches in order) but is worth knowing when a batch looks "short" despite stock existing.

ℹ️ **Test-data limitation.** The local snapshot currently has no sent batches linked to production, so the availability branch can't be exercised end-to-end locally; the above is from code trace + the endpoint's own debug logs.

---

## Related — the RM/PM **items popup** (click the status pill)

Clicking an RM/PM status pill opens the per-item panel. Its **ITEM STATUS** column is a **different engine**: `computeBatchItemsPanelStatus` in `lib/planBatchItemsPanelDisplay.ts`, fed by the per-PI endpoint `getItemsInvolvedByPlanningId`.

✅ **Fixed (2026-07-28) — "AVAILABLE despite SIH 0".** The panel previously fed `plannedQty` into a §8.2 `procured` sum, but in the per-PI endpoint `plannedQty` is the qty **allocated to the batch** (demand), not supply — so a batch's own demand "covered" itself and every resolved item read AVAILABLE regardless of stock. `computeBatchItemsPanelStatus` now **ignores `plannedQty`** and judges availability from **real** stock + procurement only:

| Condition | Status |
|---|---|
| `reserved + free + PO + in-transit + under-GRN ≥ REQ` | **AVAILABLE** |
| short, but real pipeline (PO / in-transit / under-GRN) > 0 | **UNDER PROCUREMENT** |
| short, nothing incoming | **SHORTAGE** |

So an item with **SIH = 0** and no PO/in-transit/GRN now correctly reads **SHORTAGE** (e.g. CLUB00035 in the reported example), while items with real stock (WATER) stay **AVAILABLE**. The `PLANNED` column is still shown for information; it just no longer drives the status. (Frontend-only change; `plannedQty` semantics in the endpoint were left as-is — see option B if the PLANNED column should show real procurement instead of allocation.)
