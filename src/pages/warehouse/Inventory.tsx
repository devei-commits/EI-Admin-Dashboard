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
  importMainWarehouseSihExcel,
  importMl1SihExcel,
  importMl2SihExcel,
  type WarehouseSihExcelImportResponse,
  inventoryAdjustChangeLines,
} from '../../services/warehouseInventory.service';
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Add New Warehouse Location</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors"
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
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Location Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="e.g. Solvent Store"
                  required
                />
              </div>

              {/* Zone Code */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Zone Code
                </label>
                <input
                  type="text"
                  name="zoneCode"
                  value={formData.zoneCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="e.g. Zone F"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
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
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Area (SQM)
                </label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="100"
                />
              </div>
            </div>

            {/* Temperature / Storage Conditions */}
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                Temperature / Storage Conditions
              </label>
              <input
                type="text"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                placeholder="e.g. Ambient 15-30°C"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Max Capacity */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Max Capacity (KG / UNITS)
                </label>
                <input
                  type="text"
                  name="maxCapacity"
                  value={formData.maxCapacity}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="500"
                />
              </div>

              {/* Icon (Emoji) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Icon
                </label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder=""
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
            >
              Add Location
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Add New Rack / Bay</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors"
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
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Zone / Location *
                </label>
                <select
                  name="zoneLocation"
                  value={formData.zoneLocation}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
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
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Bay Code *
                </label>
                <input
                  type="text"
                  name="bayCode"
                  value={formData.bayCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="e.g. F1"
                  required
                />
              </div>
            </div>

            {/* Rack Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                Rack Name
              </label>
              <input
                type="text"
                name="rackName"
                value={formData.rackName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                placeholder="e.g. Bay F1 — Ambient Shelf"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* No. of Levels */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  No. of Levels
                </label>
                <input
                  type="number"
                  name="levels"
                  value={formData.levels}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="4"
                  min="1"
                />
              </div>

              {/* Slots per Level */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Slots per Level
                </label>
                <input
                  type="number"
                  name="slotsPerLevel"
                  value={formData.slotsPerLevel}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="4"
                  min="1"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                  Condition
                </label>
                <select
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
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
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
            >
              Add Rack
            </button>
          </div>
        </form>
      </div>
    </div>
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

  const handleInventorySummaryExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingInventoryExcel(true);
    try {
      const res = await importInventorySummaryExcel(file, { details: true });
      alert(formatSihImportResult('Zoho Inventory Summary', res));
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      refetchWarehouseInventory();
    } catch (err) {
      const message = err instanceof Error ? err.message : `${label} import failed`;
      alert(message);
    } finally {
      setImportingSihBucket(null);
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

  useEffect(() => {
    // Keep pagination consistent with filters/search.
    setCurrentPage(1);
  }, [searchQuery, activeFilter, itemGroupFilter, pageSize]);

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedItems = filteredItems.slice(startIndex, startIndex + pageSize);

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
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">In Stock</span>;
      case 'Low Stock':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">Low Stock</span>;
      case 'Critical':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Critical</span>;
      case 'Out of Stock':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">Out of Stock</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">{type}</span>;
  };

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Summary Cards */}
      <div className="bg-linear-to-br from-gray-50 to-gray-100 border-b border-gray-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total SKUs */}
          <div className="bg-white rounded-lg p-4 border border-cyan-200 shadow-sm">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">Total SKUs</div>
            <div className="text-3xl font-bold text-cyan-600 mb-1">{stats.total}</div>
            <div className="text-xs text-gray-500">RM + PM + Finished Goods</div>
          </div>

          {/* In Stock */}
          <div className="bg-white rounded-lg p-4 border border-emerald-200 shadow-sm">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">In Stock</div>
            <div className="text-3xl font-bold text-emerald-600 mb-1">{stats.inStock}</div>
            <div className="text-xs text-gray-500">Items available</div>
          </div>

          {/* Low Stock */}
          <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">Low Stock</div>
            <div className="text-3xl font-bold text-amber-600 mb-1">{stats.lowStock}</div>
            <div className="text-xs text-gray-500">Below threshold</div>
          </div>

          {/* Critical / Out */}
          <div className="bg-white rounded-lg p-4 border border-red-200 shadow-sm">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">Critical / Out</div>
            <div className="text-3xl font-bold text-red-600 mb-1">{stats.critical}</div>
            <div className="text-xs text-gray-500">Needs attention</div>
          </div>

          {/* FG Under QC */}
          <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">FG Under QC</div>
            <div className="text-3xl font-bold text-purple-600 mb-1">{stats.fgUnderQc}</div>
            <div className="text-xs text-gray-500">batches pending release</div>
          </div>

          {/* In Transit */}
          <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">In Transit</div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{stats.inTransit}</div>
            <div className="text-xs text-gray-500">RM/PM orders</div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="p-6">
          {/* View mode + filter tabs */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
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
                    onChange={(e) =>
                      handleSihBucketExcelChange(e, 'warehouse', importMainWarehouseSihExcel, 'Main warehouse SIH')
                    }
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
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    title="Zoho Inventory Summary export"
                  >
                    {importingInventoryExcel ? 'Importing…' : 'Zoho stock Excel'}
                  </button>
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => mainWarehouseSihFileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100 disabled:opacity-50"
                    title="Main warehouse workbook — Sheet3 with sku, item_name, SIH"
                  >
                    {importingSihBucket === 'warehouse' ? 'Importing…' : 'Upload WH SIH'}
                  </button>
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => ml1SihFileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                    title="ML1 workbook — STOCK IN HAND sheet: sku, item_name, PHYSICAL QTY"
                  >
                    {importingSihBucket === 'ml1' ? 'Importing…' : 'Upload ML1 SIH'}
                  </button>
                  <button
                    type="button"
                    disabled={importingInventoryExcel || importingSihBucket != null}
                    onClick={() => ml2SihFileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                    title="ML2 workbook — Sheet3 with sku, item_name, SIH"
                  >
                    {importingSihBucket === 'ml2' ? 'Importing…' : 'Upload ML2 SIH'}
                  </button>
                </>
              )}
              <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('current')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'current'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Main Inventory
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('history')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'history'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Inventory History
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('usage')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'usage'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeFilter === filter.key
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
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
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeFilter === filter.key
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search item, code, category..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => navigate('/facility-management')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm text-gray-700"
                title="Manage areas/zones in Facility Management"
              >
                <MapPin className="w-4 h-4" />
                Manage Areas
              </button>
              <button
                onClick={() => navigate('/facility-management')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm text-gray-700"
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search history by item, code, zone, rack..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Table / History view */}
      <div className="p-6">
        {error && viewMode === 'current' && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {loading && viewMode === 'current' ? (
          <div className="py-12 text-center text-gray-500">Loading inventory…</div>
        ) : viewMode === 'history' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory History</h2>
            {historyError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {historyError}
              </div>
            )}
            {historyLoading ? (
              <div className="py-12 text-center text-gray-500">Loading internal movement history…</div>
            ) : filteredHistoryRows.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No internal movements recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        From (Zone / Rack)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        To (Zone / Rack)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reserved / Batch
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Qty Δ
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Moved At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredHistoryRows.map((row) => {
                      const adjustLines =
                        row.actionType === 'INVENTORY_ADJUST'
                          ? inventoryAdjustChangeLines(row.changesJson)
                          : [];
                      return (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {row.code || '—'}{row.name ? ` — ${row.name}` : ''}
                          </div>
                          {row.subtitle && (
                            <div className="text-xs text-gray-500">{row.subtitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getTypeBadge(row.itemType)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div>{row.fromZone || '—'}</div>
                          <div className="text-xs text-gray-500">{row.fromRack || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div>{row.toZone || '—'}</div>
                          <div className="text-xs text-gray-500">{row.toRack || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.actionType === 'INVENTORY_ADJUST'
                            ? 'Inventory adjust'
                            : row.actionType === 'BMR_RESERVED' || row.actionType === 'BPR_RESERVED'
                              ? `Reserved (${row.actionType === 'BMR_RESERVED' ? 'BMR' : 'BPR'})`
                              : (row.actionType || 'Move')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                          {row.actionType === 'INVENTORY_ADJUST' ? (
                            <div className="space-y-1">
                              {adjustLines.length > 0 ? (
                                <ul className="list-disc list-inside text-xs text-gray-600">
                                  {adjustLines.map((line, i) => (
                                    <li key={i}>{line}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                              {row.note ? (
                                <div className="text-xs text-gray-700">
                                  <span className="font-medium">Note:</span> {row.note}
                                </div>
                              ) : null}
                            </div>
                          ) : (row.actionType === 'BMR_RESERVED' || row.actionType === 'BPR_RESERVED') ? (
                            <span className="text-amber-700 font-medium">
                              +{row.reservedDelta ?? row.qtyDelta ?? 0} → {row.reservedAfter ?? '—'}{' '}
                              {row.batchNo ? `· ${row.batchNo}` : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.qtyDelta != null ? row.qtyDelta : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
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
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage (consumption) — avg per period</h2>
            {usageLoading ? (
              <div className="py-12 text-center text-gray-500">Loading usage stats…</div>
            ) : usageRows.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No usage data yet (from movement history).</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg/Day</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg/Week</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg/Month</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg/Quarter</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg/Year</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total (all time)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {usageRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.code || row.id}</td>
                        <td className="px-4 py-3 text-gray-700">{row.name || '—'}</td>
                        <td className="px-4 py-3">{row.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Number(row.avgDay).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Number(row.avgWeek).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Number(row.avgMonth).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Number(row.avgQuarter).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Number(row.avgYear).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{Number(row.totalAllTime).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Item groups
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        WH Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        ML1 Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        ML2 Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Planned qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        PO Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        In Transit
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Under GRN
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                        title="Usable stock (physical WH+ML1+ML2 minus reserved for production/planning)"
                      >
                        Stock in Hand
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reserved
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reorder PT
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Avg/MO
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        QC / Status
                      </th>
                      {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Planning
                      </th> */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
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
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-cyan-600">{item.code}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.subtitle}</div>
                          </td>
                          <td className="px-4 py-3">{getTypeBadge(item.type)}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">
                              {item.itemGroupNames?.length ? item.itemGroupNames.join(', ') : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StockLocationCell
                              item={item}
                              type="wh"
                              value={`${item.whStock} ${item.whUnit}`}
                              className="inline-flex items-center px-2.5 py-1 bg-teal-50 text-teal-700 rounded-md border border-teal-200 cursor-pointer"
                              onShowLocations={(i, t) => setLocationPopover({ item: i, type: t })}
                            />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StockLocationCell
                              item={item}
                              type="ml1"
                              value={String(item.ml1Stock)}
                              className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200 cursor-pointer"
                              onShowLocations={(i, t) => setLocationPopover({ item: i, type: t })}
                            />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StockLocationCell
                              item={item}
                              type="ml2"
                              value={String(item.ml2Stock)}
                              className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 cursor-pointer"
                              onShowLocations={(i, t) => setLocationPopover({ item: i, type: t })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {plan ? (
                              item.type === 'RM' || String(plan.unit).toUpperCase() === 'KG' ? (
                                <div className="text-sm font-semibold text-gray-900">
                                  {plannedOpenQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-gray-900">
                                  {Math.round(plannedOpenQty).toLocaleString()}{' '}
                                  <span className="text-xs font-normal text-gray-500">pcs (planning)</span>
                                </div>
                              )
                            ) : (
                              <span className="text-sm text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600" title="PO-stage remaining after quantities moved to Under GRN.">
                              {item.poQuantity != null ? item.poQuantity : '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setInTransitPopoverItem(inTransitPopoverItem?.id === item.id ? null : item)}
                                className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-700 rounded-full border border-red-200 hover:ring-2 hover:ring-red-300 font-semibold text-sm"
                                title="In Transit stage only (Under GRN shown separately)."
                              >
                                {item.inTransit} {item.whUnit}
                                {(item.inTransitBreakdown?.length ?? 0) > 0 && (
                                  <span className="ml-1 text-red-500" aria-hidden>▼</span>
                                )}
                              </button>
                              {inTransitPopoverItem?.id === item.id && (item.inTransitBreakdown?.length ?? 0) > 0 && (
                                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                  <div className="text-xs font-semibold text-gray-700 mb-2">Vendor · PO · Expected</div>
                                  <ul className="space-y-2">
                                    {item.inTransitBreakdown!.map((b, idx) => (
                                      <li key={idx} className="text-xs text-gray-600 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                        <span className="font-medium text-gray-800">{b.vendor || '—'}</span>
                                        <span className="mx-1">·</span>
                                        <span>PO {b.poNo || (b.poId != null ? `#${b.poId}` : '—')}</span>
                                        {b.expectedDate && (
                                          <span className="block text-gray-500 mt-0.5">Expected: {b.expectedDate}</span>
                                        )}
                                        <span className="block text-red-600 font-medium mt-0.5">{b.quantity} {item.whUnit}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setInTransitPopoverItem(null); }}
                                    className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full border border-violet-200">
                              <span className="font-semibold text-sm">{Number(item.underGrn || 0)} {item.whUnit}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div
                              className="text-sm font-bold text-emerald-700"
                              title={
                                item.reserved > 0
                                  ? `Physical total ${item.stockInHand} ${item.whUnit}; ${item.reserved} ${item.whUnit} reserved`
                                  : `Physical stock ${item.stockInHand} ${item.whUnit}`
                              }
                            >
                              {availableQty} {item.whUnit}
                            </div>
                            {item.reserved > 0 ? (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Total {item.stockInHand} {item.whUnit}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                              <span className="font-semibold text-sm">{item.reserved}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">{item.reorderPt}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">{item.avgMo}</div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                          {/* <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {canReleaseToPlanning && item.sourceId != null ? (
                              <button
                                type="button"
                                className="px-2 py-1 text-[11px] font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap"
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
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td> */}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Empty State */}
              {filteredItems.length === 0 && (
                <div className="py-16 text-center">
                  <div className="text-gray-400 text-5xl mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? 'Try adjusting your search terms' : 'No inventory items match the selected filter'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Info */}
            {filteredItems.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    Showing{' '}
                    <span className="font-semibold text-gray-900">{totalFiltered === 0 ? 0 : startIndex + 1}</span>–{' '}
                    <span className="font-semibold text-gray-900">{Math.min(startIndex + pageSize, totalFiltered)}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalFiltered}</span> (filtered) • Total{' '}
                    <span className="font-semibold text-gray-900">{inventoryData.length}</span> items
                  </div>
                  <div className="text-gray-500">
                    Last updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-gray-500">
                      Page <span className="font-semibold text-gray-900">{safeCurrentPage}</span> of{' '}
                      <span className="font-semibold text-gray-900">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={
              locationPopover.type === 'wh'
                ? 'Warehouse stock distribution by zone and rack'
                : 'Manufacturing stock by location'
            }
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {locationPopover.type === 'wh'
                    ? `WH stock distribution — ${locationPopover.item.code}`
                    : locationPopover.type === 'ml1'
                      ? `ML1 stock — ${locationPopover.item.code}`
                      : `ML2 stock — ${locationPopover.item.code}`}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{locationPopover.item.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setLocationPopover(null)}
                className="p-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 shrink-0"
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
              <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setLocationPopover(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-white"
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
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
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
