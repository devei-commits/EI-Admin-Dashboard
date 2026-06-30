/**
 * BD Management — API contract types (mirror the `src/bd` backend formatRow output).
 * Bare-JSON responses (no envelope), camelCase keys, ids as strings.
 */
import type {
  ClientTier, ClientLifecycle, QueryStatus, GrievanceStatus, GrievanceSeverity,
  MeetingStatus, BdSource, BdEventType,
} from '../constants/bd';

export type SourceTag = 'auto' | 'manual';

export interface BdPoc { id: string | null; name: string | null; }
export interface BdCount2 { open: number; ytd?: number; total?: number; }

/** A row in the §3 Customer Tracker grid. */
export interface BdCustomerRow {
  id: string;
  code: string;            // entity_code, e.g. EI-CLI-00001
  displayCode: string;     // C-001 (spec display form)
  name: string;
  city: string | null;
  location: string | null;
  country: string | null;
  tier: ClientTier;
  tierSource: SourceTag;
  lifecycle: ClientLifecycle;
  lifecycleSource: SourceTag;
  bdPoc: BdPoc;
  receivable: number | null;   // null → render '—' (no source yet)
  overdue: number | null;
  advances: number | null;
  revenue12m: number;
  clv: number;
  orders: { open: number; ytd: number; total: number };
  pis: { inFlight: number; total: number };
  queries: { open: number; breached: number };
  grievances: { open: number; escalated: number };
  nextMeeting: { date: string | null; mode: string | null } | null;
  lastOrderDate: string | null;
  daysSinceLastSO: number | null;
}

export interface BdContact {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
}

/** §3A Customer detail popup payload. */
export interface BdCustomerDetail extends BdCustomerRow {
  legalEntity: string | null;
  gstin: string | null;
  category: string | null;
  segment: string | null;
  paymentTerms: string | null;
  creditLimit: number | null;
  onboardedDate: string | null;
  daysAsActive: number | null;
  email: string | null;
  phone: string | null;
  primaryContact: BdContact | null;
  secondaryContact: BdContact | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  agreement: { name: string | null; expiresOn: string | null } | null;
  productsCustomized: { total: number; active: number; dormant: number };
  notes: string | null;
}

/** §3B History & Comments timeline event. */
export interface BdTimelineEvent {
  id: string;
  clientId: string;
  type: BdEventType | string;
  title: string;
  body: string | null;
  refType: string | null;
  refId: string | null;
  actor: string | null;
  source: BdSource | SourceTag | string;
  occurredAt: string;
}

/** PUT /customers/:code/profile body. */
export interface BdProfilePatch {
  tier?: ClientTier | null;
  lifecycle?: ClientLifecycle | null;
  bdPocId?: string | number | null;
  onboardedDate?: string | null;
  creditLimit?: number | null;
  agreementName?: string | null;
  agreementExpiresOn?: string | null;
  notes?: string | null;
}

/** POST /customers/:code/events body. */
export interface BdEventInput {
  type?: BdEventType | string;
  title?: string;
  body?: string;
  refType?: string;
  refId?: string;
}

/* ════════════════════════ Phase 2 — transaction queues ════════════════════ */

/** Client identity chip embedded in every queue row (§3F/§3G/§3H). */
export interface BdClientChip {
  id: string | null;
  code: string | null;
  displayCode: string;
  name: string;
  tier: ClientTier;
}

export interface BdAssignee { id: string | null; name: string | null; }
export interface BdEscalation { dept: string | null; toId: string | null; toName: string | null; note: string | null; }
export interface BdActionItem { text: string; owner?: string | null; due?: string | null; }
export interface BdAttendee { name: string; role?: string | null; }

/** §3F — a row in the Queries queue. */
export interface BdQueryRow {
  id: string;
  code: string;
  client: BdClientChip;
  origin: BdSource;
  relatedType: string | null;
  relatedRef: string | null;
  relatedInfo: string | null;
  subject: string | null;
  description: string;
  assignee: BdAssignee;
  status: QueryStatus;
  escalation: BdEscalation | null;
  internalReply: string | null;
  response: string | null;
  sourceChannel: string | null;
  slaTargetHours: number | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** §3G — a row in the Grievances queue (Query shape + severity/category/CAPA). */
export interface BdGrievanceRow {
  id: string;
  code: string;
  client: BdClientChip;
  origin: BdSource;
  relatedType: string | null;
  relatedRef: string | null;
  relatedInfo: string | null;
  severity: GrievanceSeverity;
  category: string | null;
  description: string;
  assignee: BdAssignee;
  status: GrievanceStatus;
  escalation: BdEscalation | null;
  internalReply: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  customerConfirmed: boolean;
  response: string | null;
  sourceChannel: string | null;
  slaTargetHours: number | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** §3H — a row in the Meetings queue. */
export interface BdMeetingRow {
  id: string;
  code: string;
  client: BdClientChip;
  origin: BdSource;
  requestedAt: string | null;
  scheduledFor: string | null;
  oldScheduledFor: string | null;
  mode: string | null;
  type: string | null;
  assignee: BdAssignee;
  attendees: BdAttendee[];
  status: MeetingStatus;
  agenda: string | null;
  mom: string | null;
  actionItems: BdActionItem[];
  nextMeetingAt: string | null;
  attendedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  relatedType: string | null;
  relatedRef: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /customers/:code/queries|grievances|meetings. */
export interface BdQueryInput {
  origin?: BdSource;
  relatedType?: string | null;
  relatedRef?: string | null;
  relatedInfo?: string | null;
  subject?: string | null;
  description: string;
  assigneeId?: string | number | null;
  assigneeName?: string | null;
  sourceChannel?: string | null;
}
export interface BdGrievanceInput extends Omit<BdQueryInput, 'subject'> {
  severity?: GrievanceSeverity;
  category?: string | null;
}
export interface BdMeetingInput {
  origin?: BdSource;
  scheduledFor?: string | null;
  mode?: string | null;
  type?: string | null;
  assigneeId?: string | number | null;
  assigneeName?: string | null;
  agenda?: string | null;
  attendees?: BdAttendee[];
  relatedType?: string | null;
  relatedRef?: string | null;
}

/** Body for the POST …/transition endpoints (action-tagged). */
export interface BdTransitionInput {
  action: string;
  status?: string;
  text?: string;
  draft?: boolean;
  dept?: string | null;
  toId?: string | number | null;
  toName?: string | null;
  note?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  customerConfirmed?: boolean;
  scheduledFor?: string | null;
  reason?: string | null;
  mom?: string | null;
  actionItems?: BdActionItem[];
  nextMeetingAt?: string | null;
  assigneeId?: string | number | null;
  assigneeName?: string | null;
  attendees?: BdAttendee[];
}

/* Re-export the status unions used across BD views for convenience. */
export type { QueryStatus, GrievanceStatus, GrievanceSeverity, MeetingStatus, BdSource };
