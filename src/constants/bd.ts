/**
 * BD Management vocabulary — client tier, lifecycle, query/grievance/meeting
 * status, severity, source, event taxonomy — with tool-native light Tailwind
 * pill classes. Mirrors the constants/procurement.ts `mk()` pattern so BD reads
 * identically to the rest of the tool. Light design language ONLY (no dark HTML
 * popup chrome).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Gem, Crown, Medal, Shield,
  UserCheck, FileSignature, ClipboardList, Package, Phone, IndianRupee, Banknote,
  HelpCircle, Flag, CalendarClock, Settings2, MessageSquare, Repeat,
  Check, AlertTriangle,
} from 'lucide-react';

export type StatusTone =
  | 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'cyan' | 'orange' | 'gray';

export interface StatusStyle { text: string; bg: string; border: string; }

export const TONE_CLASSES: Record<StatusTone, StatusStyle> = {
  slate:  { text: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
  green:  { text: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
  amber:  { text: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  red:    { text: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200' },
  blue:   { text: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  violet: { text: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  cyan:   { text: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  orange: { text: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  gray:   { text: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-200' },
};

export interface StatusConfig extends StatusStyle { label: string; tone: StatusTone; }
function mk(label: string, tone: StatusTone): StatusConfig {
  return { label, tone, ...TONE_CLASSES[tone] };
}

/* ── Client tier ─────────────────────────────────────────────────────────── */
export type ClientTier = 'platinum' | 'gold' | 'silver' | 'bronze';
export const TIER_CONFIG: Record<ClientTier, StatusConfig & { icon: LucideIcon }> = {
  platinum: { ...mk('PLATINUM', 'violet'), icon: Gem },
  gold:     { ...mk('GOLD', 'amber'),      icon: Crown },
  silver:   { ...mk('SILVER', 'slate'),    icon: Medal },
  bronze:   { ...mk('BRONZE', 'orange'),   icon: Shield },
};
export const TIER_ORDER: ClientTier[] = ['platinum', 'gold', 'silver', 'bronze'];

/** Rolling-12m revenue thresholds (₹) used to DERIVE a tier when not set manually. */
export const TIER_THRESHOLDS: { tier: ClientTier; min: number }[] = [
  { tier: 'platinum', min: 1_00_00_000 }, // ≥ ₹1 Cr
  { tier: 'gold',     min: 25_00_000 },    // ₹25 L – 1 Cr
  { tier: 'silver',   min: 5_00_000 },     // ₹5 L – 25 L
  { tier: 'bronze',   min: 0 },            // < ₹5 L
];
/** Query SLA targets (hours) by tier — higher tiers get faster response. */
export const TIER_QUERY_SLA: Record<ClientTier, { responseHrs: number; resolutionHrs: number }> = {
  platinum: { responseHrs: 4,  resolutionHrs: 24 },
  gold:     { responseHrs: 8,  resolutionHrs: 48 },
  silver:   { responseHrs: 24, resolutionHrs: 96 },
  bronze:   { responseHrs: 48, resolutionHrs: 168 },
};

/* ── Client lifecycle ────────────────────────────────────────────────────── */
export type ClientLifecycle = 'prospect' | 'active' | 'dormant' | 'churn';
export const LIFECYCLE_CONFIG: Record<ClientLifecycle, StatusConfig> = {
  prospect: mk('PROSPECT', 'cyan'),
  active:   mk('ACTIVE', 'green'),
  dormant:  mk('DORMANT', 'gray'),
  churn:    mk('CHURN', 'red'),
};
/** Lifecycle auto-transition thresholds (days since last sales activity). */
export const LIFECYCLE_DORMANT_DAYS = 90;
export const LIFECYCLE_CHURN_DAYS = 365;

/* ── Source (who initiated) ──────────────────────────────────────────────── */
export type BdSource = 'customer' | 'ei';
export const SOURCE_CONFIG: Record<BdSource, StatusConfig> = {
  customer: mk('Customer', 'blue'),
  ei:       mk('EI', 'violet'),
};

/* ── Query status ────────────────────────────────────────────────────────── */
export type QueryStatus =
  | 'open' | 'escalated' | 'under_review' | 'response_drafted' | 'responded' | 'resolved' | 'reopened';
export const QUERY_STATUS_CONFIG: Record<QueryStatus, StatusConfig> = {
  open:             mk('OPEN', 'amber'),
  escalated:        mk('ESCALATED', 'orange'),
  under_review:     mk('UNDER REVIEW', 'blue'),
  response_drafted: mk('DRAFTED', 'violet'),
  responded:        mk('RESPONDED', 'cyan'),
  resolved:         mk('RESOLVED', 'green'),
  reopened:         mk('REOPENED', 'red'),
};

/* ── Grievance status + severity ─────────────────────────────────────────── */
export type GrievanceStatus =
  | 'open' | 'escalated' | 'under_review' | 'root_caused' | 'capa_initiated' | 'responded' | 'resolved' | 'reopened';
export const GRIEVANCE_STATUS_CONFIG: Record<GrievanceStatus, StatusConfig> = {
  open:           mk('OPEN', 'amber'),
  escalated:      mk('ESCALATED', 'orange'),
  under_review:   mk('UNDER REVIEW', 'blue'),
  root_caused:    mk('ROOT-CAUSED', 'violet'),
  capa_initiated: mk('CAPA', 'cyan'),
  responded:      mk('RESPONDED', 'blue'),
  resolved:       mk('RESOLVED', 'green'),
  reopened:       mk('REOPENED', 'red'),
};

export type GrievanceSeverity = 'low' | 'medium' | 'high' | 'critical';
export const SEVERITY_CONFIG: Record<GrievanceSeverity, StatusConfig> = {
  low:      mk('LOW', 'slate'),
  medium:   mk('MEDIUM', 'amber'),
  high:     mk('HIGH', 'orange'),
  critical: mk('CRITICAL', 'red'),
};
/** Grievance SLA targets (hours) by severity. */
export const SEVERITY_SLA: Record<GrievanceSeverity, { responseHrs: number; resolutionHrs: number }> = {
  critical: { responseHrs: 1,  resolutionHrs: 12 },
  high:     { responseHrs: 4,  resolutionHrs: 48 },
  medium:   { responseHrs: 24, resolutionHrs: 120 },
  low:      { responseHrs: 48, resolutionHrs: 240 },
};

/* ── Meeting status / mode / type ────────────────────────────────────────── */
export type MeetingStatus =
  | 'requested' | 'confirmed' | 'attended' | 'mom_captured' | 'closed' | 'rescheduled' | 'cancelled';
export const MEETING_STATUS_CONFIG: Record<MeetingStatus, StatusConfig> = {
  requested:    mk('REQUESTED', 'amber'),
  confirmed:    mk('CONFIRMED', 'cyan'),
  attended:     mk('ATTENDED', 'blue'),
  mom_captured: mk('MoM CAPTURED', 'violet'),
  closed:       mk('CLOSED', 'green'),
  rescheduled:  mk('RESCHEDULED', 'orange'),
  cancelled:    mk('CANCELLED', 'red'),
};
export const MEETING_MODES = [
  'Online · Zoom', 'Online · Meet', 'Online · Teams',
  'Offline · Our office', 'Offline · Client office', 'Offline · Neutral venue',
  'Phone Call', 'WhatsApp Audio', 'WhatsApp Video',
] as const;
export const MEETING_TYPES = [
  'Discovery', 'Proposal', 'Negotiation', 'Quarterly Review',
  'Issue Resolution', 'Onboarding', 'Casual / Relationship',
] as const;

/* ── Shared query/grievance categories ───────────────────────────────────── */
export const QG_CATEGORIES = [
  'Product / Formulation', 'Pricing / Commercial', 'Order / Delivery',
  'Quality / Defect', 'Documentation / Compliance', 'Payment / Invoice',
  'Packaging / Customization', 'Other',
] as const;
export const QG_RELATED_TYPES = ['None', 'Order', 'PIS', 'Product', 'Invoice', 'Meeting'] as const;

/* ── History & Comments event taxonomy (§3B) ─────────────────────────────── */
export type BdEventType =
  | 'onboarded' | 'agreement' | 'pis' | 'order' | 'meeting' | 'payment' | 'advance'
  | 'query' | 'grievance' | 'next_meeting' | 'poc_reassigned' | 'tier_changed' | 'comment';
export const EVENT_CONFIG: Record<BdEventType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  onboarded:      { label: 'Client Onboarded',        icon: UserCheck,      tone: 'green' },
  agreement:      { label: 'Agreement Signed',        icon: FileSignature,  tone: 'violet' },
  pis:            { label: 'PIS Listed',              icon: ClipboardList,  tone: 'blue' },
  order:          { label: 'Order Listed',            icon: Package,        tone: 'cyan' },
  meeting:        { label: 'Meeting',                 icon: Phone,          tone: 'amber' },
  payment:        { label: 'Payment Received',        icon: IndianRupee,    tone: 'green' },
  advance:        { label: 'Advance Received',        icon: Banknote,       tone: 'green' },
  query:          { label: 'Query',                   icon: HelpCircle,     tone: 'amber' },
  grievance:      { label: 'Grievance',               icon: Flag,           tone: 'red' },
  next_meeting:   { label: 'Next Meeting Scheduled',  icon: CalendarClock,  tone: 'blue' },
  poc_reassigned: { label: 'POC Reassigned',          icon: Repeat,         tone: 'slate' },
  tier_changed:   { label: 'Tier Changed',            icon: Settings2,      tone: 'slate' },
  comment:        { label: 'Comment',                 icon: MessageSquare,  tone: 'slate' },
};
/** Filter chips for the §3B timeline (grouped event families). */
export const EVENT_FILTER_CHIPS: { key: string; label: string; icon: LucideIcon | null; types: BdEventType[] }[] = [
  { key: 'all',        label: 'All',        icon: null,          types: [] },
  { key: 'meetings',   label: 'Meetings',   icon: Phone,         types: ['meeting', 'next_meeting'] },
  { key: 'commercial', label: 'Commercial', icon: IndianRupee,   types: ['order', 'payment', 'advance', 'pis'] },
  { key: 'issues',     label: 'Issues',     icon: Flag,          types: ['query', 'grievance'] },
  { key: 'lifecycle',  label: 'Lifecycle',  icon: Settings2,     types: ['onboarded', 'agreement', 'poc_reassigned', 'tier_changed'] },
  { key: 'comments',   label: 'Comments',   icon: MessageSquare, types: ['comment'] },
];

/* ── SLA level helper (shared pattern with procurement) ──────────────────── */
export type SlaLevel = 'ok' | 'warn' | 'bad';
export const SLA_LEVEL_CLASSES: Record<SlaLevel, string> = {
  ok:   'text-green-600',
  warn: 'text-amber-600 font-semibold',
  bad:  'text-red-600 font-bold',
};
export const SLA_LEVEL_ICON: Record<SlaLevel, LucideIcon> = { ok: Check, warn: AlertTriangle, bad: Flag };

export function slaLevelFromHours(hoursOpen: number, targetHrs: number): SlaLevel {
  if (hoursOpen > targetHrs) return 'bad';
  if (hoursOpen >= targetHrs * 0.8) return 'warn';
  return 'ok';
}

/* ── Formatters ──────────────────────────────────────────────────────────── */
/** ₹ compact: Cr / L / K. Returns '—' for null/NaN. */
export function formatINRCompact(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)} L`;
  if (abs >= 1_000)       return `₹${(n / 1_000).toFixed(1)} K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
/** DD-MMM-YYYY. Returns '—' for empty/invalid. */
export function formatDMY(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return typeof d === 'string' ? d : '—';
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}
export function daysSince(d: string | null | undefined): number | null {
  if (!d) return null;
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - dt.getTime()) / 86_400_000));
}
/** Derive a tier from rolling revenue when no manual tier is set. */
export function tierFromRevenue(revenue: number | null | undefined): ClientTier {
  const r = Number(revenue ?? 0);
  for (const t of TIER_THRESHOLDS) if (r >= t.min) return t.tier;
  return 'bronze';
}
/** Derive a lifecycle from days since last sales activity (when not manual). */
export function lifecycleFromActivity(daysSinceLastSO: number | null, hasEverOrdered: boolean): ClientLifecycle {
  if (!hasEverOrdered) return 'prospect';
  if (daysSinceLastSO == null) return 'active';
  if (daysSinceLastSO >= LIFECYCLE_CHURN_DAYS) return 'churn';
  if (daysSinceLastSO >= LIFECYCLE_DORMANT_DAYS) return 'dormant';
  return 'active';
}
