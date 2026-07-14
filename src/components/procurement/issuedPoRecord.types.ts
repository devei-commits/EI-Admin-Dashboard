/**
 * Shared record shape for issued/released purchase orders (vendor-grouped PO
 * dashboard + merge helpers). Extracted from the retired IssuedPOsView.
 */
import type { ProcurementRequest, DraftPOLineItem } from '../../types/procurement.types';
import type { PoStatus } from '../../constants/procurement';

export type IssuedPOViewRecord = {
  request: ProcurementRequest;
  poNumber: string;
  vendor: string;
  /** Legacy shipment-oriented status (kept for ETA / in-transit logic). */
  status: 'Draft' | 'Released' | 'In Transit' | 'At Risk';
  /** Spec §9.2 PO workflow status pill. */
  poWorkflowStatus?: PoStatus;
  etaDays: number;
  etaDateDisplay?: string;
  lineItems: DraftPOLineItem[];
  grandTotal: number;
  requestCode: string;
  createdDate: string;
  paymentTerms: string;
  backendPoId?: string;
};
