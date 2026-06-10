/** Gap qty to add to PR / PO when warehouse audit finds shortfall (system − physical − consumption). */
export function computeInventoryAuditGap(
  systemQty: number,
  physicalQty: number,
  consumptionQty: number
): number {
  const sys = Number(systemQty);
  const phys = Number(physicalQty);
  const cons = Number(consumptionQty);
  if (!Number.isFinite(sys) || !Number.isFinite(phys) || !Number.isFinite(cons)) return 0;
  const gap = sys - phys - cons;
  if (!Number.isFinite(gap)) return 0;
  return Math.round(gap * 1000) / 1000;
}

export function buildInventoryAuditRef(requestCode: string, year = new Date().getFullYear()): string {
  const digits = String(requestCode ?? '').replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `INVA-${year}-${digits}`;
}

export type InventoryAuditUiStatus =
  | 'pending'
  | 'in_progress'
  | 'audited'
  | 'awaiting_gap_approval'
  | 'gap_approved';

export function resolveInventoryAuditUiStatus(input: {
  stockCheckStatus: string;
  gapQty: number;
  gapApproved: boolean;
}): InventoryAuditUiStatus {
  const s = String(input.stockCheckStatus ?? '').trim().toLowerCase();
  if (input.gapApproved) return 'gap_approved';
  if (s === 'completed') {
    if (input.gapQty > 1e-6) return 'awaiting_gap_approval';
    return 'audited';
  }
  if (s === 'in progress') return 'in_progress';
  return 'pending';
}

export function formatInventoryAuditUiStatus(status: InventoryAuditUiStatus): string {
  switch (status) {
    case 'gap_approved':
      return 'gap approved';
    case 'awaiting_gap_approval':
      return 'awaiting gap approval';
    case 'audited':
      return 'audited';
    case 'in_progress':
      return 'in progress';
    default:
      return 'pending';
  }
}
