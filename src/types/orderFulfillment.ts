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
  | 'picked'
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

export type PaymentTerms = 'Net 30' | 'Net 45' | 'Net 60' | 'Advance' | 'COD' | 'Advance Payment';

// ═══════════════════════════════════════════════════════════
// DATA INTERFACES
// ═══════════════════════════════════════════════════════════

export interface BatchSplit {
  bmrNo: string;
  bprNo: string;
  plannedQty: number;
  fgQty: number;
  fgLocation: string | null;
  ffStatus: FFStatus;
  pickedQty: number;
  pickerName: string | null;
  pickDate: string | null;
  pickSlipNo: string | null;
  remarks: string | null;
  invoiceNo: number | null;
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
}

export interface KPIData {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  color: string;
}

export interface PipelineStage {
  key: SOStatus;
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

// ═══════════════════════════════════════════════════════════
// MODAL PROPS
// ═══════════════════════════════════════════════════════════

export interface SODetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onAction: (action: string, soNo: string) => void;
}

export interface PickModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onConfirmPick: (pickData: PickData) => void;
}

export interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onGenerateInvoice: (invoiceData: InvoiceData) => void;
}

export interface ShipModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onDispatch: (shipData: ShipData) => void;
}

export interface TrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  onConfirmDelivery: (deliveryData: DeliveryData) => void;
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
  item: {
    sku: string;
    productName: string;
    pack: string;
    orderedQty: number;
    unitPrice: number;
    bmrNo: string;
  };
}

// Alias types for consistency
export type AddSOData = NewSOData;
export type FilterChip = string;

export interface DeliveryData {
  deliveryDate: string;
  receivedBy: string;
  remarks: string;
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
