# DESIGN_AUDIT — token conformance baseline (start of Phase 3)

Quantitative sweep of `src/` against the new Apple-grade token system (see `src/index.css`, `DESIGN_PROGRESS.md`). Read-only snapshot; numbers are the retint work-list. Captured at the start of Phase 3.

## Headline metrics
| Dimension | Count | Files | Notes |
|---|---:|---:|---|
| Raw Tailwind palette (`bg-white`, `bg/text/border-gray-*`, `slate-*`) | 15,095 | 307 | the bulk of the retint |
| New-token adoption (baseline) | 5,091 | 207 | ~30% — mostly Procurement/Production/Warehouse partial |
| `lucide-react` importers | — | 144 | all migrate to Phosphor via `components/ui/Icon` |
| Emoji glyphs used as UI | 190 | 56 | must all become Phosphor |
| Hardcoded hex / rgb() in class/style | 118 | 20 | bypass tokens |
| Ad-hoc `fixed inset-0` overlays | 148 | 83 | retoken now; Radix migration is out-of-scope (deferred) |
| Inline `style={{}}` | 158 | 29 | mostly print templates (acceptable) |

## Heaviest single files (raw palette)
1. `pages/Production.tsx` — 941
2. `pages/Planning.tsx` — 777
3. `pages/procurement/index.tsx` — 684 (605 new tokens already → partial)
4. `components/taskmanagementcomp/components/GlobalTaskOverview.tsx` — 287

## Emoji concentration
Warehouse 51 · (infra/test/constants 72) · Procurement 25 · Quality 16.

## Phase-3 module effort (raw-palette usages · lucide files · emoji)
| Tier | Modules |
|---|---|
| **XL** | Production (~1,049 · 4f) · Planning (~1,499 · 29f · 63 files total) · Procurement (~1,814 · 21f, partly done) · Warehouse (~1,745 · 14f · 51 emoji) |
| **L** | Fulfillment (~1,056 · 33f) · Quotations (~894 · 23 hex) · Catalogue/Items (~1,057) · Enquiry (~571) |
| **M/S** | Sales/Purchase · BD · Quality · User/Role · Treasury · Task · Vendors/Clients · Misc · Nav shell · **Dashboard** |

## Blockers → resolutions
1. **Status colors not tokenized as utilities** → RESOLVED: added `text-ok/warn/err/info/neut` + `bg-*-soft` in `index.css` (Phase 3 prep).
2. **Icon migration (144 files)** → per-module during each P3 pass; alias Phosphor→existing local names on import to minimize churn.
3. **Ad-hoc modals (83 files)** → retoken surfaces/backdrops in place now; structural Radix migration stays deferred (see DESIGN_PROGRESS "Deferred").
4. **Emoji (56 files)** → swap to Phosphor per-module.

## Execution order (recommended)
Dashboard → Nav shell (Sidebar) → User/Role → Treasury → Task/BD/Quality (M/S) → Procurement → Fulfillment → Planning/PIS → Production → Warehouse → Catalogue/Items → Masters → Quotations → rest. (Do the small/high-visibility ones first to validate the token language, then the XL data screens.)
