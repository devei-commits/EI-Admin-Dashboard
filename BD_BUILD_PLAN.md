# BD Management Module — Build Plan

Source spec: `EI_BD_Dashboard_Spec.html` (BD-DASH-SPEC-v1.0)
Target route: `/bd` (frontend) · `/api/v1/bd` (backend)

## Decisions (locked)
1. **New `/bd` module** that reuses the existing `VendorClient` master and reads
   existing SO / PIS / treasury / product data. **Client Hub left untouched** (zero merge risk).
2. **Phased per spec sprints** — review gate between each phase.
3. **Financials best-effort computed** from `sales_orders` + `treasury`; graceful `—` where data is genuinely absent. No new invoice/receivable table.

## Constraints (carried from procurement build)
- Branch-isolated: frontend off `main`, backend off `dev`, on fresh feature branches.
- Follow the **tool's** light design language (white cards, `bg-slate-50` headers, `✕` close,
  footer buttons) — `ProcModalShell` / `ModalSection` / `Field`. Do NOT replicate the HTML's
  dark-gradient popup chrome.
- Touch only BD-new files + the minimal wiring lines (`App.tsx`, `Sidebar.tsx`,
  `constants/routes.ts`, `app.js`). Do NOT edit `vendor_clients` model or any other module.

## What is REUSED (not rebuilt)
| Need | Reuse |
|---|---|
| Client master | `VendorClient` (`type='client'`), enriched via a side table |
| Popups | `ProcModalShell` + `ModalSection` / `Field` |
| Timeline / comments | clone `components/orders/CommentsPanel.tsx` |
| Charts (CLV donut, TAT bars) | **recharts** — copy `pages/quotations/QuoteDashboard.tsx` |
| Status pills | `constants/bd.ts` (mirror `constants/procurement.ts` `mk()` pattern) |
| KPI tiles | `ui/StatCard.tsx` (+ small delta variant) |
| Toasts | `useToast()` from `context/ToastContext` |
| ₹ / dates | `formatINR` / `formatLakhs` (+ add `Cr` + `DD-MMM-YYYY` helpers) |
| Page wiring | mirror procurement: lazy route, nav item, `bdNav.ts` + shell + sidebar |

## Backend — new module `src/bd/` (BD-owned tables, auto-created by `db.sync({alter:true})`)
- `bd_client_profiles` — client_id FK, tier, tier_source(auto/manual), bd_lifecycle
  (prospect/active/dormant/churn), bd_poc_id, onboarded_date, credit_limit, notes.
  *(keeps the shared `vendor_clients` model file untouched)*
- `bd_meetings` — `MTG-YYYY-NNNN`, client_id, origin, status, mode, type, requested_at,
  scheduled_for, prev_scheduled_for, duration, assignee_id, agenda, customer_request,
  attendees_ei/_client JSON, mom, action_items JSON, attachments JSON, source_meeting_id.
- `bd_queries` — `QRY-YYYY-NNNN`, client_id, origin, status, category, related_type/ref,
  description, assignee_id, sla_target_at, response_draft, escalation JSON, thread JSON,
  responded_at, resolved_at, source_meeting_id.
- `bd_grievances` — `GRV-YYYY-NNNN`, + severity, category, impact, root_cause,
  corrective_action, customer_confirmed; same escalation/thread/SLA shape.
- `bd_events` — client_id, type, title, body, ref_type/ref_id, actor_id, source(auto/manual),
  occurred_at. The History & Comments store; manual rows from meetings/queries/grievances,
  auto rows best-effort from SO/PIS/payment activity.
- Read-only **rollups** (per-client receivable/advances/orders/PIS counts) + **analytics**
  (CLV, tier-mix, products-customized, PIS/Order TAT, product-sales-summary) computed from
  `sales_orders`, `planning-quotation-asks`/`productCustomizations`, `treasury`, `products`.
- Files: `models.js`, `codes.js`, `rollups.js`, `controller.js`, `analytics.controller.js`,
  `routers.js`. Mount one line in `app.js` (literal routes before `/:id`).

## Frontend — new files
- `pages/bd/index.tsx` · `components/bd/BDDashboardShell.tsx` · `BDSidebar.tsx` · `lib/bdNav.ts`
- `constants/bd.ts` · `types/bd.types.ts` · `services/bd.service.ts`
- Views: `CustomerTrackerView` · `QueriesView` · `GrievancesView` · `MeetingsView` · `AnalyticsView`
- Popups: `CustomerDetailPopup` (§3A) · `HistoryTimelinePopup` (§3B) · `AddMeetingPopup` (§3C) ·
  `AddQueryGrievancePopup` (§3D) · `QueryRespondPopup` (§3F) · `GrievanceRespondPopup` (§3G) ·
  `MeetingLifecyclePopup` (§3H)
- Wiring: `App.tsx` (lazy route + standalone branch), `Sidebar.tsx` (nav item), `constants/routes.ts`

## Phases
**Phase 1 — Sprint 1 (Tracker foundation)**
Backend: `bd_client_profiles` + `bd_events`; `GET /bd/customers` (rollups), `/customers/:code`,
`/customers/:code/timeline`; tier/lifecycle compute. Frontend: `/bd` wiring + shell + 5-tab scaffold,
**Customer Tracker** view, **§3A Detail** popup, **§3B History timeline**. Financials best-effort.

**Phase 2 — Sprint 2 (Transaction tabs)**
Backend: `bd_meetings` / `bd_queries` / `bd_grievances` + lifecycle endpoints + event auto-capture +
cross-initiate. Frontend: **Meetings / Queries / Grievances** tabs + §3C/§3D/§3F/§3G/§3H popups,
escalate + respond branches, MoM capture, SLA flags.

**Phase 3 — Sprint 3 (Analytics)**
Backend: `/bd/analytics/*` (clv, tier-mix, products-customized, pis-tat, order-tat, sales-summary).
Frontend: **Analytics** view — KPI strip, CLV ranking + tier donut, product breadth, TAT tables/charts,
product-wise sales summary (recharts).

## Open items to confirm during build
- Exact PIS source (planning-quotation-asks vs productCustomizations vs planning-extracted).
- Exact receivables/advances source inside the `treasury` module.
- BD permission `moduleId` for `ProtectedModuleRoute` (reuse a module or add a new one).
