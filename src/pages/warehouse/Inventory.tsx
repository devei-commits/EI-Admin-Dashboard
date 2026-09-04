import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MapPin, Grid3x3 } from 'lucide-react';
import {
  fetchAllWarehouseLocationHistory,
  fetchStockByLocation,
  type StockByLocationPayload,
  fetchUsageStats,
  importInventorySummaryExcel,
  importMl1SihExcel,
  importMl2SihExcel,
  postWarehouseSihExcelChunk,
  type WarehouseSihExcelImportResponse,
  inventoryAdjustChangeLines,
} from '../../services/warehouseInventory.service';
import { parseWarehouseSihWorkbook, chunkWarehouseSihRows } from '../../lib/warehouseSihExcelParse';
import { useWarehouseInventory } from '../../hooks/useWarehouseInventory';
import { queryKeys } from '../../lib/queryClient';
import { fetchItemsInvolved } from '../../services/planningExtracted.service';
import {
  warehouseInventoryAvailable,
  type WarehouseLocationHistoryEntry,
  type InTransitBreakdownItem,
  type UsageStatsRow,
  type WarehouseInventoryRow,
} from '../../services/warehouseInventory.service';
import WarehouseInventorySidebar from '../../components/WarehouseInventorySidebar';
import StockByLocationPanel from '../../components/StockByLocationPanel';
import { formatQtyExact } from '../../utils/formatQty';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { PackageSearch } from 'lucide-react';
import { procBtnSecondary, procInputClass, procSelectClass, procChipClass } from '../../components/procurement/ProcSection';

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  type: 'RM' | 'PM' | 'FG/PR';
  zone: string;
  rack: string;
  whStock: number;
  whUnit: string;
  ml1Stock: number;
  ml2Stock: number;
  stockInHand: number;
  /** Usable = stockInHand − reserved (computed from API or locally) */
  available?: number;
  reserved: number;
  inTransit: number;
  underGrn?: number;
  /** In-transit lines from pending GRNs: vendor, PO id, expected date */
  inTransitBreakdown?: InTransitBreakdownItem[];
  /** Total quantity from purchase orders (vendor) */
  poQuantity?: number;
  reorderPt: number;
  avgMo: number;
  /** Display status (threshold + qc_status); may be a custom qc value */
  status: string;
  /** Stored qc_status on warehouse_inventory */
  qcStatus?: string;
  /** Item group names/codes this item belongs to (from masters) */
  itemGroupNames?: string[];
  itemGroupCodes?: string[];
  /** Backend warehouse_inventory.id for persisting adjust stock */
  warehouseInventoryId?: number;
  /** raw_material_id (RM) or pack_material_id (PM) from warehouse row */
  sourceId?: number;
  batchNumber?: string;
  expiryDate?: string;
  manufacturer?: string;
  storageCondition?: string;
  qualityGrade?: string;
}

type InventorySortColumn =
  | 'code'
  | 'name'
  | 'type'
  | 'itemGroups'
  | 'whStock'
  | 'ml1Stock'
  | 'ml2Stock'
  | 'plannedQty'
  | 'poQuantity'
  | 'inTransit'
  | 'underGrn'
  | 'stockInHand'
  | 'reserved'
  | 'reorderPt'
  | 'avgMo'
  | 'status';

type InventorySortDirection = 'asc' | 'desc';

type PlanningTotalsMap = Map<string, { plannedQty: number; totalRequired: number; unit: string }>;

function plannedOpenQtyForItem(item: InventoryItem, planningTotalsByKey: PlanningTotalsMap): number {
  const planKey =
    (item.type === 'RM' || item.type === 'PM') && item.sourceId != null && item.sourceId > 0
      ? `${item.type}-${item.sourceId}`
      : null;
  const plan = planKey ? planningTotalsByKey.get(planKey) : undefined;
  if (!plan) return 0;
  return Math.max(
    0,
    Number(plan.plannedQty || 0) -
      (Number(item.poQuantity || 0) + Number(item.inTransit || 0) + Number(item.underGrn || 0))
  );
}

function sortValueForInventoryItem(
  item: InventoryItem,
  column: InventorySortColumn,
  planningTotalsByKey: PlanningTotalsMap
): string | number {
  switch (column) {
    case 'code':
      return item.code.toLowerCase();
    case 'name':
      return item.name.toLowerCase();
    case 'type':
      return item.type;
    case 'itemGroups':
      return (item.itemGroupNames?.join(', ') || '').toLowerCase();
    case 'whStock':
      return item.whStock;
    case 'ml1Stock':
      return item.ml1Stock;
    case 'ml2Stock':
      return item.ml2Stock;
    case 'plannedQty':
      return plannedOpenQtyForItem(item, planningTotalsByKey);
    case 'poQuantity':
      return Number(item.poQuantity) || 0;
    case 'inTransit':
      return item.inTransit;
    case 'underGrn':
      return Number(item.underGrn) || 0;
    case 'stockInHand':
      return item.stockInHand;
    case 'reserved':
      return item.reserved;
    case 'reorderPt':
      return item.reorderPt;
    case 'avgMo':
      return item.avgMo;
    case 'status':
      return item.status.toLowerCase();
    default:
      return '';
  }
}

function SortableInventoryTh({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  title,
}: {
  label: string;
  column: InventorySortColumn;
  sortColumn: InventorySortColumn | null;
  sortDirection: InventorySortDirection;
  onSort: (col: InventorySortColumn) => void;
  title?: string;
}): JSX.Element {
  const active = sortColumn === column;
  return (
    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
      <button
        type="button"
        onClick={() => onSort(column)}
        title={title}
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`group inline-flex items-center gap-1 -mx-1.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          active ? 'text-brand bg-brand-soft hover:bg-brand-soft' : 'text-ink-2 hover:text-ink hover:bg-surface-3'
        }`}
      >
        {label}
        <span
          className={`text-[10px] not-italic leading-none transition-opacity duration-150 ${
            active ? 'opacity-100 text-brand' : 'opacity-0 group-hover:opacity-70 text-ink-3'
          }`}
          aria-hidden
        >
          {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

interface Location {
  id: string;
  name: string;
  zoneCode: string;
  type: string;
  area: string;
  temperature: string;
  maxCapacity: string;
  icon: string;
  createdAt: string;
}

interface Rack {
  id: string;
  zoneLocation: string;
  bayCode: string;
  rackName: string;
  levels: number;
  slotsPerLevel: number;
  condition: string;
  createdAt: string;
}

// Mock data based on the image
export const mockInventoryData: InventoryItem[] = [
  {
    id: '1',
    code: 'EI-RM-BASE-001',
    name: 'Aqua (Purified Water)',
    subtitle: 'Aqua · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A1-L2-S3',
    whStock: 390,
    whUnit: 'KG',
    ml1Stock: 120,
    ml2Stock: 60,
    stockInHand: 560,
    reserved: 200,
    inTransit: 500,
    reorderPt: 300,
    avgMo: 408,
    status: 'In Stock',
    batchNumber: 'AQ-2026-001',
    expiryDate: '2027-12-31',
    manufacturer: 'Water Treatment Co.',
    storageCondition: 'Ambient, 15-25°C',
    qualityGrade: 'Pharma Grade',
  },
  {
    id: '2',
    code: 'EI-RM-ACT-001',
    name: 'Glycerin',
    subtitle: 'Glycerin · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A1-L1-S5',
    whStock: 95,
    whUnit: 'KG',
    ml1Stock: 30,
    ml2Stock: 15,
    stockInHand: 140,
    reserved: 60,
    inTransit: 0,
    reorderPt: 80,
    avgMo: 80,
    status: 'In Stock',
    batchNumber: 'GLY-2025-089',
    expiryDate: '2028-06-30',
    manufacturer: 'ChemSupply Ltd.',
    storageCondition: 'Cool, Below 25°C',
    qualityGrade: 'USP/EP Grade',
  },
  {
    id: '3',
    code: 'EI-RM-EMUL-001',
    name: 'Cetearyl Alcohol',
    subtitle: 'Cetearyl Alcohol · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A1-L1-S1',
    whStock: 42,
    whUnit: 'KG',
    ml1Stock: 8,
    ml2Stock: 5,
    stockInHand: 55,
    reserved: 30,
    inTransit: 50,
    reorderPt: 40,
    avgMo: 28,
    status: 'In Stock',
    batchNumber: 'CA-2026-012',
    expiryDate: '2029-03-15',
    manufacturer: 'Emulsifier Corp.',
    storageCondition: 'Ambient, Dry',
    qualityGrade: 'Cosmetic Grade',
  },
  {
    id: '4',
    code: 'EI-RM-EMUL-002',
    name: 'Ceteareth-20',
    subtitle: 'Ceteareth-20 · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A2-L1-S5',
    whStock: 28,
    whUnit: 'KG',
    ml1Stock: 5,
    ml2Stock: 3,
    stockInHand: 36,
    reserved: 20,
    inTransit: 30,
    reorderPt: 25,
    avgMo: 20,
    status: 'In Stock',
    batchNumber: 'CE20-2025-145',
    expiryDate: '2028-09-20',
    manufacturer: 'Surfactant Industries',
    storageCondition: 'Ambient, 15-30°C',
    qualityGrade: 'Cosmetic Grade',
  },
  {
    id: '5',
    code: 'EI-RM-POLY-001',
    name: 'Carbomer 980',
    subtitle: 'Carbomer · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'B1-L1-S2',
    whStock: 12,
    whUnit: 'KG',
    ml1Stock: 2,
    ml2Stock: 1,
    stockInHand: 15,
    reserved: 8,
    inTransit: 20,
    reorderPt: 10,
    avgMo: 8,
    status: 'In Stock',
    batchNumber: 'CB980-2026-003',
    expiryDate: '2029-01-15',
    manufacturer: 'Polymer Solutions Inc.',
    storageCondition: 'Cool, Dry, <25°C',
    qualityGrade: 'USP Grade',
  },
  {
    id: '6',
    code: 'EI-RM-POLY-002',
    name: 'Carbopol 940',
    subtitle: 'Carbomer · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'B2-L1-S1',
    whStock: 10,
    whUnit: 'KG',
    ml1Stock: 2,
    ml2Stock: 0,
    stockInHand: 12,
    reserved: 6,
    inTransit: 0,
    reorderPt: 10,
    avgMo: 7,
    status: 'In Stock',
    batchNumber: 'CP940-2025-298',
    expiryDate: '2028-11-30',
    manufacturer: 'Polymer Solutions Inc.',
    storageCondition: 'Cool, Dry, <25°C',
    qualityGrade: 'USP Grade',
  },
  {
    id: '7',
    code: 'EI-RM-PRES-001',
    name: 'Phenoxyethanol',
    subtitle: 'Phenoxyethanol · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A2-L2-S1',
    whStock: 18,
    whUnit: 'KG',
    ml1Stock: 4,
    ml2Stock: 2,
    stockInHand: 24,
    reserved: 12,
    inTransit: 25,
    reorderPt: 15,
    avgMo: 12,
    status: 'In Stock',
    batchNumber: 'PHE-2026-056',
    expiryDate: '2028-05-31',
    manufacturer: 'Preservative Co.',
    storageCondition: 'Ambient, Protected from Light',
    qualityGrade: 'Cosmetic Grade',
  },
  {
    id: '8',
    code: 'EI-RM-EXCIP-001',
    name: 'Sodium Hydroxide 50%',
    subtitle: 'Sodium Hydroxide · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A3-L1-S1',
    whStock: 35,
    whUnit: 'KG',
    ml1Stock: 5,
    ml2Stock: 3,
    stockInHand: 43,
    reserved: 15,
    inTransit: 0,
    reorderPt: 20,
    avgMo: 15,
    status: 'In Stock',
    batchNumber: 'NAOH-2025-234',
    expiryDate: '2027-08-15',
    manufacturer: 'Chemical Industries Ltd.',
    storageCondition: 'Ambient, Dry, Ventilated',
    qualityGrade: 'Technical Grade',
  },
  {
    id: '9',
    code: 'EI-RM-EXCIP-002',
    name: 'Citric Acid Monohydrate',
    subtitle: 'Citric Acid · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A3-L1-S2',
    whStock: 22,
    whUnit: 'KG',
    ml1Stock: 3,
    ml2Stock: 2,
    stockInHand: 27,
    reserved: 10,
    inTransit: 0,
    reorderPt: 15,
    avgMo: 8,
    status: 'In Stock',
    batchNumber: 'CA-2026-078',
    expiryDate: '2029-04-30',
    manufacturer: 'Acids & Buffers Inc.',
    storageCondition: 'Ambient, Dry',
    qualityGrade: 'Food Grade',
  },
  {
    id: '10',
    code: 'EI-RM-SURF-001',
    name: 'SLES 70%',
    subtitle: 'Sodium Laureth Sulfate · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A2-L1-S3',
    whStock: 95,
    whUnit: 'KG',
    ml1Stock: 25,
    ml2Stock: 15,
    stockInHand: 135,
    reserved: 60,
    inTransit: 150,
    reorderPt: 80,
    avgMo: 75,
    status: 'In Stock',
    batchNumber: 'SLES-2026-021',
    expiryDate: '2028-02-28',
    manufacturer: 'Surfactant Industries',
    storageCondition: 'Ambient, 15-25°C',
    qualityGrade: 'Cosmetic Grade',
  },
  {
    id: '11',
    code: 'EI-RM-SURF-002',
    name: 'CAPB 35%',
    subtitle: 'Cocamidopropyl Betaine · KG',
    type: 'RM',
    zone: 'Zone A',
    rack: 'A2-L2-S3',
    whStock: 55,
    whUnit: 'KG',
    ml1Stock: 15,
    ml2Stock: 8,
    stockInHand: 78,
    reserved: 30,
    inTransit: 0,
    reorderPt: 40,
    avgMo: 38,
    status: 'In Stock',
    batchNumber: 'CAPB-2025-187',
    expiryDate: '2027-12-15',
    manufacturer: 'Mild Surfactants Co.',
    storageCondition: 'Ambient, 15-30°C',
    qualityGrade: 'Cosmetic Grade',
  },
  {
    id: '12',
    code: 'EI-PM-CONT-001',
    name: '50ml Airless Pump Bottle',
    subtitle: 'White Airless · PCS',
    type: 'PM',
    zone: 'Zone C',
    rack: 'C1-L3-S2',
    whStock: 2500,
    whUnit: 'PCS',
    ml1Stock: 500,
    ml2Stock: 300,
    stockInHand: 3300,
    reserved: 1200,
    inTransit: 5000,
    reorderPt: 2000,
    avgMo: 1500,
    status: 'In Stock',
    batchNumber: 'APB50-2026-034',
    expiryDate: 'N/A',
    manufacturer: 'PackMaster Containers',
    storageCondition: 'Ambient, Dry, Clean',
    qualityGrade: 'Premium White PP',
  },
  {
    id: '13',
    code: 'EI-PM-CONT-002',
    name: '100ml Airless Pump Bottle',
    subtitle: 'White Airless · PCS',
    type: 'PM',
    zone: 'Zone C',
    rack: 'C1-L3-S4',
    whStock: 1800,
    whUnit: 'PCS',
    ml1Stock: 400,
    ml2Stock: 200,
    stockInHand: 2400,
    reserved: 800,
    inTransit: 3000,
    reorderPt: 1500,
    avgMo: 1200,
    status: 'In Stock',
    batchNumber: 'APB100-2026-029',
    expiryDate: 'N/A',
    manufacturer: 'PackMaster Containers',
    storageCondition: 'Ambient, Dry, Clean',
    qualityGrade: 'Premium White PP',
  },
  {
    id: '14',
    code: 'EI-PM-TUBE-001',
    name: '30ml Tube with Flip Cap',
    subtitle: 'White Tube · PCS',
    type: 'PM',
    zone: 'Zone C',
    rack: 'C2-L2-S1',
    whStock: 3200,
    whUnit: 'PCS',
    ml1Stock: 800,
    ml2Stock: 400,
    stockInHand: 4400,
    reserved: 1500,
    inTransit: 2000,
    reorderPt: 2500,
    avgMo: 2000,
    status: 'In Stock',
    batchNumber: 'TUB30-2026-015',
    expiryDate: 'N/A',
    manufacturer: 'TubeTech Solutions',
    storageCondition: 'Ambient, Dry, Stacked',
    qualityGrade: 'Food-Grade PE',
  },
];

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (location: Omit<Location, 'id' | 'createdAt'>) => void;
}

const AddLocationModal: React.FC<AddLocationModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    zoneCode: '',
    type: 'raw-material',
    area: '',
    temperature: '',
    maxCapacity: '',
    icon: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Location name is required');
      return;
    }

    onAdd(formData);

    // Reset form
    setFormData({
      name: '',
      zoneCode: '',
      type: 'raw-material',
      area: '',
      temperature: '',
      maxCapacity: '',
      icon: '',
    });

    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="default">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl border border-border" role="dialog" aria-modal="true" aria-labelledby="add-location-modal-title" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 id="add-location-modal-title" className="text-2xl font-bold text-ink">Add New Warehouse Location</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-3 border border-border text-ink-2 hover:text-ink hover:border-border transition-colors"
            aria-label="Close"
          >
            X
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Location Name */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Location Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="e.g. Solvent Store"
                  required
                />
              </div>

              {/* Zone Code */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Zone Code
                </label>
                <input
                  type="text"
                  name="zoneCode"
                  value={formData.zoneCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="e.g. Zone F"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink"
                >
                  <option value="raw-material">Raw Material</option>
                  <option value="packaging">Packaging Material</option>
                  <option value="finished-goods">Finished Goods</option>
                  <option value="actives">Actives Store</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Area (SQM) */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Area (SQM)
                </label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="100"
                />
              </div>
            </div>

            {/* Temperature / Storage Conditions */}
            <div>
              <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                Temperature / Storage Conditions
              </label>
              <input
                type="text"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                placeholder="e.g. Ambient 15-30°C"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Max Capacity */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Max Capacity (KG / UNITS)
                </label>
                <input
                  type="text"
                  name="maxCapacity"
                  value={formData.maxCapacity}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="500"
                />
              </div>

              {/* Icon (Emoji) */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Icon
                </label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder=""
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-surface border border-border rounded-lg text-ink-2 hover:bg-surface-2 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-press font-medium transition-colors"
            >
              Add Location
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

interface AddRackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (rack: Omit<Rack, 'id' | 'createdAt'>) => void;
  locations: Location[];
}

const AddRackModal: React.FC<AddRackModalProps> = ({ isOpen, onClose, onAdd, locations }) => {
  const [formData, setFormData] = useState({
    zoneLocation: '',
    bayCode: '',
    rackName: '',
    levels: 4,
    slotsPerLevel: 4,
    condition: 'ambient',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.zoneLocation || !formData.bayCode) {
      alert('Zone/Location and Bay Code are required');
      return;
    }

    onAdd(formData);

    // Reset form
    setFormData({
      zoneLocation: '',
      bayCode: '',
      rackName: '',
      levels: 4,
      slotsPerLevel: 4,
      condition: 'ambient',
    });

    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setFormData(prev => ({
      ...prev,
      [e.target.name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="default">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xl border border-border" role="dialog" aria-modal="true" aria-labelledby="add-rack-modal-title" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 id="add-rack-modal-title" className="text-2xl font-bold text-ink">Add New Rack / Bay</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-3 border border-border text-ink-2 hover:text-ink hover:border-border transition-colors"
            aria-label="Close"
          >
            X
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Zone / Location */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Zone / Location *
                </label>
                <select
                  name="zoneLocation"
                  value={formData.zoneLocation}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink"
                  required
                >
                  <option value="">Select location</option>
                  {locations.length > 0 ? (
                    locations.map(loc => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} {loc.zoneCode && `(${loc.zoneCode})`}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="RM Store">RM Store</option>
                      <option value="Actives Store">Actives Store</option>
                      <option value="Primary Pack Store">Primary Pack Store</option>
                      <option value="Labels Store">Labels Store</option>
                      <option value="Secondary Pack Store">Secondary Pack Store</option>
                      <option value="Finished Goods Store">Finished Goods Store</option>
                    </>
                  )}
                </select>
              </div>

              {/* Bay Code */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Bay Code *
                </label>
                <input
                  type="text"
                  name="bayCode"
                  value={formData.bayCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="e.g. F1"
                  required
                />
              </div>
            </div>

            {/* Rack Name */}
            <div>
              <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                Rack Name
              </label>
              <input
                type="text"
                name="rackName"
                value={formData.rackName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                placeholder="e.g. Bay F1 — Ambient Shelf"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* No. of Levels */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  No. of Levels
                </label>
                <input
                  type="number"
                  name="levels"
                  value={formData.levels}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="4"
                  min="1"
                />
              </div>

              {/* Slots per Level */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Slots per Level
                </label>
                <input
                  type="number"
                  name="slotsPerLevel"
                  value={formData.slotsPerLevel}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink placeholder-ink-4"
                  placeholder="4"
                  min="1"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider mb-2">
                  Condition
                </label>
                <select
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand text-ink"
                >
                  <option value="ambient">Ambient</option>
                  <option value="cool">Cool</option>
                  <option value="cold">Cold</option>
                  <option value="climate-controlled">Climate Controlled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-surface border border-border rounded-lg text-ink-2 hover:bg-surface-2 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-press font-medium transition-colors"
            >
              Add Rack
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

/** Cell that shows stock value; click opens where in warehouse (location/racks) */
function StockLocationCell({
  item,
  type,
  value,
  className,
  onShowLocations,
}: {
  item: InventoryItem;
  type: 'wh' | 'ml1' | 'ml2';
  value: string;
  className: string;
  onShowLocations: (item: InventoryItem, type: 'wh' | 'ml1' | 'ml2') => void;
}) {
  const canShow = item.warehouseInventoryId != null;

  return (
    <button
      type="button"
      className={className}
      title={
        canShow
          ? type === 'wh'
            ? 'Click to see WH stock distribution by zone and rack'
            : 'Click to see manufacturing stock by location'
          : undefined
      }
      disabled={!canShow}
      onClick={(e) => {
        e.stopPropagation();
        if (canShow) onShowLocations(item, type);
      }}
    >
      <span className="font-semibold text-sm">{value}</span>
    </button>
  );
}

/** Map API row to InventoryItem for table/sidebar */
function rowToInventoryItem(row: WarehouseInventoryRow): InventoryItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    subtitle: row.subtitle,
    type: row.type,
    sourceId: Number(row.sourceId) > 0 ? Number(row.sourceId) : undefined,
    zone: row.zone,
    rack: row.rack,
    whStock: row.whStock,
    whUnit: row.whUnit,
    ml1Stock: row.ml1Stock,
    ml2Stock: row.ml2Stock,
    stockInHand: row.stockInHand,
    available:
      row.available != null && Number.isFinite(Number(row.available))
        ? Math.max(0, Number(row.available))
        : warehouseInventoryAvailable(row.stockInHand, row.reserved),
    reserved: row.reserved,
    inTransit: row.inTransit,
    underGrn: Number(row.underGrn) || 0,
    inTransitBreakdown: row.inTransitBreakdown,
    poQuantity: row.poQuantity,
    reorderPt: row.reorderPt,
    avgMo: row.avgMo,
    status: row.status,
    qcStatus: row.qcStatus,
    batchNumber: row.batchNumber ?? undefined,
    expiryDate: row.expiryDate ?? undefined,
    itemGroupNames: row.itemGroupNames,
    itemGroupCodes: row.itemGroupCodes,
    warehouseInventoryId: row.warehouseInventoryId,
  };
}

const WarehouseInventory = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: whQueryData,
    isLoading: whLoading,
    isError: whIsError,
    error: whQueryError,
    refetch: refetchWarehouseInventory,
  } = useWarehouseInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'RM' | 'PM' | 'FG/PR' | 'Low'>('All');
  const [viewMode, setViewMode] = useState<'current' | 'history' | 'usage'>('current');
  const [itemGroupFilter, setItemGroupFilter] = useState<string>('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<InventorySortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<InventorySortDirection>('asc');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const inventoryData = useMemo(
    () => (whQueryData?.rows ?? []).map(rowToInventoryItem),
    [whQueryData?.rows]
  );
  const itemGroups = useMemo(
    () =>
      (whQueryData?.itemGroups ?? []).map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name || g.code,
      })),
    [whQueryData?.itemGroups]
  );
  const loading = whLoading;
  const error =
    whIsError && whQueryError instanceof Error
      ? whQueryError.message
      : whIsError
        ? 'Failed to load inventory'
        : null;
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [historyRows, setHistoryRows] = useState<WarehouseLocationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usageRows, setUsageRows] = useState<UsageStatsRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [inTransitPopoverItem, setInTransitPopoverItem] = useState<InventoryItem | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [locationPopover, setLocationPopover] = useState<{
    item: InventoryItem;
    type: 'wh' | 'ml1' | 'ml2';
  } | null>(null);
  const [stockByLocation, setStockByLocation] = useState<StockByLocationPayload | null>(null);
  const [stockByLocationLoading, setStockByLocationLoading] = useState(false);
  const [openSidebarInEditMode, setOpenSidebarInEditMode] = useState(false);
  /** Planning Items Involved totals keyed as RM-{id} / PM-{id} (matches warehouse sourceId). */
  const [planningTotalsByKey, setPlanningTotalsByKey] = useState<Map<string, { plannedQty: number; totalRequired: number; unit: string }>>(
    () => new Map()
  );
  const inventorySummaryFileRef = useRef<HTMLInputElement>(null);
  const mainWarehouseSihFileRef = useRef<HTMLInputElement>(null);
  const ml1SihFileRef = useRef<HTMLInputElement>(null);
  const ml2SihFileRef = useRef<HTMLInputElement>(null);
  const [importingInventoryExcel, setImportingInventoryExcel] = useState(false);
  const [importingSihBucket, setImportingSihBucket] = useState<'warehouse' | 'ml1' | 'ml2' | null>(null);
  /** Percent complete for the chunked main-warehouse SIH upload (null when not running). */
  const [mainWarehouseSihPercent, setMainWarehouseSihPercent] = useState<number | null>(null);
  const WAREHOUSE_SIH_CHUNK_SIZE = 200;

  const formatSihImportResult = (label: string, res: WarehouseSihExcelImportResponse) => {
    const s = res.summary;
    return [
      `${label}: processed ${res.rows_total ?? 0} row(s) from "${res.sheet_name ?? 'sheet'}".`,
      `RM: ${s?.rm_updated ?? 0}, PM: ${s?.pm_updated ?? 0}, PR: ${s?.pr_updated ?? 0} updated`,
      s?.created ? `(${s.created} new warehouse rows)` : '',
      `Skipped: ${s?.skipped ?? 0}, Errors: ${s?.errors ?? 0}`,
    ]
      .filter(Boolean)
      .join(' ');
  };

  /**
   * Console-logs the per-row detail from a `details=1` SIH/Inventory Excel import — skipped rows
   * (invalid SIH, no sku/item_name match, etc.) and error rows (ambiguous match, write failure),
   * each with its Excel row number and reason. The alert() above only ever showed aggregate counts;
   * this is what actually lets someone find which rows to fix without re-uploading with guesses.
   */
  const logSihImportRowDetails = (label: string, rowLog?: Array<Record<string, unknown>>) => {
    if (!Array.isArray(rowLog) || rowLog.length === 0) return;
    const skipped = rowLog.filter((r) => r.action === 'skipped');
    const errored = rowLog.filter((r) => r.action === 'error');
    if (skipped.length > 0) {
      console.groupCollapsed(`[${label}] Skipped rows (${skipped.length})`);
      console.table(skipped);
      console.groupEnd();
    }
    if (errored.length > 0) {
      console.groupCollapsed(`[${label}] Error rows (${errored.length})`);
      console.table(errored);
      console.groupEnd();
    }
    if (skipped.length === 0 && errored.length === 0) {
      console.log(`[${label}] Row log: all ${rowLog.length} row(s) processed cleanly.`, rowLog);
    }
  };

  const handleInventorySummaryExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingInventoryExcel(true);
    try {
      const res = await importInventorySummaryExcel(file, { details: true });
      alert(formatSihImportResult('Zoho Inventory Summary', res));
      logSihImportRowDetails('Zoho Inventory Summary', res.row_log);
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      refetchWarehouseInventory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inventory Excel import failed';
      alert(message);
    } finally {
      setImportingInventoryExcel(false);
    }
  };

  const handleSihBucketExcelChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bucket: 'warehouse' | 'ml1' | 'ml2',
    importer: (file: File, options?: { details?: boolean }) => Promise<WarehouseSihExcelImportResponse>,
    label: string
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingSihBucket(bucket);
    try {
      const res = await importer(file, { details: true });
      alert(formatSihImportResult(label, res));
      logSihImportRowDetails(label, res.row_log);
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      refetchWarehouseInventory();
    } catch (err) {
      const message = err instanceof Error ? err.message : `${label} import failed`;
      alert(message);
    } finally {
      setImportingSihBucket(null);
    }
  };

  /**
   * Chunked main-warehouse SIH upload: parses the workbook in the browser (see
   * src/lib/warehouseSihExcelParse.ts) and POSTs bounded row batches, so a large file never
   * produces one long-running request that can time out / appear stuck.
   */
  const handleMainWarehouseSihExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingSihBucket('warehouse');
    setMainWarehouseSihPercent(0);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWarehouseSihWorkbook(buffer);
      if ('error' in parsed) {
        alert(parsed.error);
        return;
      }
      const { sheetName, rows } = parsed;
      if (rows.length === 0) {
        alert(`No data rows found on "${sheetName}". Need sku (or item_name) and SIH.`);
        return;
      }

      const chunks = chunkWarehouseSihRows(rows, WAREHOUSE_SIH_CHUNK_SIZE);
      const aggregated = {
        rm_updated: 0, pm_updated: 0, pr_updated: 0, created: 0, skipped: 0, errors: 0,
        row_log: [] as Array<Record<string, unknown>>,
      };

      for (let i = 0; i < chunks.length; i += 1) {
        const res = await postWarehouseSihExcelChunk({
          rows: chunks[i],
          chunk_index: i,
          chunk_total: chunks.length,
          details: true,
        });
        const s = res.summary;
        aggregated.rm_updated += s?.rm_updated ?? 0;
        aggregated.pm_updated += s?.pm_updated ?? 0;
        aggregated.pr_updated += s?.pr_updated ?? 0;
        aggregated.created += s?.created ?? 0;
        aggregated.skipped += s?.skipped ?? 0;
        aggregated.errors += s?.errors ?? 0;
        if (res.row_log?.length) aggregated.row_log.push(...res.row_log);
        setMainWarehouseSihPercent(res.percent_complete ?? Math.round(((i + 1) / chunks.length) * 100));
      }

      alert(
        formatSihImportResult('Main warehouse SIH', {
          sheet_name: sheetName,
          rows_total: rows.length,
          summary: aggregated,
        })
      );
      logSihImportRowDetails('Main warehouse SIH', aggregated.row_log);
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      refetchWarehouseInventory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Main warehouse SIH import failed';
      alert(message);
    } finally {
      setImportingSihBucket(null);
      setMainWarehouseSihPercent(null);
    }
  };
  useEffect(() => {
    if (!locationPopover || locationPopover.item.warehouseInventoryId == null) {
      setStockByLocation(null);
      setStockByLocationLoading(false);
      return;
    }
    let cancelled = false;
    setStockByLocationLoading(true);
    setStockByLocation(null);
    fetchStockByLocation(locationPopover.item.warehouseInventoryId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setStockByLocation(res.data);
      })
      .finally(() => {
        if (!cancelled) setStockByLocationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationPopover?.item?.id, locationPopover?.item?.warehouseInventoryId]);

  useEffect(() => {
    if (typeof console !== 'undefined' && console.log && inventoryData.length > 0) {
      console.log('[Warehouse Inventory] Loaded', { count: inventoryData.length, sample: inventoryData[0] });
    }
  }, [inventoryData]);

  // After BMR dispensing / MTR / GRN / procurement PO release on another tab, refresh when user returns.
  useEffect(() => {
    // Intentionally disabled: this can trigger repeated refetches of
    // `/api/v1/warehouse-inventory` which in turn recomputes warehouse reserved.
    // Use explicit refresh actions instead of automatic visibility polling.
    return undefined;
  }, [refetchWarehouseInventory]);

  useEffect(() => {
    let cancelled = false;
    fetchItemsInvolved({ includeZeroRequired: true })
      .then((rows) => {
        if (cancelled) return;
        const m = new Map<string, { plannedQty: number; totalRequired: number; unit: string }>();
        for (const r of rows) {
          if (r.type === 'RM' && r.raw_material_id != null) {
            m.set(`RM-${Number(r.raw_material_id)}`, {
              plannedQty: Number(r.plannedQty) || 0,
              totalRequired: Number(r.totalRequired) || 0,
              unit: String(r.unit || 'KG'),
            });
          }
          if (r.type === 'PM' && r.pack_material_id != null) {
            m.set(`PM-${Number(r.pack_material_id)}`, {
              plannedQty: Number(r.plannedQty) || 0,
              totalRequired: Number(r.totalRequired) || 0,
              unit: String(r.unit || 'PCS'),
            });
          }
        }
        setPlanningTotalsByKey(m);
      })
      .catch(() => {
        if (!cancelled) setPlanningTotalsByKey(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load consolidated movement history when the History tab is first opened
  useEffect(() => {
    if (viewMode !== 'history') return;
    if (historyRows.length > 0) return;

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    fetchAllWarehouseLocationHistory()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setHistoryRows(res.data.history || []);
        } else {
          setHistoryError(String(res.error || 'Failed to load inventory history'));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err?.message || 'Failed to load inventory history');
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, historyRows.length]);

  // Load usage stats when the Usage tab is first opened
  useEffect(() => {
    if (viewMode !== 'usage') return;

    let cancelled = false;
    setUsageLoading(true);
    fetchUsageStats()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setUsageRows(res.data.rows || []);
        else setUsageRows([]);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => { cancelled = true; };
  }, [viewMode]);

  const handleItemUpdatedFromSidebar = (updated: InventoryItem) => {
    setSelectedItem(updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
  };

  const addLocation = (locationData: Omit<Location, 'id' | 'createdAt'>) => {
    const newLocation: Location = {
      ...locationData,
      id: `loc-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setLocations(prev => [...prev, newLocation]);
  };

  const addRack = (rackData: Omit<Rack, 'id' | 'createdAt'>) => {
    const newRack: Rack = {
      ...rackData,
      id: `rack-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setRacks(prev => [...prev, newRack]);
  };

  // Filter and search logic
  const filteredItems = useMemo(() => {
    let items = inventoryData;

    // Apply type filter
    if (activeFilter === 'RM') {
      items = items.filter(item => item.type === 'RM');
    } else if (activeFilter === 'PM') {
      items = items.filter(item => item.type === 'PM');
    } else if (activeFilter === 'FG/PR') {
      items = items.filter(item => item.type === 'FG/PR');
    } else if (activeFilter === 'Low') {
      items = items.filter(item => item.status === 'Low Stock' || item.status === 'Critical');
    }

    // Apply item group filter
    if (itemGroupFilter) {
      items = items.filter(
        item => item.itemGroupCodes?.includes(itemGroupFilter) || item.itemGroupNames?.includes(itemGroupFilter)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        item =>
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          item.subtitle.toLowerCase().includes(query)
      );
    }

    return items;
  }, [searchQuery, activeFilter, itemGroupFilter, inventoryData]);

  const sortedItems = useMemo(() => {
    if (!sortColumn) return filteredItems;
    const rows = [...filteredItems];
    rows.sort((a, b) => {
      const av = sortValueForInventoryItem(a, sortColumn, planningTotalsByKey);
      const bv = sortValueForInventoryItem(b, sortColumn, planningTotalsByKey);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (cmp === 0) cmp = a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredItems, sortColumn, sortDirection, planningTotalsByKey]);

  const toggleInventorySort = (column: InventorySortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  useEffect(() => {
    // Keep pagination consistent with filters/search/sort.
    setCurrentPage(1);
  }, [searchQuery, activeFilter, itemGroupFilter, pageSize, sortColumn, sortDirection]);

  const totalFiltered = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedItems = sortedItems.slice(startIndex, startIndex + pageSize);

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = inventoryData.length;
    const inStock = inventoryData.filter(item => item.status === 'In Stock').length;
    const lowStock = inventoryData.filter(item => item.status === 'Low Stock').length;
    const critical = inventoryData.filter(item => item.status === 'Critical' || item.status === 'Out of Stock').length;
    const fgUnderQc = 0; // Backend has no FG-under-QC count yet; derive from inventory/QC API when available
    const inTransit = inventoryData.filter(item => item.inTransit > 0).length;

    return { total, inStock, lowStock, critical, fgUnderQc, inTransit };
  }, [inventoryData]);

  // Count by type
  const counts = useMemo(() => {
    const all = inventoryData.length;
    const rm = inventoryData.filter(item => item.type === 'RM').length;
    const pm = inventoryData.filter(item => item.type === 'PM').length;
    const fgpr = inventoryData.filter(item => item.type === 'FG/PR').length;
    const low = inventoryData.filter(item => item.status === 'Low Stock' || item.status === 'Critical').length;

    return { all, rm, pm, fgpr, low };
  }, [inventoryData]);

  const filteredHistoryRows = useMemo(() => {
    let rows = historyRows;

    // Type filter (RM / PM / FG/PR)
    if (activeFilter === 'RM') {
      rows = rows.filter((row) => row.itemType === 'RM');
    } else if (activeFilter === 'PM') {
      rows = rows.filter((row) => row.itemType === 'PM');
    } else if (activeFilter === 'FG/PR') {
      rows = rows.filter((row) => row.itemType === 'FG/PR');
    }

    // Text search across code, name, subtitle and locations
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((row) => {
        const adjustText =
          row.actionType === 'INVENTORY_ADJUST' ? inventoryAdjustChangeLines(row.changesJson).join(' ') : '';
        const fields = [
          row.code || '',
          row.name || '',
          row.subtitle || '',
          row.fromZone || '',
          row.fromRack || '',
          row.toZone || '',
          row.toRack || '',
          row.note || '',
          adjustText,
        ]
          .join(' ')
          .toLowerCase();
        return fields.includes(q);
      });
    }

    return rows;
  }, [historyRows, activeFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Stock':
        return <span className="px-2 py-1 bg-ok-soft text-ok text-xs font-medium rounded">In Stock</span>;
      case 'Low Stock':
        return <span className="px-2 py-1 bg-warn-soft text-warn text-xs font-medium rounded">Low Stock</span>;
      case 'Critical':
        return <span className="px-2 py-1 bg-err-soft text-err text-xs font-medium rounded">Critical</span>;
      case 'Out of Stock':
        return <span className="px-2 py-1 bg-surface-3 text-ink-2 text-xs font-medium rounded">Out of Stock</span>;
      default:
        return <span className="px-2 py-1 bg-surface-3 text-ink-2 text-xs font-medium rounded">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    return <span className="px-2 py-1 bg-brand-soft text-brand text-xs font-medium rounded">{type}</span>;
  };

  return (
    <div className="flex-1 overflow-auto bg-canvas">
      {/* Summary Cards — matches the Overview card style for a consistent warehouse look */}
      <div className="border-b border-border p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total SKUs', value: stats.total, sub: 'RM + PM + Finished Goods' },
            { label: 'In Stock', value: stats.inStock, sub: 'Items available' },
            { label: 'Low Stock', value: stats.lowStock, sub: 'Below threshold' },
            { label: 'Critical / Out', value: stats.critical, sub: 'Needs attention' },
            { label: 'FG Under QC', value: stats.fgUnderQc, sub: 'batches pending release' },
            { label: 'In Transit', value: stats.inTransit, sub: 'RM/PM orders' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">{c.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink tabular-nums">{c.value}</p>
              <p className="text-xs text-ink-3 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="sticky top-0 bg-surface border-b border-border z-10">
        <div className="p-6">
          {/* View mode + filter tabs */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-ink">
                {viewMode === 'current' ? 'Inventory' : viewMode === 'history' ? 'Inventory History' : 'Usage'}
              </h1>
              <div className="flex items-center gap-2 flex-wrap justify-end">
              {viewMode === 'current' && (
                <>
                  <input
                    ref={inventorySummaryFileRef}
                    type="file"
                    accept=".xlsx,.xlsm"
                    className="hidden"
                    onChange={handleInventorySummaryExcelChange}
                  />
                  <input
                    ref={mainWarehouseSihFileRef}
                    type="file"
                    accept=".xlsx,.xlsm"
                    className="hidden"
                    onChange={handleMainWarehouseSihExcelChange}
                  />
                  <input
                    ref={ml1SihFileRef}
                    type="file"
                    accept=".xlsx,.xlsm"
                    className="hidden"
                    onChange={(e) => handleSihBucketExcelChange(e, 'ml1', importMl1SihExcel, 'ML1 SIH')}
                  />
                  <input
                    ref={ml2SihFileRef}
                    type="file"
                    accept=".xlsx,.xlsm"
                    className="hidden"
                    onChange={(e) => handleSihBucketExcelChange(e, 'ml2', importMl2SihExcel, 'ML2 SIH')}
                  />
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => inventorySummaryFileRef.current?.click()}
                    className={procBtnSecondary}
                    title="Zoho Inventory Summary export"
                  >
                    {importingInventoryExcel ? 'Importing…' : 'Zoho stock Excel'}
                  </button>
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => mainWarehouseSihFileRef.current?.click()}
                    className={procBtnSecondary}
                    title="Main warehouse workbook — CONSOLIDATED SIH sheet with sku, item_name, SIH"
                  >
                    {importingSihBucket === 'warehouse'
                      ? `Importing… ${mainWarehouseSihPercent ?? 0}%`
                      : 'Upload WH SIH'}
                  </button>
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => ml1SihFileRef.current?.click()}
                    className={procBtnSecondary}
                    title="ML1 workbook — STOCK IN HAND sheet: sku, item_name, PHYSICAL QTY"
                  >
                    {importingSihBucket === 'ml1' ? 'Importing…' : 'Upload ML1 SIH'}
                  </button>
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => ml2SihFileRef.current?.click()}
                    className={procBtnSecondary}
                    title="ML2 workbook — Sheet3 with sku, item_name, SIH"
                  >
                    {importingSihBucket === 'ml2' ? 'Importing…' : 'Upload ML2 SIH'}
                  </button>
                </>
              )}
              <div className="inline-flex rounded-lg border border-border bg-surface-3 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('current')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'current'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-2 hover:text-ink'
                    }`}
                >
                  Main Inventory
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('history')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'history'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-2 hover:text-ink'
                    }`}
                >
                  Inventory History
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('usage')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'usage'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-2 hover:text-ink'
                    }`}
                >
                  Usage
                </button>
              </div>
              </div>
            </div>

            {viewMode === 'current' && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {[
                  { key: 'All', label: `All (${counts.all})` },
                  { key: 'RM', label: `RM (${counts.rm})` },
                  { key: 'PM', label: `PM (${counts.pm})` },
                  { key: 'FG/PR', label: `FG/PR (${counts.fgpr})` },
                  { key: 'Low', label: `△ Low (${counts.low})` },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key as any)}
                    className={procChipClass(activeFilter === filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
                {/* Item groups filter */}
                <label className="sr-only" htmlFor="item-group-filter">Filter by item group</label>
                <select
                  id="item-group-filter"
                  value={itemGroupFilter}
                  onChange={(e) => setItemGroupFilter(e.target.value)}
                  className={procSelectClass}
                >
                  <option value="">All item groups</option>
                  {itemGroups.map((g) => (
                    <option key={g.id} value={g.code}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {viewMode === 'history' && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {[
                  { key: 'All', label: 'All' },
                  { key: 'RM', label: 'RM only' },
                  { key: 'PM', label: 'PM only' },
                  { key: 'FG/PR', label: 'FG/PR only' },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key as any)}
                    className={procChipClass(activeFilter === filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search and Action Buttons */}
          {viewMode === 'current' && (
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-4 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search item, code, category..."
                  aria-label="Search item, code, category"
                  className={`${procInputClass} pl-10`}
                />
              </div>
              <button
                onClick={() => navigate('/facility-management')}
                className={procBtnSecondary}
                title="Manage areas/zones in Facility Management"
              >
                <MapPin className="w-4 h-4" />
                Manage Areas
              </button>
              <button
                onClick={() => navigate('/facility-management')}
                className={procBtnSecondary}
                title="Manage racks in Facility Management"
              >
                <Grid3x3 className="w-4 h-4" />
                Manage Racks
              </button>
            </div>
          )}

          {viewMode === 'history' && (
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-4 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search history by item, code, zone, rack..."
                  aria-label="Search history by item, code, zone, rack"
                  className={`${procInputClass} pl-10`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Table / History view */}
      <div className="p-6">
        {error && viewMode === 'current' && (
          <div className="mb-4 p-4 rounded-lg bg-err-soft border border-err-soft text-err text-sm">
            {error}
          </div>
        )}
        {loading && viewMode === 'current' ? (
          <div className="py-4">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : viewMode === 'history' ? (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Inventory History</h2>
            {historyError && (
              <div className="mb-4 p-3 rounded-lg bg-err-soft border border-err-soft text-err text-sm">
                {historyError}
              </div>
            )}
            {historyLoading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : filteredHistoryRows.length === 0 ? (
              <EmptyState title="No internal movements recorded yet." />
            ) : (
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full">
                  <thead className="bg-surface-2 border-b border-border sticky top-0 z-20 [&_th]:bg-surface-2">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        Item
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        From (Zone / Rack)
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        To (Zone / Rack)
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        Action
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        Reserved / Batch
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        Qty Δ
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wider">
                        Moved At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {filteredHistoryRows.map((row) => {
                      const adjustLines =
                        row.actionType === 'INVENTORY_ADJUST'
                          ? inventoryAdjustChangeLines(row.changesJson)
                          : [];
                      return (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-ink">
                            {row.code || '—'}{row.name ? ` — ${row.name}` : ''}
                          </div>
                          {row.subtitle && (
                            <div className="text-xs text-ink-3">{row.subtitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getTypeBadge(row.itemType)}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2">
                          <div>{row.fromZone || '—'}</div>
                          <div className="text-xs text-ink-3">{row.fromRack || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2">
                          <div>{row.toZone || '—'}</div>
                          <div className="text-xs text-ink-3">{row.toRack || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2">
                          {row.actionType === 'INVENTORY_ADJUST'
                            ? 'Inventory adjust'
                            : row.actionType === 'BMR_RESERVED' || row.actionType === 'BPR_RESERVED'
                              ? `Reserved (${row.actionType === 'BMR_RESERVED' ? 'BMR' : 'BPR'})`
                              : (row.actionType || 'Move')}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2 max-w-md">
                          {row.actionType === 'INVENTORY_ADJUST' ? (
                            <div className="space-y-1">
                              {adjustLines.length > 0 ? (
                                <ul className="list-disc list-inside text-xs text-ink-2">
                                  {adjustLines.map((line, i) => (
                                    <li key={i}>{line}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-ink-4">—</span>
                              )}
                              {row.note ? (
                                <div className="text-xs text-ink-2">
                                  <span className="font-medium">Note:</span> {row.note}
                                </div>
                              ) : null}
                            </div>
                          ) : (row.actionType === 'BMR_RESERVED' || row.actionType === 'BPR_RESERVED') ? (
                            <span className="text-warn font-medium">
                              +{row.reservedDelta ?? row.qtyDelta ?? 0} → {row.reservedAfter ?? '—'}{' '}
                              {row.batchNo ? `· ${row.batchNo}` : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2">
                          {row.qtyDelta != null ? row.qtyDelta : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2">
                          {new Date(row.movedAt).toLocaleString()}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : viewMode === 'usage' ? (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Usage (consumption) — avg per period</h2>
            {usageLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : usageRows.length === 0 ? (
              <EmptyState title="No usage data yet (from movement history)." />
            ) : (
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full">
                  <thead className="bg-surface-2 border-b border-border sticky top-0 z-20 [&_th]:bg-surface-2">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Code</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Name</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Type</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Avg/Day</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Avg/Week</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Avg/Month</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Avg/Quarter</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Avg/Year</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Total (all time)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {usageRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium text-ink">{row.code || row.id}</td>
                        <td className="px-4 py-3 text-ink-2">{row.name || '—'}</td>
                        <td className="px-4 py-3">{row.type}</td>
                        <td className="px-4 py-3 text-sm text-ink-2">{Number(row.avgDay).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-ink-2">{Number(row.avgWeek).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-ink-2">{Number(row.avgMonth).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-ink-2">{Number(row.avgQuarter).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-ink-2">{Number(row.avgYear).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-ink">{Number(row.totalAllTime).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full">
                  <thead className="bg-surface-2 border-b border-border sticky top-0 z-20 [&_th]:bg-surface-2">
                    <tr>
                      <SortableInventoryTh label="Code" column="code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Item Name" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Type" column="type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Item groups" column="itemGroups" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="WH Stock" column="whStock" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="ML1 Stock" column="ml1Stock" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="ML2 Stock" column="ml2Stock" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Planned qty" column="plannedQty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="PO Qty" column="poQuantity" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="In Transit" column="inTransit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Under GRN" column="underGrn" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh
                        label="Stock in Hand"
                        column="stockInHand"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleInventorySort}
                        title="Usable stock (physical WH+ML1+ML2 minus reserved for production/planning)"
                      />
                      <SortableInventoryTh label="Reserved" column="reserved" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Reorder PT" column="reorderPt" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="Avg/MO" column="avgMo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                      <SortableInventoryTh label="QC / Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleInventorySort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {pagedItems.map((item) => {
                      const planKey =
                        (item.type === 'RM' || item.type === 'PM') && item.sourceId != null && item.sourceId > 0
                          ? `${item.type}-${item.sourceId}`
                          : null;
                      const plan = planKey ? planningTotalsByKey.get(planKey) : undefined;
                      // Show planning-stage open qty (remaining), not full qty duplicated across later stages.
                      const plannedOpenQty = plan
                        ? Math.max(
                            0,
                            Number(plan.plannedQty || 0) -
                              (Number(item.poQuantity || 0) + Number(item.inTransit || 0) + Number(item.underGrn || 0))
                          )
                        : 0;
                      const availableQty =
                        item.available ?? warehouseInventoryAvailable(item.stockInHand, item.reserved);
                      const canReleaseToPlanning =
                        plan != null &&
                        (item.type === 'RM' || item.type === 'PM') &&
                        plan.totalRequired < availableQty;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="hover:bg-surface-2 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-brand">{item.code}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-ink">{item.name}</div>
                            <div className="text-xs text-ink-3">{item.subtitle}</div>
                          </td>
                          <td className="px-4 py-3">{getTypeBadge(item.type)}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-ink-2">
                              {item.itemGroupNames?.length ? item.itemGroupNames.join(', ') : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StockLocationCell
                              item={item}
                              type="wh"
                              value={`${item.whStock} ${item.whUnit}`}
                              className="inline-flex items-center px-2.5 py-1 bg-brand-soft text-brand rounded-md border border-brand-soft cursor-pointer"
                              onShowLocations={(i, t) => setLocationPopover({ item: i, type: t })}
                            />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StockLocationCell
                              item={item}
                              type="ml1"
                              value={String(item.ml1Stock)}
                              className="inline-flex items-center px-2.5 py-1 bg-brand-soft text-brand rounded-full border border-brand-soft cursor-pointer"
                              onShowLocations={(i, t) => setLocationPopover({ item: i, type: t })}
                            />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StockLocationCell
                              item={item}
                              type="ml2"
                              value={String(item.ml2Stock)}
                              className="inline-flex items-center px-2.5 py-1 bg-brand-soft text-brand rounded-full border border-brand-soft cursor-pointer"
                              onShowLocations={(i, t) => setLocationPopover({ item: i, type: t })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {plan ? (
                              item.type === 'RM' || String(plan.unit).toUpperCase() === 'KG' ? (
                                <div className="text-sm font-semibold text-ink">
                                  {formatQtyExact(plannedOpenQty, 'kg')} kg
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-ink">
                                  {Math.round(plannedOpenQty).toLocaleString()}{' '}
                                  <span className="text-xs font-normal text-ink-3">pcs (planning)</span>
                                </div>
                              )
                            ) : (
                              <span className="text-sm text-ink-4">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-ink-2" title="PO-stage remaining after quantities moved to Under GRN.">
                              {item.poQuantity != null ? item.poQuantity : '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setInTransitPopoverItem(inTransitPopoverItem?.id === item.id ? null : item)}
                                className="inline-flex items-center px-2.5 py-1 bg-err-soft text-err rounded-full border border-err-soft hover:ring-2 hover:ring-err font-semibold text-sm"
                                title="In Transit stage only (Under GRN shown separately)."
                              >
                                {item.inTransit} {item.whUnit}
                                {(item.inTransitBreakdown?.length ?? 0) > 0 && (
                                  <span className="ml-1 text-err" aria-hidden>▼</span>
                                )}
                              </button>
                              {inTransitPopoverItem?.id === item.id && (item.inTransitBreakdown?.length ?? 0) > 0 && (
                                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-surface shadow-lg p-3">
                                  <div className="text-xs font-semibold text-ink-2 mb-2">Vendor · PO · Expected</div>
                                  <ul className="space-y-2">
                                    {item.inTransitBreakdown!.map((b, idx) => (
                                      <li key={idx} className="text-xs text-ink-2 border-b border-hairline pb-2 last:border-0 last:pb-0">
                                        <span className="font-medium text-ink">{b.vendor || '—'}</span>
                                        <span className="mx-1">·</span>
                                        <span>PO {b.poNo || (b.poId != null ? `#${b.poId}` : '—')}</span>
                                        {b.expectedDate && (
                                          <span className="block text-ink-3 mt-0.5">Expected: {b.expectedDate}</span>
                                        )}
                                        <span className="block text-err font-medium mt-0.5">{b.quantity} {item.whUnit}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setInTransitPopoverItem(null); }}
                                    className="mt-2 text-xs text-ink-3 hover:text-ink-2"
                                  >
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center px-2.5 py-1 bg-brand-soft text-brand rounded-full border border-brand-soft">
                              <span className="font-semibold text-sm">{Number(item.underGrn || 0)} {item.whUnit}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div
                              className="text-sm font-bold text-ok"
                              title={
                                item.reserved > 0
                                  ? `Physical total ${item.stockInHand} ${item.whUnit}; ${item.reserved} ${item.whUnit} reserved`
                                  : `Physical stock ${item.stockInHand} ${item.whUnit}`
                              }
                            >
                              {availableQty} {item.whUnit}
                            </div>
                            {item.reserved > 0 ? (
                              <div className="text-[10px] text-ink-3 mt-0.5">
                                Total {item.stockInHand} {item.whUnit}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center px-2.5 py-1 bg-warn-soft text-warn rounded-full border border-warn-soft">
                              <span className="font-semibold text-sm">{item.reserved}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-ink-2">{item.reorderPt}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-ink-2">{item.avgMo}</div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                          {/* <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {canReleaseToPlanning && item.sourceId != null ? (
                              <button
                                type="button"
                                className="px-2 py-1 text-[11px] font-semibold rounded-md bg-brand text-white hover:bg-brand-press whitespace-nowrap"
                                onClick={() => {
                                  const surplusQty = Math.max(0, item.stockInHand - (plan?.totalRequired ?? 0));
                                  navigate('/planning/items-involved', {
                                    state: {
                                      openReleasePlanning: {
                                        itemType: item.type as 'RM' | 'PM',
                                        sourceId: item.sourceId!,
                                        nonce: Date.now(),
                                        surplusQty,
                                      },
                                    },
                                  });
                                }}
                              >
                                Release to Planning
                              </button>
                            ) : (
                              <span className="text-xs text-ink-4">—</span>
                            )}
                          </td> */}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Empty State */}
              {sortedItems.length === 0 && (
                <EmptyState
                  icon={<PackageSearch />}
                  title="No items found"
                  description={searchQuery ? 'Try adjusting your search terms' : 'No inventory items match the selected filter'}
                />
              )}
            </div>

            {/* Footer Info */}
            {sortedItems.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-ink-2">
                  <div>
                    Showing{' '}
                    <span className="font-semibold text-ink">{totalFiltered === 0 ? 0 : startIndex + 1}</span>–{' '}
                    <span className="font-semibold text-ink">{Math.min(startIndex + pageSize, totalFiltered)}</span> of{' '}
                    <span className="font-semibold text-ink">{totalFiltered}</span> (filtered) • Total{' '}
                    <span className="font-semibold text-ink">{inventoryData.length}</span> items
                  </div>
                  <div className="text-ink-3">
                    Last updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-ink-3">
                      Page <span className="font-semibold text-ink">{safeCurrentPage}</span> of{' '}
                      <span className="font-semibold text-ink">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        aria-label="Rows per page"
                        className="text-sm px-3 py-2 border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="px-3 py-2 text-sm font-semibold border border-border rounded-lg bg-surface text-ink-2 hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="px-3 py-2 text-sm font-semibold border border-border rounded-lg bg-surface text-ink-2 hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Location / Rack popover (WH stock & MUs) — opens on click */}
      {locationPopover && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/30"
          onClick={() => setLocationPopover(null)}
          role="presentation"
        >
          <div
            className="bg-surface rounded-lg border border-border shadow-xl max-w-xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={
              locationPopover.type === 'wh'
                ? 'Warehouse stock distribution by zone and rack'
                : 'Manufacturing stock by location'
            }
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {locationPopover.type === 'wh'
                    ? `WH stock distribution — ${locationPopover.item.code}`
                    : locationPopover.type === 'ml1'
                      ? `ML1 stock — ${locationPopover.item.code}`
                      : `ML2 stock — ${locationPopover.item.code}`}
                </h3>
                <p className="text-[11px] text-ink-3 mt-0.5">{locationPopover.item.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setLocationPopover(null)}
                className="p-1 rounded border border-border text-ink-2 hover:bg-surface-2 shrink-0"
              >
                <span className="sr-only">Close</span>×
              </button>
            </div>
            <div className="p-4 max-h-[min(28rem,70vh)] overflow-y-auto">
              {locationPopover.type === 'wh' ? (
                <StockByLocationPanel
                  data={stockByLocation}
                  loading={stockByLocationLoading}
                  viewMode="distribution"
                  warehouseOnly
                />
              ) : (
                <StockByLocationPanel
                  data={stockByLocation}
                  loading={stockByLocationLoading}
                  viewMode="distribution"
                  manufacturingOnly
                />
              )}
            </div>
            {locationPopover.type === 'wh' && locationPopover.item.warehouseInventoryId != null && (
              <div className="px-4 py-3 border-t border-border flex justify-end gap-2 bg-surface-2">
                <button
                  type="button"
                  onClick={() => setLocationPopover(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-ink-2 border border-border rounded-md hover:bg-surface"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenSidebarInEditMode(true);
                    setSelectedItem(locationPopover.item);
                    setLocationPopover(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-brand rounded-md hover:bg-brand-press"
                >
                  Adjust stock…
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item detail popup (replaces sidebar) */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Inventory item details"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <WarehouseInventorySidebar
              item={selectedItem}
              initialEditMode={openSidebarInEditMode}
              onClose={() => {
                setSelectedItem(null);
                setOpenSidebarInEditMode(false);
              }}
              onItemUpdated={handleItemUpdatedFromSidebar}
              variant="modal"
            />
          </div>
        </div>
      )}

      <AddLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onAdd={addLocation}
      />
      <AddRackModal
        isOpen={isRackModalOpen}
        onClose={() => setIsRackModalOpen(false)}
        onAdd={addRack}
        locations={locations}
      />
    </div>
  );
};

export default WarehouseInventory;
