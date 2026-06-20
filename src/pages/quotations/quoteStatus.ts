/**
 * Quote lifecycle UI metadata. Mirrors the backend STATUS_FLOW in
 * src/quotations/controller.js — keep the two in sync.
 */
export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'accepted' | 'rejected';

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
  pending_approval: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
  sent: { label: 'Sent', cls: 'bg-violet-100 text-violet-700 border border-violet-200' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border border-red-200' },
};

export type Action = { to: QuoteStatus; label: string; variant: 'primary' | 'danger' | 'secondary' };

export const NEXT_ACTIONS: Record<string, Action[]> = {
  draft: [{ to: 'pending_approval', label: 'Submit for Approval', variant: 'primary' }],
  pending_approval: [
    { to: 'approved', label: 'Approve', variant: 'primary' },
    { to: 'rejected', label: 'Reject', variant: 'danger' },
    { to: 'draft', label: 'Withdraw', variant: 'secondary' },
  ],
  approved: [
    { to: 'sent', label: 'Mark as Sent', variant: 'primary' },
    { to: 'draft', label: 'Back to Draft', variant: 'secondary' },
  ],
  sent: [
    { to: 'accepted', label: 'Mark Accepted', variant: 'primary' },
    { to: 'rejected', label: 'Mark Rejected', variant: 'danger' },
  ],
  accepted: [],
  rejected: [{ to: 'draft', label: 'Reopen', variant: 'secondary' }],
};

export function statusBadge(status: string) {
  return STATUS_META[status] || STATUS_META.draft;
}
