import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, MapPin, Grid3x3, X } from 'lucide-react';
import { fetchWarehouseInventory, updateWarehouseStock } from '../../services/warehouseInventory.service';

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
  reserved: number;
  inTransit: number;
  reorderPt: number;
  avgMo: number;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock';
  /** Item group names/codes this item belongs to (from masters) */
  itemGroupNames?: string[];
  itemGroupCodes?: string[];
  /** Backend warehouse_inventory.id for persisting adjust stock */
  warehouseInventoryId?: number;
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
  createdAt: Date;
}

interface Rack {
  id: string;
  zoneLocation: string;
  bayCode: string;
  rackName: string;
  levels: number;
  slotsPerLevel: number;
  condition: string;
  createdAt: Date;
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
    icon: '🏭',
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
      icon: '🏭',
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
            ✕
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
                  Icon (Emoji)
                </label>
                <input 
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
                  placeholder="🏭"
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
            ✕
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

/** Map API row to InventoryItem for table/sidebar */
function rowToInventoryItem(row: {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  type: 'RM' | 'PM' | 'FG/PR';
  itemGroupNames: string[];
  itemGroupCodes: string[];
  zone: string;
  rack: string;
  whStock: number;
  whUnit: string;
  ml1Stock: number;
  ml2Stock: number;
  stockInHand: number;
  reserved: number;
  inTransit: number;
  reorderPt: number;
  avgMo: number;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock';
  warehouseInventoryId?: number;
}): InventoryItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    subtitle: row.subtitle,
    type: row.type,
    zone: row.zone,
    rack: row.rack,
    whStock: row.whStock,
    whUnit: row.whUnit,
    ml1Stock: row.ml1Stock,
    ml2Stock: row.ml2Stock,
    stockInHand: row.stockInHand,
    reserved: row.reserved,
    inTransit: row.inTransit,
    reorderPt: row.reorderPt,
    avgMo: row.avgMo,
    status: row.status,
    itemGroupNames: row.itemGroupNames,
    itemGroupCodes: row.itemGroupCodes,
    warehouseInventoryId: row.warehouseInventoryId,
  };
}

const WarehouseInventory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'RM' | 'PM' | 'FG/PR' | 'Low'>('All');
  const [itemGroupFilter, setItemGroupFilter] = useState<string>('');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [itemGroups, setItemGroups] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWarehouseInventory()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const items = res.data.rows.map(rowToInventoryItem);
          setInventoryData(items);
          setItemGroups(
            (res.data.itemGroups || []).map((g) => ({ id: g.id, code: g.code, name: g.name || g.code }))
          );
          if (typeof console !== 'undefined' && console.log) {
            console.log('[Warehouse Inventory] Loaded', { count: items.length, sample: items[0] });
          }
        } else {
          setError(res.error || 'Failed to load inventory');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load inventory');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateInventoryItem = (itemId: string, field: keyof InventoryItem, value: number) => {
    setInventoryData(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;

        const updatedItem = { ...item, [field]: value } as InventoryItem;
        if (field === 'whStock' || field === 'ml1Stock' || field === 'ml2Stock') {
          updatedItem.stockInHand = updatedItem.whStock + updatedItem.ml1Stock + updatedItem.ml2Stock;
        }
        return updatedItem;
      })
    );

    setSelectedItem(prev => {
      if (!prev || prev.id !== itemId) return prev;
      const updated = { ...prev, [field]: value } as InventoryItem;
      if (field === 'whStock' || field === 'ml1Stock' || field === 'ml2Stock') {
        updated.stockInHand = updated.whStock + updated.ml1Stock + updated.ml2Stock;
      }
      return updated;
    });
  };

  const handleDoneAdjustStock = async () => {
    const item = selectedItem;
    if (!item) {
      setIsAdjustMode(false);
      return;
    }
    if (item.warehouseInventoryId != null) {
      setSavingAdjust(true);
      const res = await updateWarehouseStock(item.warehouseInventoryId, {
        wh_stock: item.whStock,
        ml1_stock: item.ml1Stock,
        ml2_stock: item.ml2Stock,
        reserved: item.reserved,
      });
      setSavingAdjust(false);
      if (res.success && res.data) {
        const d = res.data;
        const stockInHand = (Number(d.wh_stock) || 0) + (Number(d.ml1_stock) || 0) + (Number(d.ml2_stock) || 0);
        setInventoryData(prev =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  whStock: Number(d.wh_stock) ?? i.whStock,
                  ml1Stock: Number(d.ml1_stock) ?? i.ml1Stock,
                  ml2Stock: Number(d.ml2_stock) ?? i.ml2Stock,
                  stockInHand,
                  reserved: Number(d.reserved) ?? i.reserved,
                }
              : i
          )
        );
        setSelectedItem((prev) =>
          prev?.id === item.id
            ? {
                ...prev,
                whStock: Number(d.wh_stock) ?? prev.whStock,
                ml1Stock: Number(d.ml1_stock) ?? prev.ml1Stock,
                ml2Stock: Number(d.ml2_stock) ?? prev.ml2Stock,
                stockInHand,
                reserved: Number(d.reserved) ?? prev.reserved,
              }
            : prev
        );
      }
    }
    setIsAdjustMode(false);
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
          {/* Filter Tabs */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Inventory</h1>
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
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    activeFilter === filter.key
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
          </div>

          {/* Search and Action Buttons */}
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
              onClick={() => setIsLocationModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm text-gray-700"
            >
              <MapPin className="w-4 h-4" />
              Location
            </button>
            <button 
              onClick={() => setIsRackModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm text-gray-700"
            >
              <Grid3x3 className="w-4 h-4" />
              Rack
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading inventory…</div>
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
                    Item Name ↑
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Item groups
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Zone / Rack
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
                    Stock in Hand
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reserved
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    In Transit
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map(item => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.zone}</div>
                          <div className="text-xs text-gray-500">{item.rack}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center px-2.5 py-1 bg-teal-50 text-teal-700 rounded-md border border-teal-200">
                        <span className="font-bold text-sm">{item.whStock}</span>
                        <span className="text-xs ml-1 font-medium">{item.whUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                        <span className="font-semibold text-sm">{item.ml1Stock}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                        <span className="font-semibold text-sm">{item.ml2Stock}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-emerald-700">{item.stockInHand} {item.whUnit}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                        <span className="font-semibold text-sm">{item.reserved}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
                        <span className="font-semibold text-sm">{item.inTransit} {item.whUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">{item.reorderPt}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">{item.avgMo}</div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-gray-400 text-5xl mb-4">📦</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'Try adjusting your search terms' : 'No inventory items match the selected filter'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        {filteredItems.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing <span className="font-semibold text-gray-900">{filteredItems.length}</span> of{' '}
              <span className="font-semibold text-gray-900">{inventoryData.length}</span> items
            </div>
            <div className="text-gray-500">
              Last updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Modals */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Inventory — {selectedItem.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded border border-cyan-300 bg-cyan-50 text-cyan-700 text-[10px] font-semibold">SIH: {selectedItem.stockInHand} {selectedItem.whUnit}</span>
                <span className="px-2 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-700 text-[10px] font-semibold">W1: {selectedItem.whStock}</span>
                <span className="px-2 py-0.5 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 text-[10px] font-semibold">ML1: {selectedItem.ml1Stock}</span>
                <span className="px-2 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 text-[10px] font-semibold">ML2: {selectedItem.ml2Stock}</span>
                <span className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-semibold">Reserved: {selectedItem.reserved}</span>
                <span className="px-2 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-700 text-[10px] font-semibold">In Transit: {selectedItem.inTransit}</span>
                <span className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-semibold">{selectedItem.status}</span>
                <span className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-700 text-[10px] font-semibold">{selectedItem.type}</span>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Item Details</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Item Code</p>
                    <p className="text-[11px] font-semibold text-cyan-700">{selectedItem.code}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Input Category</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.subtitle.split('·')[0].trim()}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">UOM</p>
                    <p className="text-[11px] font-semibold text-emerald-700">{selectedItem.whUnit}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Storage Location</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Zone</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.zone}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Rack / Slot</p>
                    <p className="text-[11px] font-semibold text-cyan-700">{selectedItem.rack}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Stock Breakdown</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Stock in Warehouse</p>
                    <p className="text-base font-bold text-cyan-700">{selectedItem.whStock}</p>
                    <p className="text-[9px] text-slate-400">physical in racks</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">In Manufacturing (ML1+ML2)</p>
                    <p className="text-base font-bold text-blue-700">{selectedItem.ml1Stock + selectedItem.ml2Stock}</p>
                    <p className="text-[9px] text-slate-400">issued to production</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                    <p className="text-[9px] uppercase text-emerald-700">Stock in Hand (Total)</p>
                    <p className="text-base font-bold text-emerald-700">{selectedItem.stockInHand}</p>
                    <p className="text-[9px] text-emerald-600">KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Reserve (committed)</p>
                    <p className="text-sm font-bold text-amber-700">{selectedItem.reserved} {selectedItem.whUnit}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Free / available</p>
                    <p className="text-sm font-bold text-cyan-700">{Math.max(0, selectedItem.stockInHand - selectedItem.reserved)} {selectedItem.whUnit}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Ordered in Transit</p>
                    <p className="text-sm font-bold text-rose-700">{selectedItem.inTransit} {selectedItem.whUnit}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Avg Consumption (Monthly)</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Avg 2025</p>
                    <p className="text-[11px] font-semibold text-slate-900">{Math.round(selectedItem.avgMo * 0.9)} KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Sep 2025</p>
                    <p className="text-[11px] font-semibold text-slate-900">{Math.round(selectedItem.avgMo * 0.8)} KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Oct 2025</p>
                    <p className="text-[11px] font-semibold text-slate-900">{Math.round(selectedItem.avgMo)} KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">3-Month Avg</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.avgMo} {selectedItem.whUnit}/month</p>
                  </div>
                </div>
              </div>

              {isAdjustMode && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Adjust Stock (Realtime)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">WH Stock</p>
                      <input
                        type="number"
                        value={selectedItem.whStock}
                        onChange={e => updateInventoryItem(selectedItem.id, 'whStock', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-cyan-700"
                      />
                    </label>
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">ML1 Stock</p>
                      <input
                        type="number"
                        value={selectedItem.ml1Stock}
                        onChange={e => updateInventoryItem(selectedItem.id, 'ml1Stock', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-blue-700"
                      />
                    </label>
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">ML2 Stock</p>
                      <input
                        type="number"
                        value={selectedItem.ml2Stock}
                        onChange={e => updateInventoryItem(selectedItem.id, 'ml2Stock', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-indigo-700"
                      />
                    </label>
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">Reserved</p>
                      <input
                        type="number"
                        value={selectedItem.reserved}
                        onChange={e => updateInventoryItem(selectedItem.id, 'reserved', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-amber-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Item Specifications</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Batch / Lot Number</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.batchNumber || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Expiry Date</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.expiryDate || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Manufacturer</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.manufacturer || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Quality Grade</p>
                    <p className="text-[11px] font-semibold text-emerald-700">{selectedItem.qualityGrade || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Storage Condition</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.storageCondition || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Open Stock Requests</p>
                <p className="text-[11px] text-slate-600 mb-2">Reserved at which BRM / batch — open requests for this item.</p>
                <div className="bg-amber-50/50 border border-amber-200 rounded p-3">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-slate-600 border-b border-amber-200">
                        <th className="py-1 pr-2">Request / BRM</th>
                        <th className="py-1 pr-2">Qty</th>
                        <th className="py-1 pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={3} className="py-2 text-slate-500 italic">No open stock requests</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={isAdjustMode ? handleDoneAdjustStock : () => setIsAdjustMode(true)}
                disabled={savingAdjust}
                className="px-3 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-60"
              >
                {isAdjustMode ? (savingAdjust ? 'Saving…' : 'Done') : 'Adjust Stock'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-3 py-1.5 bg-slate-600 text-white rounded-md text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
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
