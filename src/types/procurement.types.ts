export type RequestType = 'RM' | 'PM';
export type RequestPriority = 'High' | 'Medium' | 'Low';
export type RequestStatus = 'New' | 'Quoted' | 'PO Draft' | 'PO Released' | 'Delivery Pending' | 'Under GRN';
export type QuoteStatus = 'Confirmed' | 'Not Selected' | 'Pending Review';
export type MainTab = 'Procurement' | 'Vendors' | 'Reports';
export type SideSection = 'Overview' | 'Requests' | 'Quotations' | 'Draft POs' | 'Issued POs' | 'GRN Monitor' | 'Stock Check' | 'Item Tracker';

export type ItemDetail = {
  itemCode: string;
  itemName: string;
  reqQty: number;
  unit: string;
  moq: string;
  packSize: string;
  plannedPrice: number;
  leadTimeDays: number;
  estValue: number;
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
  itemDetails?: ItemDetail[];
  stockSummary?: StockSummary;
};

export type QuoteLine = {
  item: string;
  qty: string;
  pricePerUnit: number;
  totalValue: number;
  vsPlanned: string;
};

export type VendorQuote = {
  id: string;
  requestId: string;
  requestCode: string;
  requestType: RequestType;
  vendor: string;
  status: QuoteStatus;
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
  pricePerUnit: number;
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
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
  vendorId: string;
  vendorName: string;
  poNumber: string;
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

export type ItemTrackerRow = {
  key: string;
  requestId: string;
  requestCode: string;
  type: RequestType;
  priority: RequestPriority;
  requestStatus: RequestStatus;
  itemName: string;
  itemCode: string;
  reqQty: number;
  unit: string;
  plannedPrice: number;
  plannedValue: number;
  preferredVendor: string | null;
  quotedVendor: string | null;
  actualPrice: number | null;
  actualVsPlanned: string | null;
  poNumber: string | null;
  poStatus: string | null;
  orderQty: string | null;
  advPaid: string | null;
  lrNo: string | null;
  expDelivery: string | null;
  grnRef: string | null;
  quoteId: string | null;
  draftPoId: string | null;
  poId: string | null;
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
