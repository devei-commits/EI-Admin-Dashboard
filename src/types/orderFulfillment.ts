/**
 * Order Fulfillment Types
 * All TypeScript interfaces for the Order Fulfillment module
 */

// ═══════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════

export type FFStatus =
  | 'wip'
  | 'fg_pending'
  | 'bulk_qc'
  | 'fg_ready'
  | 'picking'
  | 'invoiced'
  | 'shipped'
  | 'delivered'
  | 'closed';

export type SOStatus =
  | 'planned'
  | 'in_production'
  | 'partial'
  | 'fg_ready'
  | 'picking'
  | 'invoiced'
  | 'shipped'
  | 'delivered'
  | 'closed'
  | 'SO_New'
  | 'SO_Pending'
  | 'SO_InProd'
  | 'SO_ReadyShip'
  | 'SO_Shipped'
  | 'SO_Fulfilled';

export type Priority = 'normal' | 'high';

/** Single stored/display string (structured via `lib/paymentTermsStructured` or legacy labels). */
export type PaymentTerms = string;

// ═══════════════════════════════════════════════════════════
// DATA INTERFACES
// ═══════════════════════════════════════════════════════════

export interface BatchSplit {
  productionBatchId?: number | null;
  bmrNo: string;
  bprNo: string;
  plannedQty: number;
  fgQty: number;
  /** Production statuses (when split is linked to a production batch). */
  bmrStatus?: string | null;
  bprStatus?: string | null;
  /** Production yield numbers from the linked batch. */
  bulkYield?: number | null;
  fillYield?: number | null;
  fgYield?: number | null;
  /** Fulfillment timeline completion helpers. */
  fgOutput?: number;
  remainingQty?: number;
  completionPercent?: number;
  fgLocation: string | null;
  ffStatus: FFStatus;
  pickedQty: number;
  pickerName: string | null;
  pickDate: string | null;
  pickSlipNo: string | null;
  remarks: string | null;
  invoiceNo: string | null;
  awbNo: string | null;
  courier: string | null;
  dispatchDate: string | null;
  etaDate: string | null;
}

export interface OrderItem {
  itemNo: string;
  sku: string;
  productName: string;
  pack: string;
  orderedQty: number;
  rate: number;
  unitPrice: number;
  batchSplits: BatchSplit[];
}

export interface SaleOrder {
  id?: number;
  soNo: string;
  soDate: string;
  customer: string;
  customerCity: string;
  orderDate: string;
  dueDate: string;
  priority: Priority;
  soStatus: SOStatus;
  soValue: number;
  shipAddress: string;
  paymentTerms: PaymentTerms;
  notes: string;
  invoiceNo?: string;
  invoiceDate?: string;
  awbNo?: string;
  dispatchDate?: string;
  courier?: string;
  items: OrderItem[];
}

// ═══════════════════════════════════════════════════════════
// COMPUTED TYPES
// ═══════════════════════════════════════════════════════════

export interface SOProgress {
  total: number;
  ready: number;
  shipped: number;
  readyPct: number;
  shippedPct: number;
  /** Batches (splits) that are closed (delivered & done). */
  batchesDone: number;
  /** Total batches (splits) in the order. */
  batchesTotal: number;
  /** batchesDone / batchesTotal as percentage (0–100). */
  batchesDonePct: number;
  /**
   * End-to-end fulfillment % (plan → procurement → production → pick → invoice → ship → deliver),
   * weighted by ordered qty per line and planned qty per batch. Not 100% until delivered/closed.
   */
  fulfillmentLifecyclePct: number;
}

export interface KPIData {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  color: string;
}

export interface PipelineStage {
  /** SO status keys on Fulfillment; procurement Issued POs uses `issued-0` … `issued-6`. */
  key: SOStatus | string;
  label: string;
  icon: React.ReactNode;
  count: number;
}

export interface TrackingEvent {  event: string;
  date: string;
  done: boolean;
  icon: React.ReactNode;
}

// Alias for tracking steps
export type TrackingStep = {
  label: string;
  status: 'done' | 'active' | 'pending';
  timestamp?: string;
  details?: string;
};

export interface BatchTimelineStep {
  key: 'planned' | 'in_production' | 'fg_ready' | 'picking' | 'invoiced' | 'shipped' | 'delivered';
  label: string;
  status: 'done' | 'active' | 'pending';
}

// ═══════════════════════════════════════════════════════════
// MODAL PROPS
// ═══════════════════════════════════════════════════════════

export interface SODetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  /** action, soNo, and optionally the batch split (for per-batch Pick/Invoice/Ship/Track) */
  onAction: (action: string, soNo: string, split?: BatchSplit) => void;
  onEditSO?: (soNo: string) => void;
  editDisabled?: boolean;
  editDisabledReason?: string;
}

export interface PickModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  /** May return a Promise; modal waits for it before closing so flow can open Invoice next. */
  onConfirmPick: (pickData: PickData) => void | Promise<void>;
  /** When set, only these BPR splits are shown and can be picked (single-batch pick). */
  selectedBprNos?: string[];
}

export interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  /** Called after the server creates the invoice (and Zoho when enabled). Used to refresh lists. */
  onGenerateInvoice: (invoiceData: InvoiceData) => void | Promise<void>;
  /** When set, only these BPR splits are invoiced (single-batch invoice). */
  selectedBprNos?: string[];
}

export interface ShipModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onDispatch: (shipData: ShipData) => void;
  /** When set, only these BPR splits are shipped (single-batch ship). */
  selectedBprNos?: string[];
}

export interface TrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onConfirmDelivery: (deliveryData: DeliveryData) => void;
  /** When set, only these BPR splits are shown for delivery (single-batch track). */
  selectedBprNos?: string[];
}

export interface AddSOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newSO: NewSOData) => void;
}

// ═══════════════════════════════════════════════════════════
// FORM DATA TYPES
// ═══════════════════════════════════════════════════════════

export interface PickData {
  splits: Array<{
    bprNo: string;
    pickedQty: number;
  }>;
  pickerName: string;
  pickDate: string;
  pickSlipNo: string;
  remarks: string;
}

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  courier: string;
  paymentRef: string;
  gstPercent: number;
  invoiceValue: number;
  remarks: string;
  /** When set, only these BPR splits are marked invoiced. */
  bprNos?: string[];
}

export interface ShipData {
  awbNo: string;
  courier: string;
  dispatchDate: string;
  numBoxes: number;
  totalWeight: number;
  eta: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  remarks: string;
  /** When set, only these BPR splits are marked shipped. */
  bprNos?: string[];
}

export interface NewSOItemData {
  sku: string;
  productName: string;
  pack: string;
  orderedQty: number;
  unitPrice: number;
  bmrNo: string;
}

export interface NewSOData {
  soNo: string;
  customer: string;
  customerCity: string;
  orderDate: string;
  dueDate: string;
  priority: Priority;
  shipAddress: string;
  paymentTerms: PaymentTerms;
  notes: string;
  item?: NewSOItemData;
  items?: NewSOItemData[];
}

// Alias types for consistency
export type AddSOData = NewSOData;
export type FilterChip = string;

export interface DeliveryData {
  deliveryDate: string;
  receivedBy: string;
  remarks: string;
  /** If set, only these BPR splits are marked delivered; otherwise all shipped splits. */
  bprNos?: string[];
}

// ═══════════════════════════════════════════════════════════
// COMPONENT PROPS
// ═══════════════════════════════════════════════════════════

export interface StatusBadgeProps {
  status: FFStatus | SOStatus;
  type: 'ff' | 'so';
  size?: 'sm' | 'md' | 'lg';
}

export interface KPICardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  sub?: string;
  trend?: string;
  color: string;
  onClick?: () => void;
}

export interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  filterType: 'so' | 'batch';
}

export interface SOCardProps {
  saleOrder: SaleOrder;
  progress: SOProgress;
  onViewDetails: (soNo: string) => void;
  onPick: (soNo: string) => void;
  onInvoice: (soNo: string) => void;
  onShip: (soNo: string) => void;
  onTrack: (soNo: string) => void;
}

export interface PipelineStripProps {
  stages: PipelineStage[];
  onStageClick: (stageKey: string) => void;
}

export interface StepperProps {
  steps: TrackingStep[];
}

export interface ProgressBarProps {
  percentage: number;
  label?: string;
  color?: string;
  showLabel?: boolean;
}
