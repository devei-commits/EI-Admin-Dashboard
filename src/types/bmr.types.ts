export type BMRStage = 'Pending' | 'Scheduled' | 'In Production' | 'QC Review' | 'Completed';

// Warehouse & BMRBPR shared types
export interface WarehouseMaterialItem {
  material: string;
  code: string;
  required: string;
  toTransfer: number;
  whStock: number;
  status: 'Pending' | 'Picked';
  picked: boolean;
}

export interface WarehouseMaterialRequest {
  id: string;
  mrNo: string;
  bmrNo: string;
  factory: string;
  requested: string;
  requiredBy: string;
  materials: WarehouseMaterialItem[];
  status: 'Pending Pick' | 'In Transit' | 'Completed';
  dispatchedAt?: string;
  dispatchedOn?: string;
}

// BatchConfirmationModal & UpdateStockModal shared type
export interface StockMaterialItem {
  itemId: string;
  material: string;
  required: string | number;
  freeStock: number;
  incoming: number;
  status: string;
  gap?: number;
  cd: string;
}

// Dispensing & BMRBPR shared type
export interface DispensingRequest {
  id: string;
  mrNo: string;
  bmrNo: string;
  factory: string;
  dispatchedOn: string;
  schedule?: string;
  tankArea?: string;
  materials: Array<{
    material: string;
    code: string;
    required: string;
    freeStock: number;
    dispensed: number;
  }>;
  status: 'Pending Dispensing' | 'Completed';
}

// UnderProduction & BMRBPR shared type
export interface ProducingBatch {
  id: string;
  bmrNo: string;
  batch: string;
  product: string;
  units: number;
  bulkKg: number;
  schedule: string;
  tankArea: string;
  progress: number;
  status: 'Dispensed' | 'Under Production' | 'Completed';
  dispatchedOn?: string;
}

// BMR record used in BMRBPR page
export interface BMRData {
  id: string;
  bmrNo: string;
  batch: string;
  product: string;
  units: number;
  bulkKg: number;
  orderDate: string;
  delivery: string;
  mcd: string;
  impact: number;
  material: string;
  area: string;
  stage: BMRStage;
}
