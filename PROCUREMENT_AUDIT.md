# Procurement Module — Design & Functionality Audit

Comprehensive 4-lens review (modals · interactive/states · tables/layout · functionality/a11y/tokens). Findings + resolution status.

## P1 — bugs / broken UI
| # | Finding | Location | Status |
|---|---|---|---|
| 1 | **`bg-*-soft0` classes don't exist** → transparent (invisible) primary buttons + a timeline dot. Caused by an earlier retint replacing `-50` inside `-500`. | index.tsx ×12 | ✅ fixed (`-soft0`→solid `bg-ok/warn/brand`) |
| 2 | Stray literal `in` renders as visible text after a `</p>` | StockCheckUpdateModal.tsx:162 | ✅ fixed |
| 3 | Split-PO footer button order inverted (primary on left) | index.tsx (Split PO modal) | ✅ fixed |
| 4 | Two modals have **no header close** (Edit Request, Edit Draft PO) | index.tsx | ✅ fixed |
| 5 | Two modals can't be dismissed by backdrop click (Record Quote, Create-PO-from-Quote) | index.tsx | ✅ fixed |
| 6 | `key={index}` on add/remove line lists → row-state reconciliation bugs | NewPo/NewPr/RequestQuotation/QuotationEdit | ✅ fixed (stable keys) |
| 7 | Async action buttons missing in-flight disable (double-submit / duplicate-PO risk) | index.tsx (7 handlers) | ✅ fixed — 7 dedicated busy flags (`approveDraftPOBusy`, `submitSplitPOBusy`, `createDraftPOBusy`, `editRequestSaving`, `releaseDraftBusy`, `editDraftPOSaving`, `approveCreateDraftPOBusy`): guard at top + set/reset in `finally`, button `disabled` + busy label. Card release buttons delegate to these guarded handlers. |

## P2 — consistency + accessibility (fix at source in the kit)
| Finding | Resolution | Status |
|---|---|---|
| Modals lack `aria-modal`/`aria-labelledby`/Escape/focus | Added to `ProcModalShell` + `PrPopupShell` (covers ~12 modals) | ✅ |
| `ProcSearch` had no `aria-label`; filter `<select>`s unlabeled | Added `aria-label` to ProcSearch + section selects | ✅ |
| Modal `inputCls` dropped focus ring + tokens (no a11y focus) | Added `procInputClass` (ring + tokens) to kit; adopted in New PO/PR + Request Quotation | ✅ |
| No canonical button → padding/weight/color drift | Added `procBtnPrimary`/`procBtnSecondary`/`procBtnDanger` classes to kit | ✅ |
| Local `chip()` duplicates `procChipClass` | Replaced in PrInbox + QuoteRequests | ✅ |
| Self-hover no-op buttons (invisible hover) | Real press-state hovers | ✅ |
| Row hover color inconsistent (brand-soft vs surface-2/3) | Standardized `hover:bg-brand-soft` | ✅ |
| Hardcoded `bg-white` / `text-[#1d1d1f]` hex | → `bg-surface` / `text-ink` tokens | ✅ |
| `QuotationEditPopup` primary green (`bg-ok`, no hover) | → brand primary | ✅ |
| Hand-rolled `<thead>` missing `scope="col"` | Added | ✅ |
| Numeric column headers not aligned to cells | align:right on those cols | ✅ |
| Duplicate "Shipped" header in GRN Tracker | → "Shipped Date" | ✅ |
| InventoryAuditView cell density off (px-4 py-2) | → px-3 py-2.5 + transition | ✅ |

## P3 — polish (noted; selective fixes)
- Panel corner-radius `rounded-lg`→`rounded-xl`, eyebrow `tracking-[0.1xem]`→`tracking-wide`, `shadow-sm`→`shadow-[var(--e1)]` — cosmetic drift in the 6 workflow panels.
- Icon-source mix (lucide + Phosphor in same files) — functional, standardize later.
- Gradient-to-itself (`from-brand-soft to-brand-soft`) → flat `bg-brand-soft`.
- Full migration of the ~13 hand-rolled inline modals in index.tsx onto `ProcModalShell` (structural; large — deferred).

**Verification after fixes:** tsc 0 · vite build green.
