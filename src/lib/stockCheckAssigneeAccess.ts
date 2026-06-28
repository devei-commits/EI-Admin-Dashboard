import { formatAssigneeShortName } from './warehouseStockCheckTableDisplay';

export function isStockCheckAssigneeOpen(assignedTo: string | null | undefined): boolean {
  const value = String(assignedTo ?? '').trim();
  return value.length === 0 || value === '—' || value.toLowerCase() === 'open';
}

export function stockCheckAssigneeNamesMatch(
  assignedTo: string | null | undefined,
  actorName: string | null | undefined,
): boolean {
  const left = String(assignedTo ?? '').trim();
  const right = String(actorName ?? '').trim();
  if (!left || !right) return false;
  if (left.toLowerCase() === right.toLowerCase()) return true;
  return (
    formatAssigneeShortName(left).toLowerCase() === formatAssigneeShortName(right).toLowerCase()
  );
}

export function canUserPerformStockCheck(
  assignedTo: string | null | undefined,
  actorName: string | null | undefined,
): boolean {
  if (!String(actorName ?? '').trim()) return false;
  if (isStockCheckAssigneeOpen(assignedTo)) return true;
  return stockCheckAssigneeNamesMatch(assignedTo, actorName);
}

export function resolveStockCheckActorName(params: {
  authName?: string | null;
  authEmail?: string | null;
  staffUsers?: Array<{ display_name?: string | null; email?: string | null }>;
}): string {
  const email = String(params.authEmail ?? '').trim().toLowerCase();
  if (email && Array.isArray(params.staffUsers)) {
    const match = params.staffUsers.find(
      (u) => String(u.email ?? '').trim().toLowerCase() === email,
    );
    const display = String(match?.display_name ?? '').trim();
    if (display) return display;
  }
  return String(params.authName ?? '').trim();
}

export function stockCheckLockedMessage(assignedTo: string | null | undefined): string {
  const name = String(assignedTo ?? '').trim();
  if (!name) return 'This stock check is assigned to another user.';
  return `Assigned to ${formatAssigneeShortName(name)} — only they can edit this stock check.`;
}
