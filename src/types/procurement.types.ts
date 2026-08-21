export type RequestType = 'RM' | 'PM';
export type RequestPriority = 'High' | 'Medium' | 'Low';
export type RequestStatus = 'New' | 'Quoted' | 'PO Draft' | 'PO Released' | 'Delivery Pending' | 'Under GRN';
export type QuoteStatus = 'Confirmed' | 'Not Selected' | 'Pending Review';
export type MainTab = 'Procurement';
export type SideSection =
  | 'Procurement Requests'
  | 'Purchase Orders'
  | 'Quote Requests'
  | 'Stock Audit'
  | 'GRN Tracker';

export type ItemDetail = {
  itemCode: string;
  itemName: string;
  reqQty: number;
  unit: string;
  moq: string;
  packSize: string;
  plannedPrice: number;
  /** Set when known (incl. 0). Omitted when not resolved from API/notes/vendor list. */
  leadTimeDays?: number;
  /** Expected delivery / required-by date (YYYY-MM-DD) from Planning or PR header. */
  expectedDate?: string;
  estValue: number;
  raw_material_id?: number;
  pack_material_id?: number;
  type?: 'RM' | 'PM' | 'FG';
};

export type StockSummary = {
  stockInHand: number;
  openPOQty: number;
  inTransit: number;
  openOrders: number;
};

export type ProcurementRequest = {
  id: string;
  code: string;
  description?: string;
  type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  items: string[];
  quantities?: number[];
  plannedPrices?: number[];
  units?: string[];
  specifications?: string[];
  dueDate: string;
  createdDate?: string;
  requestedBy?: string;
  source?: string;
  preferredVendor?: string;
  /** Planning batch id that raised this PR (when raised from Planning > Batches). */
  batchId?: string | null;
  itemDetails?: ItemDetail[];
  stockSummary?: StockSummary;
  /** Stock check (from procurement request view) — persisted to DB */
  stockCheckAssignedTo?: string | null;
  stockCheckStatus?: string | null;
  stockCheckDueDate?: string | null;
  stockCheckNotes?: string | null;
  /** PR notes from Planning / procurement */
  notes?: string | null;
  /** Enriched from backend: SO + product on planning line */
  planningSoNumber?: string | null;
  planningCustomerName?: string | null;
  planningProductName?: string | null;
  planningProductCode?: string | null;
  /** MRP from products.mrp_price for the planning FG product — read-only reference */
  planningProductMrp?: number | null;
};

export type QuoteLine = {
  item: string;
  /** RM/PM master code from quotation line (itemId) */
  itemId?: string;
  /** Unit label when present on the quotation line (e.g. kg, pcs). */
  unit?: string;
  qty: string;
  pricePerUnit: number;
  totalValue: number;
  vsPlanned: string;
  /** Line-level lead (days) when API provides it */
  leadTimeDays?: number;
  priceHistory?: {
    oldPrice: number;
    newPrice: number;
    changedAt: string;
    changedBy?: string | null;
    reason?: string | null;
  }[];
  raw_material_id?: number;
  pack_material_id?: number;
};

export type VendorQuote = {
  id: string;
  requestId: string;
  requestCode: string;
  requestType: RequestType;
  vendor: string;
  status: QuoteStatus;
  /** ISO / date-only from API — used to sort newest quotations first */
  createdAt?: string;
  updatedAt?: string;
  quotedOn: string;
  leadTimeDays: number;
  terms: string;
  validTill: string;
  rating: number;
  fileName: string;
  note: string;
  lines: QuoteLine[];
};

export type Vendor = {
  id: string;
  vendorCode: string;
  name: string;
  type: RequestType;
  status: string;
  rating: number;
  confirmedQuotes: number;
  posIssued: number;
  avgLeadTime: number;
  paymentTerms: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
};

export type DraftPOLineItem = {
  item: string;
  itemCode: string;
  type: RequestType;
  qty: string;
  /** Lead time in days selected from vendor quotation/Items List */
  leadTimeDays?: number;
  pricePerUnit: number;
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
  /** From persisted PO line — used for stable PR↔PO matching when splitting */
  raw_material_id?: number;
  pack_material_id?: number;
  /** UOM sent on purchase_orders.items for warehouse kg conversion (e.g. KG, G, PCS) */
  unit?: string;
};

export type DraftPO = {
  id: string;
  dpoNumber: string;
  requestId: string;
  requestCode: string;
  type: RequestType;
  vendor: string;
  vendorId: string;
  status: string;
  createdDate: string;
  createdBy: string;
  paymentTerms: string;
  expectedDelivery: string;
  deliveryAddress: string;
  vendorRating: number;
  alertMessage: string;
  alertType: string;
  lineItems: DraftPOLineItem[];
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
  /** Backend purchase_orders id (numeric string) when draft is persisted to PO table */
  backendPoId?: string;
  /** PO type picked at Draft-PO release (Flowchart §5): regular|blanket|spot|consignment|sample */
  poType?: string;
  /** Approval workflow stage from backend (Sub-flow E): under_review|approved|… */
  approvalStatus?: string | null;
};

export type POTimelineStep = {
  stage: string;
  done: boolean;
  timestamp: string | null;
  actor: string | null;
  note: string | null;
};

export type PurchaseOrder = {
  id: string;
  /** Authoritative approval stage from purchase_orders.approval_status (Sub-flow E). */
  approvalStatus?: string | null;
  approvedAt?: string | null;
  vendorId: string;
  vendorName: string;
  poNumber: string;
  /** External / display reference when distinct from poNumber (e.g. planning ref). */
  reference?: string;
  itemCount: number;
  value: number;
  date: string;
  status: string;
  etaDays: number;
  items?: string[];
  requestCode?: string;
  /** Procurement request id — for linking backend PO to request (Save request link) */
  requestId?: string;
  contactPerson?: string;
  timeline?: POTimelineStep[];
  /** Backend purchase_orders id for API (e.g. po-tracking) */
  backendPoId?: string | null;
  /** From backend form_data; used to link PO to procurement request (requestId, requestCode) */
  formData?: Record<string, unknown>;
  paymentTerms?: string;
  /** Raw line items from API (itemName, quantity, rate, tax) for DraftPO mapping */
  rawItems?: unknown[];
  expectedShipmentDate?: string;
  /** Structured line items (qty/price/GST) for the Issued PO detail modal — same shape as a Draft PO's lines. */
  lineItems?: DraftPOLineItem[];
  /** Vendor display name (duplicate of vendorName, set by openIssuedPODetail for the PO PDF). */
  vendor?: string;
  grandTotal?: number;
  createdDate?: string;
};

export type CompletedGrnLine = {
  itemName: string;
  itemCode: string;
  orderedQty: string;
  receivedQty: string;
  qcPass: string;
  qcFail: string;
  receivedDate: string;
  status: 'Completed';
};

export type CompletedGrn = {
  request: ProcurementRequest;
  vendor: string;
  poRef: string;
  grnRef: string;
  lines: CompletedGrnLine[];
};

export type StockCheckStatus = 'Assigned' | 'In Progress' | 'Completed';

export type PackagingCondition = 'Good' | 'Damaged' | 'Partially Damaged';

export type StockCheckLineData = {
  zone: string;
  rack: string;
  physicalQty: number;
  batchNo: string;
  packagingCondition: PackagingCondition;
  remarks?: string;
};

/** Context for "Release to Planned" modal: one item from a procurement request */
export type ReleaseToPlannedItem = {
  itemName: string;
  itemCode?: string;
  idx: number;
  qty: number;
  unit: string;
  spec?: string;
  plannedPrice: number;
  moq?: string;
  /** From itemDetails when available */
  reqQty?: number;
  raw_material_id?: number;
  pack_material_id?: number;
  itemType?: 'RM' | 'PM';
};

/** A planned line (before Draft PO) — vendor, qty, price, terms chosen from quotations */
export type PlannedLine = {
  requestId: string;
  requestCode: string;
  itemName: string;
  itemCode?: string;
  vendor: string;
  moqDisplay: string;
  qty: number;
  unitPrice: number;
  paymentTerms: string;
  leadTimeDays: number;
  unit: string;
};

export type LiveProcurementState = {
  requests: ProcurementRequest[];
  quotes: VendorQuote[];
  draftPOs: DraftPO[];
  completedGrns: CompletedGrn[];
   stockCheckStatuses: Record<string, StockCheckStatus>;
   stockCheckUpdates: Record<string, Record<string, StockCheckLineData>>;
  updatedAt: string;
};
