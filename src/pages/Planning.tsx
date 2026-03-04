import { useState, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/apiClient';

interface RawMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  percentage: number;
}

interface PackagingMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  value: number;
  percentage: number;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  productName: string;
  productCode: string;
  orderQty: string;
  totalKg: string;
  orderDate: string;
  dueDate: string;
  daysLeft: string;
  batchSize: string;
  batchesRequired: number;
  bomStatus: 'Production Released' | 'Production Ready' | 'In Progress' | 'Planned';
  approvedBy: string;
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  color?: string;
}

import { FeasibilityCard } from '../components/FeasibilityCard';

const Planning = () => {
  const { addToast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [prSending, setPrSending] = useState(false);
  const [prPriority, setPrPriority] = useState('High');
  const [prRequiredByDate, setPrRequiredByDate] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [prShowPMOnly, setPrShowPMOnly] = useState(false);
  const [planBatchesModalOpen, setPlanBatchesModalOpen] = useState(false);
  const [selectedSOForBatch, setSelectedSOForBatch] = useState<SalesOrder | null>(null);
  const [activeBatchTab, setActiveBatchTab] = useState<'feasibility' | 'batch-plan' | 'bom-editor' | 'swap-add'>('feasibility');
  const [numBatches, setNumBatches] = useState('15');
  const [batchSizeKg, setBatchSizeKg] = useState('500');
  const [plannedStartDate, setPlannedStartDate] = useState('2026-03-04');
  const [productionLine, setProductionLine] = useState('Line 1 — Primary Mixer');
  const [bomFormula, setBomFormula] = useState<RawMaterial[]>([]);
  const [quickAddRmCode, setQuickAddRmCode] = useState('');
  const [quickAddInciName, setQuickAddInciName] = useState('');
  const [quickAddPercentage, setQuickAddPercentage] = useState('');
  const [bomPackaging, setBomPackaging] = useState<PackagingMaterial[]>([]);
  const [isReadyForProduction, setIsReadyForProduction] = useState(false);
  const [productionSentOrderIds, setProductionSentOrderIds] = useState<string[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<'pis-extracted' | 'items-involved' | 'availability-summary'>('pis-extracted');
  const [singleItemPrModalOpen, setSingleItemPrModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [singleItemPrSending, setSingleItemPrSending] = useState(false);
  const [singleItemPrPriority, setSingleItemPrPriority] = useState('High');
  const [singleItemPrRequiredByDate, setSingleItemPrRequiredByDate] = useState('18-03-2026');
  const canSendToProduction =
    isReadyForProduction || selectedSOForBatch?.bomStatus === 'Production Ready';

  // Tab-specific stats
  const tabStats = {
    'pis-extracted': {
      totalSOs: 4,
      prodReleased: 2,
      shortages: 18,
      batchesRequired: 31,
      batchesConfirmed: 15,
      soValue: '₹5,63,30,000'
    },
    'items-involved': {
      confirmedProducts: { value: 1, total: 4 },
      rmItems: { value: 12, ok: 12, short: 0 },
      pmItems: { value: 4, ok: 0, short: 4 },
      rmShortages: 0,
      pmShortages: 4,
      prsRaised: 1
    },
    'availability-summary': {
      shortageIdentified: { so: 4, pr: 2 },
      requiredLeadDays: 7,
      receivedCompleted: { so: 1, pr: 3 },
      criticalShortage: { so: 2, pr: 1 }
    }
  };

  const currentStats = tabStats[activeMainTab];

  // Items Involved Data
  const itemsInvolved = [
    { id: 'PM-1', name: '150ml Transparent PET Pump Bottle', code: 'EI-PM-BTL-00001', category: 'PM - Primary', usedIn: '1', totalReq: '50,000pcs', sih: '30,000', surplusShortage: '-12,000', coverage: '70%', whBatches: 'W1- 2026-PM-001', expiry: '-', bomFlag: 'Original', itemType: 'PM' },
    { id: 'PM-2', name: '24/410 Lotion Pump White', code: 'EI-PM-PMP-00001', category: 'PM - Primary', usedIn: '1', totalReq: '50,000pcs', sih: '42,000', surplusShortage: '-8,000', coverage: '84%', whBatches: 'W1- 2026-PM-002', expiry: '-', bomFlag: 'Original', itemType: 'PM' },
    { id: 'PM-3', name: 'Facewash Front Label 100x80mm', code: 'EI-PM-LBL-00001', category: 'PM - Primary', usedIn: '1', totalReq: '50,000pcs', sih: '35,000', surplusShortage: '-15,000', coverage: '70%', whBatches: 'W1- 2026-PM-003', expiry: '2027-01-01', bomFlag: 'Original', itemType: 'PM' },
    { id: 'PM-4', name: 'Facewash 150ml Monocarton', code: 'EI-PM-HCMO-00001', category: 'PM - Secondary', usedIn: '1', totalReq: '50,000pcs', sih: '28,000', surplusShortage: '-22,000', coverage: '56%', whBatches: 'W1- 2026-PM-004', expiry: '2027-08-05', bomFlag: 'Original', itemType: 'PM' },
    { id: 'RM-1', name: 'Aqua', code: 'EI-RM-BASE-00001', category: 'RM', usedIn: '1', totalReq: '5,153 KG', sih: '25,000', surplusShortage: '+19,847', coverage: '100%', whBatches: 'W1- 2026-RM-001', expiry: '2027-01-19', bomFlag: 'Original', itemType: 'RM' },
    { id: 'RM-2', name: 'Sodium Laureth Sulfate', code: 'EI-RM-SURF-00001', category: 'RM', usedIn: '1', totalReq: '900 KG', sih: '1,890', surplusShortage: '+900', coverage: '100%', whBatches: 'W1- 2026-RM-010', expiry: '2027-08-20', bomFlag: 'Original', itemType: 'RM' },
    { id: 'RM-3', name: 'Cocamidopropyl Betaine', code: 'EI-RM-SURF-00002', category: 'RM', usedIn: '1', totalReq: '375 KG', sih: '950', surplusShortage: '+575', coverage: '100%', whBatches: 'W1- 2026-RM-011', expiry: '2027-08-20', bomFlag: 'Original', itemType: 'RM' },
    { id: 'RM-4', name: 'Sodium Cocoyl Isethionate', code: 'EI-RM-SURF-00003', category: 'RM', usedIn: '1', totalReq: '300 KG', sih: '328', surplusShortage: '+28', coverage: '100%', whBatches: 'W1- 2026-RM-012', expiry: '2027-04-12', bomFlag: 'Original', itemType: 'RM' },
    { id: 'RM-5', name: 'Glycerin', code: 'EI-RM-ACTIVE-00001', category: 'RM', usedIn: '1', totalReq: '225 KG', sih: '4,200', surplusShortage: '+3,975', coverage: '100%', whBatches: 'W1- 2026-RM-020', expiry: '2027-03-20', bomFlag: 'Original', itemType: 'RM' },
    { id: 'RM-6', name: 'Aloe Barbadensis Leaf Juice', code: 'EI-RM-ACTIVE-00002', category: 'RM', usedIn: '1', totalReq: '150 KG', sih: '180', surplusShortage: '+30', coverage: '100%', whBatches: '2026-03-15', expiry: '-', bomFlag: 'Original', itemType: 'RM' },
    { id: 'RM-7', name: 'Niacinamide', code: 'EI-RM-ACTIVE-00003', category: 'RM', usedIn: '1', totalReq: '150 KG', sih: '680', surplusShortage: '+530', coverage: '100%', whBatches: 'W1- 2026-RM-023', expiry: '2027-08-20', bomFlag: 'Original', itemType: 'RM' },
  ];

  // Availability Summary Data
  const availabilitySummaryProducts = [
    { 
      id: 'P1', 
      name: 'GENTLE FOAMING FACEWASH', 
      icon: '🌸', 
      iconBg: 'bg-pink-100', 
      iconColor: 'text-pink-600',
      rmPercentage: 100, 
      pmPercentage: 72, 
      status: 'confirmed', 
      statusColor: 'bg-green-100 text-green-700',
      dueIn: 16,
      soId: '1' 
    },
    { 
      id: 'P2', 
      name: 'INVISIBLE SUNSCREEN SPF50', 
      icon: '☀️', 
      iconBg: 'bg-orange-100', 
      iconColor: 'text-orange-600',
      rmPercentage: 100, 
      pmPercentage: 65, 
      status: 'pending', 
      statusColor: 'bg-purple-100 text-purple-700',
      dueIn: 32,
      soId: '2' 
    },
    { 
      id: 'P3', 
      name: 'HYDRA-BOOST MOISTURISER', 
      icon: '💧', 
      iconBg: 'bg-blue-100', 
      iconColor: 'text-blue-600',
      rmPercentage: 100, 
      pmPercentage: 92, 
      status: 'pending', 
      statusColor: 'bg-purple-100 text-purple-700',
      dueIn: 52,
      soId: '3' 
    },
    { 
      id: 'P4', 
      name: 'KERATIN REPAIR CONDITIONER', 
      icon: '🧴', 
      iconBg: 'bg-purple-100', 
      iconColor: 'text-purple-600',
      rmPercentage: 100, 
      pmPercentage: 64, 
      status: 'pending', 
      statusColor: 'bg-purple-100 text-purple-700',
      dueIn: 67,
      soId: '4' 
    }
  ];

  const availabilityRMItems = [
    { id: 'RM1', name: 'Behentrimonium Methosulfate/Cetearyl', code: 'EI-RM-BASE-00009', reqKg: '1,200', sihKg: '420', coverage: 35, status: 'SHORT', statusColor: 'bg-red-100 text-red-700' },
    { id: 'RM2', name: 'Argania Spinosa Kernel Oil', code: 'EI-RM-ACTIVE-00034', reqKg: '200', sihKg: '85', coverage: 43, status: 'SHORT', statusColor: 'bg-red-100 text-red-700' },
    { id: 'RM3', name: 'Cetrimonium Chloride', code: 'EI-RM-SURF-00008', reqKg: '300', sihKg: '280', coverage: 93, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'RM4', name: 'Hydrolyzed Keratin', code: 'EI-RM-ACTIVE-00011', reqKg: '200', sihKg: '150', coverage: 75, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'RM5', name: 'Aqua', code: 'EI-RM-BASE-00001', reqKg: '14,441', sihKg: '25,000', coverage: 100, status: 'OK', statusColor: 'bg-green-100 text-green-700' },
    { id: 'RM6', name: 'Sodium Laureth Sulfate', code: 'EI-RM-SURF-00001', reqKg: '900', sihKg: '1,800', coverage: 100, status: 'OK', statusColor: 'bg-green-100 text-green-700' },
    { id: 'RM7', name: 'Cocamidopropyl Betaine', code: 'EI-RM-SURF-00002', reqKg: '375', sihKg: '950', coverage: 100, status: 'OK', statusColor: 'bg-green-100 text-green-700' },
    { id: 'RM8', name: 'Sodium Cocoyl Isethionate', code: 'EI-RM-SURF-00003', reqKg: '300', sihKg: '320', coverage: 100, status: 'OK', statusColor: 'bg-green-100 text-green-700' },
    { id: 'RM9', name: 'Glycerin', code: 'EI-RM-ACTIVE-00001', reqKg: '570', sihKg: '4,200', coverage: 100, status: 'OK', statusColor: 'bg-green-100 text-green-700' },
    { id: 'RM10', name: 'Aloe Barbadensis Leaf Juice', code: 'EI-RM-ACTIVE-00002', reqKg: '150', sihKg: '180', coverage: 100, status: 'OK', statusColor: 'bg-green-100 text-green-700' },
  ];

  const availabilityPMItems = [
    { id: 'PM1', name: '24-unit Shipper Master Carton', code: 'EI-PM-SHC-00001 Tertiary', required: '50,000', sih: '1,800', coverage: 4, status: 'SHORT', statusColor: 'bg-red-100 text-red-700' },
    { id: 'PM2', name: '150ml Transparent PET Pump Bottle', code: 'EI-PM-BTL-00001 Primary', required: '50,000', sih: '38,000', coverage: 76, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM3', name: '24/410 Lotion Pump White', code: 'EI-PM-PMP-00001 Primary', required: '50,000', sih: '42,000', coverage: 84, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM4', name: 'Facewash Front Label 100x80mm', code: 'EI-PM-LBL-00001 Primary', required: '50,000', sih: '35,000', coverage: 70, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM5', name: 'Facewash 150ml Monocarton', code: 'EI-PM-MONO-00001 Secondary', required: '50,000', sih: '28,000', coverage: 56, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM6', name: '50g Laminated Tube White Matte', code: 'EI-PM-TUB-00001 Primary', required: '30,000', sih: '18,000', coverage: 60, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM7', name: 'Sunscreen 50g Monocarton Premium', code: 'EI-PM-MONO-00003 Secondary', required: '30,000', sih: '22,000', coverage: 73, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM8', name: '50ml Acrylic PMMA Jar + Lid White', code: 'EI-PM-JAR-00001 Primary', required: '40,000', sih: '32,000', coverage: 80, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM9', name: 'Moisturiser 50ml Monocarton Premium', code: 'EI-PM-MONO-00004 Secondary', required: '40,000', sih: '28,000', coverage: 70, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'PM10', name: '200ml HDPE Bottle White Oval', code: 'EI-PM-BTL-00005 Primary', required: '50,000', sih: '42,000', coverage: 84, status: 'WARN', statusColor: 'bg-yellow-100 text-yellow-700' },
  ];

  // Inventory categories for Swap Panel
  const inventoryCategories = [
    {
      name: 'DISTRACTANTS',
      items: [
        { id: '101', name: 'Sodium Laureth Sulfate', code: 'EI-RM-00001', description: 'Mild cleanser for facewash', status: 'IN BOM', inBom: false },
        { id: '102', name: 'Cocamidopropyl Betaine', code: 'EI-RM-00002', description: 'Gentle cleanser with SLES', status: 'IN BOM', inBom: false },
        { id: '103', name: 'Sodium Cocoyl Isethionate', code: 'EI-RM-00003', description: 'Mild surfactant for cleansing', status: 'IN BOM', inBom: false },
        { id: '104', name: 'Carbomesium Chloride', code: 'EI-RM-00004', description: 'Chelating agent to stabilize minerals', status: 'EXTERNAL', inBom: false },
        { id: '105', name: 'Disodium Cocoyl Glutamate', code: 'EI-RM-00005', description: 'Amino acid surfactant - naturally derived', status: 'EXTERNAL', inBom: false },
      ]
    },
    {
      name: 'ICE FILLERS',
      items: [
        { id: '201', name: 'Hexamidine', code: 'EI-RM-00006', description: 'Mild - Organic preservative', status: 'AVAILABLE', inBom: false },
        { id: '202', name: 'Ethylhexyl Methoxycinnamate', code: 'EI-RM-00007', description: 'Anti - UV filter against UVB rays', status: 'AVAILABLE', inBom: false },
        { id: '203', name: 'Butyl Methoxydibenzoylmethane', code: 'EI-RM-00008', description: 'Anti - UV protection against UVA', status: 'AVAILABLE', inBom: false },
        { id: '204', name: 'Octocrylene', code: 'EI-RM-00009', description: 'UV filter - enhances sunscreen stability', status: 'AVAILABLE', inBom: false },
        { id: '205', name: 'Titanium Dioxide (nano)', code: 'EI-RM-00010', description: 'Physical sunscreen - broad spectrum', status: 'EXTERNAL', inBom: false },
        { id: '206', name: 'Zinc Oxide (nano)', code: 'EI-RM-00011', description: 'Physical broad spectrum - source mineral', status: 'EXTERNAL', inBom: false },
      ]
    },
    {
      name: 'PRESERVATIVES',
      items: [
        { id: '301', name: 'Phenoxyethanol', code: 'EI-RM-00012', description: 'Broad preservative', status: 'IN BOM', inBom: true },
        { id: '302', name: 'Ethylhexylglycerin', code: 'EI-RM-00013', description: 'Booster - skin feel', status: 'AVAILABLE', inBom: false },
        { id: '303', name: 'Caprylyl Glycol', code: 'EI-RM-00014', description: 'Humectant and preservative booster', status: 'IN BOM', inBom: false },
        { id: '304', name: 'Sodium Benzoate', code: 'EI-RM-00015', description: 'Water use - broad spectrum', status: 'IN BOM', inBom: false },
      ]
    },
    {
      name: 'ACTIVES / EXTRACTS',
      items: [
        { id: '401', name: 'Glycerin', code: 'EI-RM-00016', description: 'Humectant - soothing and botanical compounds', status: 'IN BOM', inBom: true },
        { id: '402', name: 'Niacinamide', code: 'EI-RM-00017', description: 'Vitamin B3 - brightening', status: 'AVAILABLE', inBom: false },
        { id: '403', name: 'Magnesium Ascorbyl Phosphate', code: 'EI-RM-00018', description: 'Stable Vitamin C - skin brightening', status: 'AVAILABLE', inBom: false },
        { id: '404', name: 'Sodium PCA', code: 'EI-RM-00019', description: 'Natural humectant - mineral hydration', status: 'EXTERNAL', inBom: false },
        { id: '405', name: 'Panthenol', code: 'EI-RM-00020', description: 'Pro-Vitamin B5 - conditioning', status: 'AVAILABLE', inBom: false },
      ]
    },
  ];

  // Mock data matching the image
  const initialSalesOrders: SalesOrder[] = [
    {
      id: '1',
      soNumber: 'EI-SO-2026-001',
      productName: 'El Gentle Foaming Facewash',
      productCode: 'EI-FG-001',
      orderQty: '50,000 Units',
      totalKg: '7,500 KG',
      orderDate: '2026-02-10',
      dueDate: '2026-03-20',
      daysLeft: '16 days',
      batchSize: '500 KG',
      batchesRequired: 15,
      bomStatus: 'Production Released',
      approvedBy: 'Amit Kumar',
      color: 'pink',
      rawMaterials: [
        { id: '1', name: 'Aqua', quantity: 25.900, unit: 'KG', percentage: 100 },
        { id: '2', name: 'Sodium Laureth Sulfate', quantity: 1.950, unit: 'KG', percentage: 100 },
        { id: '3', name: 'Cocamidopropyl Betaine', quantity: 950, unit: 'KG', percentage: 100 },
        { id: '4', name: 'Sodium Cocoyl Isethionate', quantity: 320, unit: 'KG', percentage: 100 },
        { id: '5', name: 'Glycerin', quantity: 4.280, unit: 'KG', percentage: 100 },
        { id: '6', name: 'Aloe Barbadensis Leaf Juice', quantity: 150, unit: 'KG', percentage: 100 },
        { id: '7', name: 'Niacinamide', quantity: 680, unit: 'KG', percentage: 100 },
        { id: '8', name: 'Carbomer', quantity: 280, unit: 'KG', percentage: 100 },
        { id: '9', name: 'Phenoxyethanol', quantity: 320, unit: 'KG', percentage: 100 },
      ],
      packagingMaterials: [
        { id: '1', name: '150ml Transparent PET Pump Bottle', quantity: 35.680, unit: '7.427 KG', value: 1.43, percentage: 100 },
        { id: '2', name: '24/410 Lotion Pump White', quantity: 42.000, unit: '50 KG', value: 2.00, percentage: 100 },
        { id: '3', name: 'Facewash Front Label 100x80mm', quantity: 35.686, unit: '50 KG', value: 1.80, percentage: 100 },
        { id: '4', name: 'Facewash 150ml Monocarton', quantity: 28.000, unit: '50 KG', value: 1.50, percentage: 100 },
      ],
    },
    {
      id: '2',
      soNumber: 'EI-SO-2026-002',
      productName: 'El Invisible Sunscreen SPF50',
      productCode: 'EI-FG-002',
      orderQty: '30,000 Units',
      totalKg: '1,500 KG',
      orderDate: '2026-02-12',
      dueDate: '2026-04-05',
      daysLeft: '32 days',
      batchSize: '300 KG',
      batchesRequired: 5,
      bomStatus: 'Production Ready',
      approvedBy: 'Amit Kumar',
      color: 'orange',
      rawMaterials: [
        { id: '1', name: 'Aqua', quantity: 25.900, unit: 'KG', percentage: 100 },
        { id: '2', name: 'Glycerin', quantity: 4.280, unit: 'KG', percentage: 100 },
        { id: '3', name: 'Butylene Glycol', quantity: 1.280, unit: 'KG', percentage: 100 },
        { id: '4', name: 'Homosalate', quantity: 2.880, unit: 'KG', percentage: 100 },
        { id: '5', name: 'Ethylhexyl Methoxycinnamate', quantity: 2.180, unit: 'KG', percentage: 100 },
        { id: '6', name: 'Octocrilylene', quantity: 1.480, unit: 'KG', percentage: 100 },
        { id: '7', name: 'Butyl Methoxydibenzoylmethane', quantity: 820, unit: 'KG', percentage: 100 },
        { id: '8', name: 'PEG-100 Stearate/Glyceryl Stearate', quantity: 680, unit: 'KG', percentage: 100 },
        { id: '9', name: 'Stearic Acid', quantity: 880, unit: 'KG', percentage: 100 },
        { id: '10', name: 'Isohexadecane', quantity: 580, unit: 'KG', percentage: 100 },
        { id: '11', name: 'Cyclopentasiloxane', quantity: 420, unit: 'KG', percentage: 100 },
        { id: '12', name: 'Titanium Dioxide (nano)', quantity: 450, unit: 'KG', percentage: 100 },
        { id: '13', name: 'Tocopheryl Acetate', quantity: 210, unit: 'KG', percentage: 100 },
        { id: '14', name: 'Niacinamide', quantity: 680, unit: 'KG', percentage: 100 },
      ],
      packagingMaterials: [
        { id: '1', name: '50g Laminated Tube White Matte', quantity: 18.000, unit: '50 KG', value: 1.0, percentage: 100 },
        { id: '2', name: 'Sunscreen 50g Monocarton Premium', quantity: 22.000, unit: '30 KG', value: 1.2, percentage: 100 },
      ],
    },
    {
      id: '3',
      soNumber: 'EI-SO-2026-003',
      productName: 'El Hydra-Boost Moisturiser',
      productCode: 'EI-FG-003',
      orderQty: '40,000 Units',
      totalKg: '2,000 KG',
      orderDate: '2026-02-15',
      dueDate: '2026-04-25',
      daysLeft: '52 days',
      batchSize: '400 KG',
      batchesRequired: 5,
      bomStatus: 'In Progress',
      approvedBy: 'Amit Kumar',
      color: 'blue',
      rawMaterials: [
        { id: '1', name: 'Aqua', quantity: 30.500, unit: 'KG', percentage: 100 },
        { id: '2', name: 'Glycerin', quantity: 5.200, unit: 'KG', percentage: 100 },
        { id: '3', name: 'Hyaluronic Acid', quantity: 1.800, unit: 'KG', percentage: 100 },
        { id: '4', name: 'Niacinamide', quantity: 2.400, unit: 'KG', percentage: 100 },
        { id: '5', name: 'Ceramide Complex', quantity: 1.200, unit: 'KG', percentage: 100 },
        { id: '6', name: 'Squalane', quantity: 2.800, unit: 'KG', percentage: 100 },
        { id: '7', name: 'Vitamin E', quantity: 0.600, unit: 'KG', percentage: 100 },
      ],
      packagingMaterials: [
        { id: '1', name: '50ml Acrylic PMMA Jar + Lid White', quantity: 32.000, unit: '40 KG', value: 2.5, percentage: 100 },
        { id: '2', name: 'Moisturiser 50ml Monocarton Premium', quantity: 28.000, unit: '40 KG', value: 1.8, percentage: 100 },
      ],
    },
    {
      id: '4',
      soNumber: 'EI-SO-2026-004',
      productName: 'El Keratin Repair Conditioner',
      productCode: 'EI-FG-004',
      orderQty: '35,000 Units',
      totalKg: '5,250 KG',
      orderDate: '2026-02-18',
      dueDate: '2026-05-10',
      daysLeft: '67 days',
      batchSize: '500 KG',
      batchesRequired: 11,
      bomStatus: 'Planned',
      approvedBy: 'Amit Kumar',
      color: 'purple',
      rawMaterials: [
        { id: '1', name: 'Aqua', quantity: 28.400, unit: 'KG', percentage: 100 },
        { id: '2', name: 'Behentrimonium Methosulfate', quantity: 3.500, unit: 'KG', percentage: 100 },
        { id: '3', name: 'Cetearyl Alcohol', quantity: 4.200, unit: 'KG', percentage: 100 },
        { id: '4', name: 'Hydrolyzed Keratin', quantity: 2.800, unit: 'KG', percentage: 100 },
        { id: '5', name: 'Argania Spinosa Kernel Oil', quantity: 1.600, unit: 'KG', percentage: 100 },
        { id: '6', name: 'Panthenol', quantity: 1.200, unit: 'KG', percentage: 100 },
        { id: '7', name: 'Dimethicone', quantity: 2.400, unit: 'KG', percentage: 100 },
      ],
      packagingMaterials: [
        { id: '1', name: '200ml HDPE Bottle White Oval', quantity: 42.000, unit: '50 KG', value: 1.5, percentage: 100 },
        { id: '2', name: '24/410 Pump Cap White', quantity: 35.000, unit: '50 KG', value: 1.2, percentage: 100 },
        { id: '3', name: 'Conditioner Label 120x80mm', quantity: 35.000, unit: '50 KG', value: 0.8, percentage: 100 },
      ],
    },
  ];

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(initialSalesOrders);

  const filteredOrders = useMemo(() => {
    return salesOrders.filter((order) => {
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Prod Released' && order.bomStatus === 'Production Released') ||
        (statusFilter === 'In Progress' && order.bomStatus === 'In Progress') ||
        (statusFilter === 'Planned' && order.bomStatus === 'Planned');

      const matchesSearch =
        order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.soNumber.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [salesOrders, statusFilter, searchTerm]);

  const stats = {
    totalSOS: 4,
    prodReleased: 2,
    shortcuts: 18,
    batchesRequired: 31,
    batchesConfirmed: 0,
    soValue: '₹5,63,30,000',
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handlePlanBatches = (order: SalesOrder) => {
    setSelectedSOForBatch(order);
    setBomFormula(order.rawMaterials);
    setBomPackaging(order.packagingMaterials);
    setIsReadyForProduction(false);
    setPlanBatchesModalOpen(true);
  };

  const handleRaisePR = (order: SalesOrder, pmOnly: boolean = false) => {
    console.log('handleRaisePR called with:', { orderId: order.id, orderNumber: order.soNumber, pmOnly });
    setSelectedSO(order);
    setPrModalOpen(true);
    setPrShowPMOnly(pmOnly);
    setPrPriority('High');
    setPrRequiredByDate(order.dueDate);
    setPrNotes('');
    console.log('State updated - modal should open');
  };

  const handleSendToProcurement = async () => {
    if (!selectedSO) return;
    setPrSending(true);
    try {
      // Create procurement request payload
      const procurementPayload = {
        soNumber: selectedSO.soNumber,
        productName: selectedSO.productName,
        productCode: selectedSO.productCode,
        orderQty: selectedSO.orderQty,
        totalKg: selectedSO.totalKg,
        dueDate: selectedSO.dueDate,
        priority: prPriority,
        requiredByDate: prRequiredByDate,
        notes: prNotes,
        rawMaterials: prShowPMOnly ? [] : selectedSO.rawMaterials.map(rm => ({
          id: rm.id,
          name: rm.name,
          quantity: rm.quantity,
          unit: rm.unit,
          percentage: rm.percentage
        })),
        packagingMaterials: selectedSO.packagingMaterials.map(pm => ({
          id: pm.id,
          name: pm.name,
          quantity: pm.quantity,
          unit: pm.unit,
          value: pm.value,
          percentage: pm.percentage
        })),
        createdAt: new Date().toISOString(),
        createdBy: 'Current User' // This should come from auth context
      };

      // Send to Procurement API
      const response = await api.post('/api/v1/procurement', procurementPayload);
      
      if (response) {
        addToast('success', `PR for SO #${selectedSO.soNumber} sent to Procurement successfully`);
        
        // Close modal and reset state
        setPrModalOpen(false);
        setSelectedSO(null);
        setPrPriority('High');
        setPrRequiredByDate('');
        setPrNotes('');
        setPrShowPMOnly(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send PR to Procurement';
      addToast('error', errorMessage);
      console.error('Error sending to procurement:', error);
    } finally {
      setPrSending(false);
    }
  };

  const handleConfirmBOM = async () => {
    if (!selectedSOForBatch) return;
    try {
      // Create BOM confirmation payload
      const bomPayload = {
        soNumber: selectedSOForBatch.soNumber,
        productName: selectedSOForBatch.productName,
        numBatches: parseInt(numBatches),
        batchSizeKg: parseInt(batchSizeKg),
        plannedStartDate: plannedStartDate,
        productionLine: productionLine,
        formulaBOM: bomFormula.map(item => ({
          id: item.id,
          name: item.name,
          percentage: item.percentage,
          quantity: item.quantity,
          unit: item.unit
        })),
        packBOM: bomPackaging.map(item => ({
          id: item.id,
          name: item.name,
          value: item.value,
          quantity: item.quantity,
          unit: item.unit
        })),
        confirmedAt: new Date().toISOString(),
        confirmedBy: 'Current User'
      };

      // Send to API
      const response = await api.post('/api/v1/bom/confirm', bomPayload);
      
      // Show success notification
      addToast('success', `Batch plan created for ${selectedSOForBatch.productName} - ${numBatches} batches × ${batchSizeKg} KG scheduled`);
      setIsReadyForProduction(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to confirm BOM';
      addToast('error', errorMessage);
      console.error('Error confirming BOM:', error);
    }
  };

  const handleSendToProduction = () => {
    if (!selectedSOForBatch || !canSendToProduction) return;

    addToast('success', `Plan for ${selectedSOForBatch.productName} sent to Production successfully`);

    setPlanBatchesModalOpen(false);
    setSelectedSOForBatch(null);
    setBomFormula([]);
    setBomPackaging([]);
    setActiveBatchTab('feasibility');
    setNumBatches('15');
    setBatchSizeKg('500');
    setPlannedStartDate('2026-03-04');
    setProductionLine('Line 1 — Primary Mixer');
    setIsReadyForProduction(false);
  };

  const handleRaisePRFromBatch = () => {
    if (selectedSOForBatch) {
      // Close Plan Batches modal first, then open PR modal with PM items only
      setPlanBatchesModalOpen(false);
      setPrModalOpen(true);
      setSelectedSO(selectedSOForBatch);
      setPrShowPMOnly(true);
      setPrPriority('High');
      setPrRequiredByDate(selectedSOForBatch.dueDate);
      setPrNotes('');
    }
  };

  const handleQuickAddRM = () => {
    if (!quickAddRmCode || !quickAddInciName || !quickAddPercentage) {
      addToast('error', 'All fields are required');
      return;
    }
    
    const newItem: RawMaterial = {
      id: `custom-${Date.now()}`,
      name: quickAddInciName,
      quantity: parseFloat(quickAddPercentage),
      unit: 'KG',
      percentage: parseFloat(quickAddPercentage)
    };
    
    setBomFormula([...bomFormula, newItem]);
    setQuickAddRmCode('');
    setQuickAddInciName('');
    setQuickAddPercentage('');
    
    addToast('success', `${quickAddInciName} (${quickAddPercentage}%) added to Formula BOM`);
  };

  const handleSendToProductionFromCard = async (order: SalesOrder) => {
    if (order.bomStatus !== 'Production Ready' || productionSentOrderIds.includes(order.id)) return;

    try {
      await api.post('/api/v1/production/send', {
        soNumber: order.soNumber,
        productName: order.productName,
        productCode: order.productCode,
        batchesRequired: order.batchesRequired,
        sentAt: new Date().toISOString(),
        sentBy: 'Current User'
      });
    } catch (error) {
      // keep UX functional even if endpoint is unavailable in local/mock environments
      console.error('Send to production API call failed:', error);
    }

    setSalesOrders((prev) =>
      prev.map((entry) =>
        entry.id === order.id ? { ...entry, bomStatus: 'Production Released' } : entry
      )
    );

    if (selectedSOForBatch?.id === order.id) {
      setSelectedSOForBatch({ ...selectedSOForBatch, bomStatus: 'Production Released' });
    }

    setProductionSentOrderIds((prev) => [...prev, order.id]);
    addToast('success', `${order.productName} sent to Production`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Production Released':
        return 'bg-teal-100 text-teal-700';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700';
      case 'Planned':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Production Released':
        return 'bg-emerald-100 text-emerald-700';
      case 'Production Ready':
        return 'bg-green-100 text-green-700';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
            <p className="text-sm text-gray-500">Production Planning Hub</p>
          </div>
          <button 
            onClick={() => {
              try {
                console.log('Raise PR button clicked', { salesOrdersCount: salesOrders.length, hasOrders: salesOrders.length > 0 });
                if (salesOrders && salesOrders.length > 0) {
                  const firstOrder = salesOrders[0];
                  console.log('Calling handleRaisePR with:', { orderId: firstOrder.id, orderNumber: firstOrder.soNumber });
                  handleRaisePR(firstOrder, false);
                  console.log('handleRaisePR called successfully');
                } else {
                  console.warn('No sales orders available');
                  addToast('warning', 'No sales orders available to raise PR');
                }
              } catch (error) {
                console.error('Error in Raise PR button click:', error);
                addToast('error', 'Error opening PR modal');
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
          >
            Raise PR
          </button>
        </div>

        {/* Status Badges */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
            4 Active SOs
          </div>
          <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
            18 Shortages
          </div>
          <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
            0 PIs Raised
          </div>
          <div className="text-gray-500 text-sm ml-auto">Planning: Feb 2026</div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {activeMainTab === 'items-involved' ? (
            <>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">CONFIRMED PRODUCTS</p>
                <p className="text-2xl font-bold text-emerald-600">{(currentStats as any).confirmedProducts.value}</p>
                <p className="text-xs text-gray-500 mt-1">of {(currentStats as any).confirmedProducts.total} total</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">RM ITEMS</p>
                <p className="text-2xl font-bold text-cyan-600">{(currentStats as any).rmItems.value}</p>
                <p className="text-xs text-gray-500 mt-1">{(currentStats as any).rmItems.ok} OK, {(currentStats as any).rmItems.short} short</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PM ITEMS</p>
                <p className="text-2xl font-bold text-purple-600">{(currentStats as any).pmItems.value}</p>
                <p className="text-xs text-gray-500 mt-1">{(currentStats as any).pmItems.ok} OK, {(currentStats as any).pmItems.short} short</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">RM SHORTAGES</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as any).rmShortages}</p>
                <p className="text-xs text-gray-500 mt-1">Items below order req</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PM SHORTAGES</p>
                <p className="text-2xl font-bold text-red-600">{(currentStats as any).pmShortages}</p>
                <p className="text-xs text-gray-500 mt-1">Items below order req</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PRS RAISED</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as any).prsRaised}</p>
                <p className="text-xs text-gray-500 mt-1">Pending procurement</p>
              </div>
            </>
          ) : activeMainTab === 'availability-summary' ? (
            <>
              <div className="bg-white rounded-lg p-4 border border-gray-200 col-span-2">
                <p className="text-gray-600 text-xs font-medium mb-1">SHORTAGE IDENTIFIED (SO/PR)</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as any).shortageIdentified.so} / {(currentStats as any).shortageIdentified.pr}</p>
                <p className="text-xs text-gray-500 mt-1">Orders with shortages</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">REQUIRED LEAD DAYS (DAYS)</p>
                <p className="text-2xl font-bold text-blue-600">{(currentStats as any).requiredLeadDays}</p>
                <p className="text-xs text-gray-500 mt-1">Average lead time</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200 col-span-2">
                <p className="text-gray-600 text-xs font-medium mb-1">RECEIVED & COMPLETED (SO/PR)</p>
                <p className="text-2xl font-bold text-green-600">{(currentStats as any).receivedCompleted.so} / {(currentStats as any).receivedCompleted.pr}</p>
                <p className="text-xs text-gray-500 mt-1">Fulfilled orders</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">CRITICAL SHORTAGE (SO/PR)</p>
                <p className="text-2xl font-bold text-red-600">{(currentStats as any).criticalShortage.so} / {(currentStats as any).criticalShortage.pr}</p>
                <p className="text-xs text-gray-500 mt-1">Urgent orders</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">TOTAL SOS</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as any).totalSOs}</p>
                <p className="text-xs text-gray-500 mt-1">Approved orders</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PROD. RELEASED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as any).prodReleased}</p>
                <p className="text-xs text-gray-500 mt-1">Ready to plan</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">RM/PM SHORTAGES</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as any).shortages}</p>
                <p className="text-xs text-gray-500 mt-1">needs below order req</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">BATCHES REQUIRED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as any).batchesRequired}</p>
                <p className="text-xs text-gray-500 mt-1">Across all products</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">BATCHES CONFIRMED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as any).batchesConfirmed}</p>
                <p className="text-xs text-gray-500 mt-1">BOM confirmed & planned</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">SO VALUE</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as any).soValue}</p>
              </div>
            </>
          )}
        </div>

        {/* Main Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveMainTab('pis-extracted')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
              activeMainTab === 'pis-extracted'
                ? 'text-emerald-700 border-emerald-700'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            📋 PIs Extracted
          </button>
          <button
            onClick={() => setActiveMainTab('items-involved')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
              activeMainTab === 'items-involved'
                ? 'text-emerald-700 border-emerald-700'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            ✎ Items Involved
          </button>
          <button
            onClick={() => setActiveMainTab('availability-summary')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
              activeMainTab === 'availability-summary'
                ? 'text-emerald-700 border-emerald-700'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            📊 Availability Summary
          </button>
        </div>

        {/* PIs Extracted Tab Content */}
        {activeMainTab === 'pis-extracted' && (
        <>
        {/* Tabs and Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">STATUS:</span>
            {['All', 'Prod Released', 'In Progress', 'Planned'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-gray-800 border border-gray-300 shadow-xs'
                    : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 mt-4">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search product, SO, client"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Sales Orders Cards */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Card Header */}
              <button
                onClick={() => toggleExpand(order.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    order.color === 'pink' ? 'bg-pink-400' : 'bg-orange-400'
                  }`}
                >
                  {order.productName.charAt(0)}
                </div>

                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{order.productName}</h3>
                    <span className="text-xs text-gray-500">{order.soNumber}</span>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusBadgeColor(order.bomStatus)}`}>
                      {order.bomStatus === 'Production Released' ? 'Production Released' : order.bomStatus}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{order.productCode} | SO: {order.soNumber}</p>
                </div>

                <div className="flex items-center gap-12 mr-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">35,280</p>
                    <p className="text-xs text-gray-500">7,427 KG</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">1,43,000</p>
                    <p className="text-xs text-gray-500">₹ 2,00,000 pcs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-orange-600">₹ 8,868</p>
                    <p className="text-xs text-gray-500">1,500 KG total</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">50,000</p>
                    <p className="text-xs text-gray-500">16d</p>
                  </div>
                </div>

                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedId === order.id ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expanded Content */}
              {expandedId === order.id && (
                <div className="p-4 border-t border-gray-100">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-8 gap-4 mb-6 pb-4 border-b border-gray-100 text-center">
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">SO Number</p>
                      <p className="text-sm font-semibold text-gray-900">{order.soNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Order QTY</p>
                      <p className="text-sm font-semibold text-gray-900">{order.orderQty}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Total KG</p>
                      <p className="text-sm font-semibold text-gray-900">{order.totalKg}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Order Date</p>
                      <p className="text-sm font-semibold text-gray-900">{order.orderDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Due Date</p>
                      <p className="text-sm font-semibold text-gray-900">{order.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Days Left</p>
                      <p className="text-sm font-semibold text-gray-900">{order.daysLeft}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Batch Size</p>
                      <p className="text-sm font-semibold text-gray-900">{order.batchSize}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Batches Required</p>
                      <p className="text-sm font-semibold text-red-600">{order.batchesRequired} batches</p>
                    </div>
                  </div>

                  {/* BOM Status and Approved By */}
                  <div className="flex items-center gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">BOM Status</p>
                      <span
                        className={`text-xs px-3 py-1 rounded font-medium ${getStatusBadgeColor(
                          order.bomStatus
                        )}`}
                      >
                        {order.bomStatus}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase mb-1">Approved By</p>
                      <p className="text-sm font-semibold text-gray-900">{order.approvedBy}</p>
                    </div>
                  </div>

                  {/* Plan Batches Confirm Button - Disabled: Use Availability Summary Tab Instead */}
                  <div className="mb-6 text-right">
                    <button disabled className="bg-gray-100 text-gray-400 border border-gray-200 px-3 py-1.5 rounded-md font-semibold text-xs cursor-not-allowed" title="Use Availability Summary tab to plan batches">
                      ⦿ Plan Batches & Confirm BOM
                    </button>
                    <p className="text-xs text-gray-500 mt-2">💡 Go to "Availability Summary" tab to plan batches</p>
                  </div>

                  {/* Raw Materials Section */}
                  <div className="mb-8">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center text-base">
                      <span className="w-3 h-3 bg-teal-500 rounded-full mr-3"></span>
                      RM — {order.rawMaterials.length} ITEMS
                    </h4>
                    <div className="space-y-4">
                      {order.rawMaterials.map((item) => (
                        <div key={item.id} className="flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-900 font-medium">{item.name}</span>
                            <span className="text-sm text-teal-600 font-semibold">
                              {item.quantity.toFixed(0)}/{item.quantity.toFixed(3)} {item.unit}
                            </span>
                          </div>
                          <div className="h-3 bg-teal-500 rounded-sm w-full shadow-sm"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Packaging Materials Section */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center text-base">
                      <span className="w-3 h-3 bg-orange-500 rounded-full mr-3"></span>
                      PM — {order.packagingMaterials.length} ITEMS
                    </h4>
                    <div className="space-y-4">
                      {order.packagingMaterials.map((item) => (
                        <div key={item.id} className="flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-900 font-medium">{item.name}</span>
                            <span className="text-sm text-orange-600 font-semibold">
                              {item.quantity.toFixed(0)}/{item.quantity.toFixed(3)} {item.unit}
                            </span>
                          </div>
                          <div className="h-3 bg-orange-500 rounded-sm w-full shadow-sm"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-gray-500">
                        Value: <span className="text-orange-600 font-semibold">₹1,39,60,000</span> · Approved by <span className="font-semibold text-gray-700">{order.approvedBy}</span>
                      </p>
                      {order.bomStatus === 'Production Ready' && (
                        <button
                          onClick={() => handleSendToProductionFromCard(order)}
                          disabled={productionSentOrderIds.includes(order.id)}
                          className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {productionSentOrderIds.includes(order.id) ? '✓ Sent to Production' : '🚀 Send to Production'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        </>
        )}
        
        {activeMainTab === 'items-involved' && (
          <div className="space-y-4">
            {/* Filters Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="font-medium text-sm text-gray-600">CATEGORY:</span>
                <button className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">All</button>
                <button className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">RM</button>
                <button className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">PM</button>
                <button className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-600">Shortage</button>
                <button className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-600">Available</button>
                <select className="px-3 py-1 rounded text-sm border border-gray-300 text-gray-700">
                  <option>All Products</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search item, code, INCI..." className="flex-1 outline-none text-sm" />
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto w-full">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">ITEM / INCI</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">CODE</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">CAT</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">USED IN</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">TOTAL REQ</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SIH</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SURPLUS/<br/>SHORTAGE</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">WH BATCHES</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">EXPIRY</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BOM FLAG</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsInvolved.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-2">
                        <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                        {item.itemType === 'PM' && <div className="text-xs text-gray-500">Primary A</div>}
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-blue-600 font-medium text-xs">{item.code}</span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`text-xs font-semibold px-1 py-0.5 rounded ${
                          item.itemType === 'PM' 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {item.itemType}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="w-5 h-5 bg-pink-100 rounded-full flex items-center justify-center mx-auto">
                          <span className="text-xs font-bold text-pink-700">{item.usedIn}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-gray-900 text-xs">{item.totalReq}</td>
                      <td className="px-2 py-2 text-right text-orange-600 font-medium text-xs">{item.sih}</td>
                      <td className={`px-2 py-2 text-right font-semibold text-xs ${
                        item.surplusShortage.includes('-') ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {item.surplusShortage}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className={`h-1.5 rounded-sm w-10 ${
                            item.coverage === '100%' ? 'bg-green-500' : 'bg-orange-400'
                          }`}></div>
                          <span className="text-xs font-semibold text-gray-700">{item.coverage}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-900 text-xs">{item.whBatches}</td>
                      <td className="px-2 py-2 text-center text-gray-600 text-xs">{item.expiry}</td>
                      <td className="px-2 py-2 text-center text-gray-500 text-xs">{item.bomFlag}</td>
                      <td className="px-2 py-2 text-center">
                        {item.itemType === 'PM' && item.surplusShortage.includes('-') && (
                          <button
                              onClick={() => {
                                setSelectedItem(item);
                                setSingleItemPrModalOpen(true);
                              }}
                              className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-semibold text-xs hover:bg-orange-200"
                            >
                              PR
                            </button>
                          )}
                          {(item.itemType === 'RM' || !item.surplusShortage.includes('-')) && (
                            <span className="text-green-600 font-semibold text-xs">✓ OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {/* Single Item PR Modal */}
        {singleItemPrModalOpen && selectedItem && (
          <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Raise Procurement Request</h2>
                <button
                  onClick={() => {
                    setSingleItemPrModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Item Info Banner */}
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-center gap-3">
                  <span>📦</span>
                  <span>Single item PR — <strong>{selectedItem.name}</strong></span>
                </div>

                {/* Item Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">PM CODE</label>
                    <input
                      type="text"
                      value={selectedItem.code}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">NAME</label>
                    <input
                      type="text"
                      value={selectedItem.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">SIH</label>
                    <input
                      type="text"
                      value={`${selectedItem.sih} pcs`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED</label>
                    <input
                      type="text"
                      value={selectedItem.totalReq}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">SHORTAGE</label>
                    <input
                      type="text"
                      value={selectedItem.surplusShortage}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">ORDER QTY (+ 10% BUFFER)</label>
                    <input
                      type="text"
                      value="13201"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                </div>

                {/* Priority and Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">PRIORITY</label>
                    <select
                      value={singleItemPrPriority}
                      onChange={(e) => setSingleItemPrPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED BY</label>
                    <input
                      type="date"
                      value={singleItemPrRequiredByDate}
                      onChange={(e) => setSingleItemPrRequiredByDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSingleItemPrModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSingleItemPrSending(true);
                    try {
                      // Parse numeric values from shortage string
                      const shortageNum = Math.abs(parseInt(selectedItem.surplusShortage.replace(/,/g, '')) || 0);
                      const requiredNum = parseInt(selectedItem.totalReq.toString().replace(/,/g, '')) || 0;
                      const sihNum = parseInt(selectedItem.sih.toString().replace(/,/g, '')) || 0;
                      const orderQtyNum = shortageNum > 0 ? Math.ceil(shortageNum * 1.1) : requiredNum;

                      const procurementPayload = {
                        itemId: selectedItem.id,
                        itemName: selectedItem.name,
                        itemCode: selectedItem.code,
                        itemType: selectedItem.itemType,
                        category: selectedItem.category,
                        sih: sihNum,
                        required: requiredNum,
                        shortage: shortageNum,
                        orderQuantity: orderQtyNum,
                        priority: singleItemPrPriority,
                        requiredByDate: singleItemPrRequiredByDate,
                        createdAt: new Date().toISOString(),
                        createdBy: 'Current User'
                      };

                      await api.post('/api/v1/procurement', procurementPayload);
                      addToast('success', `PR raised for ${selectedItem.name}`);
                      setSingleItemPrModalOpen(false);
                      setSelectedItem(null);
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Failed to raise PR';
                      addToast('error', errorMessage);
                      console.error('Error raising PR:', error);
                    } finally {
                      setSingleItemPrSending(false);
                    }
                  }}
                  disabled={singleItemPrSending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {singleItemPrSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    '✓ Send to Procurement'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Availability Summary Tab */}
        {activeMainTab === 'availability-summary' && (
          <>
          <div className="space-y-4">
            {/* Product Cards Row */}
            <div className="grid grid-cols-4 gap-4">
              {availabilitySummaryProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  {/* Product Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${product.iconBg} flex items-center justify-center text-xl`}>
                      {product.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-gray-900 uppercase">{product.name}</h3>
                    </div>
                  </div>

                  {/* Stats and Status */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">RM</span>
                      <span className="text-xs font-bold text-cyan-600">{product.rmPercentage}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">PM</span>
                      <span className="text-xs font-bold text-purple-600">{product.pmPercentage}%</span>
                    </div>
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${product.statusColor}`}>
                      {product.status}
                    </span>
                  </div>

                  {/* Due Date */}
                  <p className="text-xs text-gray-500 mb-3">Due in {product.dueIn} days</p>

                  {/* Plan Batches Button */}
                  <button
                    onClick={() => {
                      console.log('[Plan Batches] Button clicked for product:', product.name, 'soId:', product.soId);
                      console.log('[Plan Batches] Available SOs:', salesOrders.map(so => ({ id: so.id, productName: so.productName })));
                      
                      const correspondingSO = salesOrders.find(so => so.id === product.soId);
                      console.log('[Plan Batches] Found SO:', correspondingSO);
                      
                      if (!correspondingSO && salesOrders.length === 0) {
                        console.error('[Plan Batches] No sales orders available');
                        addToast('error', 'No sales orders available');
                        return;
                      }
                      
                      const soToUse = correspondingSO || salesOrders[0];
                      console.log('[Plan Batches] Using SO:', soToUse);
                      
                      // Set selected SO first
                      setSelectedSOForBatch(soToUse);
                      
                      // Initialize batch data
                      setNumBatches(soToUse.batchesRequired.toString());
                      setBatchSizeKg(soToUse.batchSize.includes(' KG') ? soToUse.batchSize.replace(' KG', '') : soToUse.batchSize);
                      setPlannedStartDate('2026-03-05');
                      setProductionLine('Line 1 — Primary Mixer');
                      
                      // Set BOM data
                      setBomFormula(soToUse.rawMaterials);
                      setBomPackaging(soToUse.packagingMaterials);
                      
                      // Set production status
                      setIsReadyForProduction(soToUse.bomStatus === 'Production Ready' || soToUse.bomStatus === 'Production Released');
                      
                      // Set active tab
                      setActiveBatchTab('feasibility');
                      
                      // Open modal
                      setPlanBatchesModalOpen(true);
                      
                      console.log('[Plan Batches] Modal opened, planBatchesModalOpen = true, selectedSOForBatch set');
                    }}
                    className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-semibold transition-colors"
                  >
                    ⚙ Plan Batches
                  </button>
                </div>
              ))}
            </div>

            {/* Two Column Tables Section */}
            <div className="grid grid-cols-2 gap-4">
              {/* All RM vs Whole Order Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">🧪 All RM vs Whole Order</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">RM</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">REQ KG</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SIH KG</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityRMItems.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">
                            <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                            <div className="text-xs text-blue-600">{item.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-gray-900 font-semibold text-xs">{item.reqKg}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-cyan-600 font-semibold text-xs">{item.sihKg}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    item.coverage >= 100 ? 'bg-green-500' :
                                    item.coverage >= 75 ? 'bg-orange-400' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(item.coverage, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 w-8 text-right">{item.coverage}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${item.statusColor}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* All PM vs Whole Order Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">📦 All PM vs Whole Order</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">PM</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">REQUIRED</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SIH</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityPMItems.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">
                            <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                            <div className="text-xs text-blue-600">{item.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-gray-900 font-semibold text-xs">{item.required}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-cyan-600 font-semibold text-xs">{item.sih}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    item.coverage >= 100 ? 'bg-green-500' :
                                    item.coverage >= 75 ? 'bg-orange-400' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(item.coverage, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 w-8 text-right">{item.coverage}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${item.statusColor}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Batches & Confirm BOM Modal */}
          {planBatchesModalOpen && selectedSOForBatch && (
            <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Plan Batches — {selectedSOForBatch.productName}</h2>
                    <p className="text-xs text-gray-500 mt-1">{selectedSOForBatch.soNumber} - Qty: {selectedSOForBatch.orderQty} - Total KG: {selectedSOForBatch.totalKg}</p>
                  </div>
                  <button
                    onClick={() => {
                      setPlanBatchesModalOpen(false);
                      setSelectedSOForBatch(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  {/* Tabs */}
                  <div className="flex gap-4 border-b border-gray-200">
                    <button 
                      onClick={() => setActiveBatchTab('feasibility')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'feasibility'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📊 Feasibility
                    </button>
                    <button 
                      onClick={() => setActiveBatchTab('batch-plan')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'batch-plan'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 Batch Plan
                    </button>
                    <button 
                      onClick={() => setActiveBatchTab('bom-editor')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'bom-editor'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ✎ BOM Editor
                    </button>
                    <button 
                      onClick={() => setActiveBatchTab('swap-add')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'swap-add'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ↔ Swap / Add
                    </button>
                  </div>

                  {/* Tab Content */}
                  {activeBatchTab === 'feasibility' && (
                    <div className="space-y-6">
                      {/* Order Summary */}
                      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                        <p className="text-xs font-semibold text-cyan-900">
                          📦 Order: {selectedSOForBatch.orderQty} · Total KG: {selectedSOForBatch.totalKg} · Batch KG: {selectedSOForBatch.batchSize} · {selectedSOForBatch.batchesRequired} batches required
                        </p>
                      </div>

                      {/* Feasibility Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <FeasibilityCard
                          type="rm"
                          title="BY RM ONLY"
                          possibleUnits={0}
                          limitingFactor="Disodium Cocoyl Glutamate"
                          isShortfall={true}
                          needed={15}
                          canDo={0}
                        />
                        <FeasibilityCard
                          type="pm"
                          title="BY PM ONLY"
                          possibleUnits={26664}
                          limitingFactor="Facewash 150ml Monocarton"
                          isShortfall={true}
                          needed={15}
                          canDo={8}
                        />
                        <FeasibilityCard
                          type="combined"
                          title="COMBINED (RM+PM)"
                          possibleUnits={0}
                          limitingFactor=""
                          isShortfall={true}
                          canDo={0}
                        />
                      </div>

                      {/* RM Feasibility Table */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                          RM FEASIBILITY — PER BATCH (~{selectedSOForBatch.batchSize})
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">RM ITEM</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">% IN BOM</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">PER BATCH KG</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">SIH KG</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">MAX BATCHES</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">TOTAL REQ</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedSOForBatch.rawMaterials.map((item, idx) => {
                                const batchSize = parseInt(selectedSOForBatch.batchSize.replace(/[^0-9]/g, '')) || 500;
                                const pct = (item.percentage / 100) * (idx === 0 ? 34.5 : (Math.random() * 12 + 1));
                                const perBatch = (batchSize * pct / 100);
                                const sih = item.quantity;
                                const maxBatches = perBatch > 0 ? Math.floor(sih / perBatch) : 999;
                                const totalReq = perBatch * selectedSOForBatch.batchesRequired;
                                return (
                                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 text-gray-900 font-medium">{item.name}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{pct.toFixed(2)}%</td>
                                    <td className="px-4 py-3 text-right text-teal-700 font-semibold">{perBatch.toFixed(0)} KG</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{sih.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-cyan-700 font-bold">{maxBatches}</td>
                                    <td className="px-4 py-3 text-right text-gray-900 font-medium">{totalReq.toFixed(0)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-1 text-xs font-semibold rounded ${maxBatches >= selectedSOForBatch.batchesRequired ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {maxBatches >= selectedSOForBatch.batchesRequired ? 'Ok' : 'Short'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* PM Feasibility Table */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          PM FEASIBILITY — PER BATCH
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">PM ITEM</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">QTY/UNIT</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">PER BATCH PCS</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">SIH</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">MAX BATCHES</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">TOTAL REQ</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedSOForBatch.packagingMaterials.map((item, idx) => {
                                const unitsPerBatch = Math.ceil(parseInt(selectedSOForBatch.orderQty.replace(/[^0-9]/g, '')) / selectedSOForBatch.batchesRequired);
                                const sih = item.quantity * 1000;
                                const maxBatches = Math.floor(sih / unitsPerBatch);
                                const totalReq = unitsPerBatch * selectedSOForBatch.batchesRequired;
                                return (
                                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 text-gray-900 font-medium">{item.name}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">1</td>
                                    <td className="px-4 py-3 text-right text-orange-700 font-semibold">{unitsPerBatch.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{sih.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-cyan-700 font-bold">{maxBatches}</td>
                                    <td className="px-4 py-3 text-right text-gray-900 font-medium">{totalReq.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-1 text-xs font-semibold rounded ${maxBatches >= selectedSOForBatch.batchesRequired ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {maxBatches >= selectedSOForBatch.batchesRequired ? 'Ok' : 'Low'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Batch Plan Tab */}
                  {activeBatchTab === 'batch-plan' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2">NUMBER OF BATCHES</label>
                          <input type="number" value={numBatches} onChange={(e) => setNumBatches(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2">BATCH SIZE (KG)</label>
                          <input type="number" value={batchSizeKg} onChange={(e) => setBatchSizeKg(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2">PLANNED START DATE</label>
                          <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2">PRODUCTION LINE</label>
                          <select value={productionLine} onChange={(e) => setProductionLine(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option>Line 1 — Primary Mixer</option>
                            <option>Line 2 — Secondary Mixer</option>
                            <option>Multi-line split</option>
                          </select>
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                          <span>✓</span>
                          {numBatches} batches × {batchSizeKg} KG = {(parseInt(numBatches) * parseInt(batchSizeKg)).toLocaleString()} KG → ~{(parseInt(numBatches) * 3333).toLocaleString()} units
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">Exactly meets order requirement.</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4">BATCH SCHEDULE</h3>
                        <div className="grid grid-cols-10 gap-2">
                          {Array.from({ length: parseInt(numBatches) || 0 }).map((_, idx) => (
                            <div key={idx} className="border-2 border-emerald-200 rounded-lg p-3 text-center bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">
                              <p className="text-xs font-bold text-emerald-700">B-{String(idx + 1).padStart(2, '0')}</p>
                              <p className="text-xs text-emerald-600 mt-1">{batchSizeKg} KG</p>
                              <p className="text-xs text-emerald-600 font-semibold mt-1">Planned</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BOM Editor Tab */}
                  {activeBatchTab === 'bom-editor' && (
                    <div className="space-y-6">
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3">
                        <span className="text-yellow-600 text-lg mt-0.5">⚠</span>
                        <div>
                          <p className="text-sm font-semibold text-yellow-900">Editing BOM for {selectedSOForBatch.productName}. Changes take effect only after &quot;Confirm BOM &amp; Plan Batches&quot;.</p>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="text-emerald-600">✓</span>FORMULA BOM ({bomFormula.length} RM ITEMS)
                        </h3>
                        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                          {bomFormula.map((item, idx) => (
                            <div key={item.id} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                <p className="text-xs text-blue-600 font-medium">EI-RM-{String(idx + 1).padStart(5, '0')} · {item.percentage}% · Phase A</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <input type="number" value={item.percentage} onChange={(e) => { const updated = [...bomFormula]; updated[idx] = { ...item, percentage: parseFloat(e.target.value) }; setBomFormula(updated); }} step="0.1" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <span className="text-sm font-semibold text-gray-600">%</span>
                                <button onClick={() => setBomFormula(bomFormula.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><X size={16} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button className="mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-2" onClick={() => setActiveBatchTab('swap-add')}>
                          <span>+</span>Add RM via Swap Panel
                        </button>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="text-orange-500">●</span>PACK BOM ({bomPackaging.length} PM ITEMS)
                        </h3>
                        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                          {bomPackaging.map((item, idx) => (
                            <div key={item.id} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                <p className="text-xs text-blue-600 font-medium">EI-PM-{String(idx + 1).padStart(5, '0')} · {idx === 0 ? 'Primary' : 'Secondary'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <input type="number" value={item.value} onChange={(e) => { const updated = [...bomPackaging]; updated[idx] = { ...item, value: parseFloat(e.target.value) }; setBomPackaging(updated); }} step="0.1" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <span className="text-sm font-semibold text-gray-600">Qty/unit</span>
                                <button onClick={() => setBomPackaging(bomPackaging.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><X size={16} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Swap / Add Tab */}
                  {activeBatchTab === 'swap-add' && (
                    <div className="bg-white">
                      <div className="bg-cyan-50 border-y border-cyan-200 px-6 py-3">
                        <p className="text-xs text-cyan-800 font-semibold">Universal Swap & Add — Click an item to swap it with a BOM ingredient, or use Quick Add to add new items.</p>
                      </div>
                      <div className="flex max-h-[60vh]">
                        <div className="flex-1 border-r border-gray-200 overflow-y-auto p-6 space-y-4">
                          {inventoryCategories.map((category) => (
                            <div key={category.name}>
                              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{category.name}</h3>
                              <div className="space-y-2">
                                {category.items.map((item) => (
                                  <div key={item.id} className="px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-sm bg-white border border-gray-200">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-800 truncate">{item.name}</p>
                                      <p className="text-xs text-gray-500 truncate">{item.code} · {item.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${item.status === 'IN BOM' ? 'bg-green-100 text-green-800' : item.status === 'AVAILABLE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                                      <span className="text-sm font-bold text-gray-700">{Math.floor(Math.random() * 2000)} KG</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-xs font-bold text-gray-700 mb-3">Quick Add RM to BOM</h4>
                            <div className="space-y-2">
                              <input type="text" placeholder="RM Code" value={quickAddRmCode} onChange={(e) => setQuickAddRmCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                              <input type="text" placeholder="INCI Name" value={quickAddInciName} onChange={(e) => setQuickAddInciName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                              <input type="number" placeholder="%" value={quickAddPercentage} onChange={(e) => setQuickAddPercentage(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                              <button onClick={handleQuickAddRM} className="w-full px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"><span>+</span> Add to Working BOM</button>
                            </div>
                          </div>
                        </div>
                        <div className="w-2/5 bg-gray-50 border-l border-gray-200 overflow-y-auto p-6">
                          <h3 className="text-sm font-bold text-gray-800 mb-4">CURRENT BOM — {selectedSOForBatch.productName}</h3>
                          <div className="space-y-3">
                            {bomFormula.map((item, idx) => (
                              <div key={item.id} className="bg-white rounded-lg p-3 flex items-center gap-3 border border-gray-200 shadow-sm">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500">EI-RM-{String(idx + 1).padStart(5, '0')} · {item.percentage}% · Phase A</p>
                                </div>
                                <button className="text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-md transition-colors">Swap</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="border-t border-gray-200 p-6 flex gap-3 justify-between">
                  <button
                    onClick={() => { setPlanBatchesModalOpen(false); setSelectedSOForBatch(null); setIsReadyForProduction(false); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => handleRaisePRFromBatch()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors">
                      🔴 Raise PR for Shortages
                    </button>
                    <button onClick={() => handleConfirmBOM()} disabled={canSendToProduction} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                      {canSendToProduction ? '✓ BOM Confirmed' : '✓ Confirm BOM & Plan Batches'}
                    </button>
                    {canSendToProduction && (
                      <button onClick={() => handleSendToProduction()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        🚀 Send to Production
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
        )}

      </div>

      {/* PR Modal Popup - Global: renders across all tabs */}
      {prModalOpen && selectedSO && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Raise Procurement Request</h2>
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); }} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                <span className="text-yellow-500 mt-0.5">ℹ️</span>
                <span>
                  {prShowPMOnly ? (
                    <>Raising PR for {selectedSO.packagingMaterials.length} PM items with shortages for <strong>{selectedSO.productName}</strong>.</>
                  ) : (
                    <>Raising PR for {selectedSO.rawMaterials.length} RM and {selectedSO.packagingMaterials.length} PM items with shortages for <strong>{selectedSO.productName}</strong>.</>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">PRIORITY</label>
                  <select value={prPriority} onChange={(e) => setPrPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED BY DATE</label>
                  <input type="date" value={prRequiredByDate} onChange={(e) => setPrRequiredByDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">NOTES TO PROCUREMENT</label>
                <textarea value={prNotes} onChange={(e) => setPrNotes(e.target.value)} placeholder="Any special instructions..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} />
              </div>
              {selectedSO.packagingMaterials.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-orange-500 rounded-full"></span>PM Items ({selectedSO.packagingMaterials.length})</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-4 py-2 text-left font-semibold text-gray-700">PM</th><th className="px-4 py-2 text-left font-semibold text-gray-700">PRODUCT</th><th className="px-4 py-2 text-right font-semibold text-gray-700">REQUIRED</th><th className="px-4 py-2 text-right font-semibold text-gray-700">SIH</th><th className="px-4 py-2 text-right font-semibold text-gray-700">SHORTAGE</th></tr></thead>
                      <tbody>
                        {selectedSO.packagingMaterials.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-gray-900"><div>{item.name}</div><div className="text-xs text-gray-500">EI-PM-BTL-00001</div></td>
                            <td className="px-4 py-3 text-gray-700">{selectedSO.productName}</td>
                            <td className="px-4 py-3 text-right text-gray-900 font-medium">50,000</td>
                            <td className="px-4 py-3 text-right text-orange-600 font-medium">38,000</td>
                            <td className="px-4 py-3 text-right text-red-600 font-semibold">+12,000</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {!prShowPMOnly && selectedSO.rawMaterials.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-teal-500 rounded-full"></span>RM Items ({selectedSO.rawMaterials.length})</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-4 py-2 text-left font-semibold text-gray-700">RM</th><th className="px-4 py-2 text-left font-semibold text-gray-700">PRODUCT</th><th className="px-4 py-2 text-right font-semibold text-gray-700">REQUIRED</th><th className="px-4 py-2 text-right font-semibold text-gray-700">SIH</th><th className="px-4 py-2 text-right font-semibold text-gray-700">SHORTAGE</th></tr></thead>
                      <tbody>
                        {selectedSO.rawMaterials.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-gray-700">{selectedSO.productName}</td>
                            <td className="px-4 py-3 text-right text-gray-900 font-medium">{item.quantity.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-orange-600 font-medium">{(item.quantity * 0.75).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-semibold">+{(item.quantity * 0.25).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-transparent hover:bg-gray-100 transition-colors disabled:opacity-50" disabled={prSending}>Cancel</button>
              <button onClick={handleSendToProcurement} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2" disabled={prSending}>
                {prSending ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Sending...</>) : '✓ Send to Procurement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
