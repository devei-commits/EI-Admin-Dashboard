export type InboundGrnSourceTab = 'po' | 'transfer' | 'return';

export type InboundGrnSourceTabLabel =
  | 'GRN by PO'
  | 'GRN by Transfer Order'
  | 'GRN by Returns';

export const INBOUND_GRN_SOURCE_TABS: ReadonlyArray<{
  key: InboundGrnSourceTab;
  label: InboundGrnSourceTabLabel;
}> = [
  { key: 'po', label: 'GRN by PO' },
  { key: 'transfer', label: 'GRN by Transfer Order' },
  { key: 'return', label: 'GRN by Returns' },
];

export type GrnReceiptSourceInput = {
  receiptSource?: string | null;
  poNo?: string | null;
  purchaseOrderId?: number | string | null;
  mrnId?: number | string | null;
};

export function resolveGrnReceiptSource(grn: GrnReceiptSourceInput): InboundGrnSourceTab {
  const explicit = String(grn.receiptSource ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (explicit === 'transfer' || explicit === 'transfer_order' || explicit === 'mtr') return 'transfer';
  if (explicit === 'return' || explicit === 'returns' || explicit === 'rma') return 'return';
  if (explicit === 'po' || explicit === 'purchase_order') return 'po';

  if (grn.mrnId != null && String(grn.mrnId).trim() !== '') return 'transfer';

  // Current inbound flow: procurement PO deliveries and legacy GRNs without explicit source.
  return 'po';
}

export function matchesInboundGrnSourceTab(
  grn: GrnReceiptSourceInput,
  tab: InboundGrnSourceTab,
): boolean {
  return resolveGrnReceiptSource(grn) === tab;
}

export function inboundGrnSourceEmptyMessage(tab: InboundGrnSourceTab): string {
  if (tab === 'transfer') {
    return 'No transfer-order GRNs yet. Inbound receipts from manufacturing transfers will appear here.';
  }
  if (tab === 'return') {
    return 'No return GRNs yet. Customer or vendor return receipts will appear here.';
  }
  return 'No PO-linked GRNs found.';
}
