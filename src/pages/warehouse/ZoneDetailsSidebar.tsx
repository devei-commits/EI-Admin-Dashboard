import { useEffect, useMemo, useState } from 'react';

interface Bay {
  id: string;
  name: string;
  levels: number;
  slotsPerLevel: number;
  condition: string;
  utilization: number;
  items: Array<{
    id: string;
    code: string;
    status: 'available' | 'alert' | 'warning';
  }>;
}

interface ZoneItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  status: 'available' | 'alert' | 'warning';
  lastUpdated: string;
  category: string;
  uom: string;
  zone: string;
  rackSlot: string;
  batchNo: string;
  mfgExp: string;
  stockBreakdown: {
    wh: number;
    ml1: number;
    ml2: number;
    sih: number;
    reserved: number;
    inStock: string;
  };
  avgConsumption?: {
    aug: number;
    sep: number;
    oct: number;
    threeMonthAvg: number;
    daysOfStock: number;
  };
  specifications?: {
    material: string;
    size: string;
    printStatus: string;
  };
}

interface Zone {
  id: string;
  name: string;
  type: string;
  location: string;
  utilization: number;
  items: number;
  racks: number;
}

interface ZoneDetailsSidebarProps {
  zone: Zone | null;
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  onClearSelectedItem?: () => void;
  onClose: () => void;
}

const ZoneDetailsSidebar: React.FC<ZoneDetailsSidebarProps> = ({
  zone,
  selectedItemId,
  onSelectItem,
  onClearSelectedItem,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory'>('overview');
  const [isAddRackModalOpen, setIsAddRackModalOpen] = useState(false);
  const [bays, setBays] = useState<Bay[]>([]);
  const [rackForm, setRackForm] = useState({
    zoneLocation: 'Primary Pack Store',
    bayCode: '',
    rackName: '',
    levels: '4',
    slotsPerLevel: '4',
    condition: 'Ambient',
  });
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    adjustType: 'Add (Receipt)',
    location: 'WH Stock',
    quantity: '0',
    reason: '',
    adjustedBy: 'Karan Nair',
  });

  if (!zone) return null;

  const getInitialBays = (zoneId: string): Bay[] =>
    zoneId === '1'
      ? [
          {
            id: '1',
            name: 'Bay A1 — Ambient Rack 1',
            levels: 4,
            slotsPerLevel: 4,
            condition: 'Ambient',
            utilization: 92,
            items: [
              { id: 'i1', code: 'RM001', status: 'available' },
              { id: 'i2', code: 'RM002', status: 'available' },
              { id: 'i3', code: 'RM003', status: 'available' },
              { id: 'i4', code: 'RM004', status: 'available' },
              { id: 'i5', code: 'RM005', status: 'available' },
              { id: 'i6', code: 'RM006', status: 'available' },
            ],
          },
          {
            id: '2',
            name: 'Bay A2 — Ambient Rack 2',
            levels: 4,
            slotsPerLevel: 4,
            condition: 'Ambient',
            utilization: 95,
            items: [
              { id: 'i7', code: 'RM007', status: 'available' },
              { id: 'i8', code: 'RM008', status: 'available' },
              { id: 'i9', code: 'RM009', status: 'alert' },
              { id: 'i10', code: 'RM010', status: 'available' },
              { id: 'i11', code: 'RM011', status: 'available' },
              { id: 'i12', code: 'RM012', status: 'available' },
            ],
          },
          {
            id: '3',
            name: 'Bay A3 — Ambient Rack 3',
            levels: 4,
            slotsPerLevel: 4,
            condition: 'Ambient',
            utilization: 89,
            items: [
              { id: 'i13', code: 'RM013', status: 'available' },
              { id: 'i14', code: 'RM014', status: 'available' },
              { id: 'i15', code: 'RM015', status: 'warning' },
              { id: 'i16', code: 'RM016', status: 'available' },
              { id: 'i17', code: 'RM017', status: 'available' },
              { id: 'i18', code: 'RM018', status: 'available' },
            ],
          },
        ]
      : [
          {
            id: '1',
            name: 'Pack Bay C1 — Bottles',
            levels: 4,
            slotsPerLevel: 4,
            condition: 'Ambient',
            utilization: 95,
            items: [
              { id: 'i1', code: 'ACT001', status: 'available' },
              { id: 'i2', code: 'ACT002', status: 'available' },
              { id: 'i3', code: 'ACT003', status: 'available' },
              { id: 'i4', code: 'ACT004', status: 'available' },
              { id: 'i5', code: 'ACT005', status: 'alert' },
              { id: 'i6', code: 'ACT006', status: 'available' },
            ],
          },
          {
            id: '2',
            name: 'Pack Bay C2 — Labels',
            levels: 4,
            slotsPerLevel: 4,
            condition: 'Ambient',
            utilization: 88,
            items: [
              { id: 'i7', code: 'ACT007', status: 'available' },
              { id: 'i8', code: 'ACT008', status: 'available' },
              { id: 'i9', code: 'ACT009', status: 'available' },
              { id: 'i10', code: 'ACT010', status: 'available' },
              { id: 'i11', code: 'ACT011', status: 'available' },
              { id: 'i12', code: 'ACT012', status: 'warning' },
            ],
          },
        ];

  useEffect(() => {
    setBays(getInitialBays(zone.id));
  }, [zone.id]);

  const [zoneItems, setZoneItems] = useState<ZoneItem[]>([]);

  useEffect(() => {
    setZoneItems([
      {
        id: '1',
        code: 'EI-PM-TUB-001',
        name: '50g Aluminium Laminated Tube',
        quantity: 15000,
        unit: 'pcs',
        status: 'available',
        lastUpdated: '2h ago',
        category: 'Tube',
        uom: 'pcs',
        zone: 'Primary Pack Store',
        rackSlot: 'C2-L1-S1',
        batchNo: 'BT-TUB-001',
        mfgExp: '2025-09-01 → 2028-08-31',
        stockBreakdown: {
          wh: 12500,
          ml1: 2500,
          ml2: 0,
          sih: 15000,
          reserved: 10000,
          inStock: 'In Stock',
        },
      },
      {
        id: '2',
        code: 'EI-RM-SES-001',
        name: 'SLES 70%',
        quantity: 220,
        unit: 'kg',
        status: 'available',
        lastUpdated: '4h ago',
        category: 'Raw Material',
        uom: 'kg',
        zone: 'RM Store',
        rackSlot: 'A2-L2-S4',
        batchNo: 'BT-SES-001',
        mfgExp: '2025-07-20 → 2027-07-19',
        stockBreakdown: {
          wh: 180,
          ml1: 40,
          ml2: 0,
          sih: 220,
          reserved: 30,
          inStock: 'In Stock',
        },
      },
      {
        id: '3',
        code: 'EI-RM-STR-001',
        name: 'Stearic Acid',
        quantity: 180,
        unit: 'kg',
        status: 'warning',
        lastUpdated: '6h ago',
        category: 'Raw Material',
        uom: 'kg',
        zone: 'RM Store',
        rackSlot: 'A3-L1-S2',
        batchNo: 'BT-STR-001',
        mfgExp: '2025-06-01 → 2027-05-31',
        stockBreakdown: {
          wh: 120,
          ml1: 60,
          ml2: 0,
          sih: 180,
          reserved: 20,
          inStock: 'In Stock',
        },
      },
      {
        id: '4',
        code: 'EI-RM-WAX-001',
        name: 'Beeswax Pellets',
        quantity: 75,
        unit: 'kg',
        status: 'available',
        lastUpdated: '1h ago',
        category: 'Raw Material',
        uom: 'kg',
        zone: 'RM Store',
        rackSlot: 'A1-L3-S1',
        batchNo: 'BT-WAX-001',
        mfgExp: '2025-10-15 → 2027-10-14',
        stockBreakdown: {
          wh: 55,
          ml1: 20,
          ml2: 0,
          sih: 75,
          reserved: 8,
          inStock: 'In Stock',
        },
      },
      {
        id: '5',
        code: 'EI-RM-GUM-001',
        name: 'Gum Acacia',
        quantity: 30,
        unit: 'kg',
        status: 'alert',
        lastUpdated: '30m ago',
        category: 'Raw Material',
        uom: 'kg',
        zone: 'Actives Store',
        rackSlot: 'B1-L1-S3',
        batchNo: 'BT-GUM-001',
        mfgExp: '2025-03-01 → 2026-12-31',
        stockBreakdown: {
          wh: 20,
          ml1: 10,
          ml2: 0,
          sih: 30,
          reserved: 12,
          inStock: 'Critical',
        },
      },
      {
        id: '6',
        code: 'EI-RM-OIL-001',
        name: 'Mineral Oil Light',
        quantity: 320,
        unit: 'litre',
        status: 'available',
        lastUpdated: '2h ago',
        category: 'Raw Material',
        uom: 'litre',
        zone: 'RM Store',
        rackSlot: 'A4-L2-S2',
        batchNo: 'BT-OIL-001',
        mfgExp: '2025-11-11 → 2028-11-10',
        stockBreakdown: {
          wh: 250,
          ml1: 70,
          ml2: 0,
          sih: 320,
          reserved: 40,
          inStock: 'In Stock',
        },
      },
      {
        id: '7',
        code: 'EI-RM-ALC-001',
        name: 'Isopropyl Alcohol',
        quantity: 125,
        unit: 'litre',
        status: 'available',
        lastUpdated: '5h ago',
        category: 'Raw Material',
        uom: 'litre',
        zone: 'RM Store',
        rackSlot: 'A1-L4-S4',
        batchNo: 'BT-ALC-001',
        mfgExp: '2025-08-05 → 2027-08-04',
        stockBreakdown: {
          wh: 100,
          ml1: 25,
          ml2: 0,
          sih: 125,
          reserved: 10,
          inStock: 'In Stock',
        },
      },
      {
        id: '8',
        code: 'EI-RM-VEG-001',
        name: 'Vegetable Glycerin',
        quantity: 210,
        unit: 'kg',
        status: 'available',
        lastUpdated: '3h ago',
        category: 'Raw Material',
        uom: 'kg',
        zone: 'RM Store',
        rackSlot: 'A2-L4-S1',
        batchNo: 'BT-VEG-001',
        mfgExp: '2025-09-15 → 2027-09-14',
        stockBreakdown: {
          wh: 150,
          ml1: 60,
          ml2: 0,
          sih: 210,
          reserved: 25,
          inStock: 'In Stock',
        },
      },
    ]);
  }, [zone.id]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return zoneItems.find((item) => item.id === selectedItemId) || null;
  }, [selectedItemId, zoneItems]);

  const selectedItemAvg = selectedItem?.avgConsumption ?? {
    aug: 16000,
    sep: 8500,
    oct: 11000,
    threeMonthAvg: 9833,
    daysOfStock: 46,
  };

  const selectedItemSpecs = selectedItem?.specifications ?? {
    material: 'Aluminium/PE laminate',
    size: 'Φ25mm x 130mm',
    printStatus: 'Approved',
  };

  const handleRackFormChange = (field: keyof typeof rackForm, value: string) => {
    setRackForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddRack = () => {
    const levels = Math.max(1, Number(rackForm.levels) || 1);
    const slotsPerLevel = Math.max(1, Number(rackForm.slotsPerLevel) || 1);
    const totalSlots = levels * slotsPerLevel;
    const baseCode = rackForm.bayCode.trim() || `R${bays.length + 1}`;
    const rackName = rackForm.rackName.trim() || `Bay ${baseCode} — ${rackForm.condition} Rack`;

    const newBay: Bay = {
      id: `new-${Date.now()}`,
      name: rackName,
      levels,
      slotsPerLevel,
      condition: rackForm.condition,
      utilization: 0,
      items: Array.from({ length: totalSlots }).map((_, index) => ({
        id: `new-${Date.now()}-${index + 1}`,
        code: `${baseCode}${String(index + 1).padStart(2, '0')}`,
        status: 'available' as const,
      })),
    };

    setBays((prev) => [...prev, newBay]);
    setIsAddRackModalOpen(false);
    setRackForm((prev) => ({ ...prev, bayCode: '', rackName: '', levels: '4', slotsPerLevel: '4', condition: 'Ambient' }));
  };

  const applyAdjustStock = () => {
    if (!selectedItem) return;

    const qty = Number(adjustForm.quantity) || 0;
    const nextQty =
      adjustForm.adjustType === 'Add (Receipt)'
        ? selectedItem.quantity + qty
        : Math.max(0, selectedItem.quantity - qty);

    setZoneItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              quantity: nextQty,
              lastUpdated: 'Just now',
              stockBreakdown: {
                ...item.stockBreakdown,
                sih:
                  adjustForm.adjustType === 'Add (Receipt)'
                    ? item.stockBreakdown.sih + qty
                    : Math.max(0, item.stockBreakdown.sih - qty),
                wh:
                  adjustForm.location === 'WH Stock'
                    ? adjustForm.adjustType === 'Add (Receipt)'
                      ? item.stockBreakdown.wh + qty
                      : Math.max(0, item.stockBreakdown.wh - qty)
                    : item.stockBreakdown.wh,
                ml1:
                  adjustForm.location === 'ML1 Stock'
                    ? adjustForm.adjustType === 'Add (Receipt)'
                      ? item.stockBreakdown.ml1 + qty
                      : Math.max(0, item.stockBreakdown.ml1 - qty)
                    : item.stockBreakdown.ml1,
                ml2:
                  adjustForm.location === 'ML2 Stock'
                    ? adjustForm.adjustType === 'Add (Receipt)'
                      ? item.stockBreakdown.ml2 + qty
                      : Math.max(0, item.stockBreakdown.ml2 - qty)
                    : item.stockBreakdown.ml2,
              },
            }
          : item
      )
    );

    setIsAdjustStockOpen(false);
    setAdjustForm((prev) => ({ ...prev, quantity: '0', reason: '' }));
  };

  return (
    <>
      <div className="fixed right-0 top-0 bottom-0 w-130 bg-white border-l border-gray-200 shadow-lg overflow-y-auto z-40">
        {!selectedItem && (
          <>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{zone.name}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>

              <div className="flex gap-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-2 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'overview'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Racks
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`pb-2 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'inventory'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Items in this zone
                </button>
              </div>
            </div>

            <div className="border-b border-gray-200 p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Zone Code</p>
                  <p className="text-sm font-bold text-emerald-600">{zone.name}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Area</p>
                  <p className="text-sm font-bold text-gray-900">120 sqm</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Utilisation</p>
                  <p className="text-sm font-bold text-emerald-600">{zone.utilization}%</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Temperature / Conditions</p>
                <p className="text-sm text-gray-900 font-medium">Cool &lt;25°C / Climate controlled</p>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Storage Requirements</p>
                <p className="text-sm text-gray-900 font-medium">Cool climate-controlled &lt;25°C · Double-lock access · CCTV monitored</p>
              </div>
            </div>

            <div className="p-4 pb-6">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest">Racks</h3>
                    <button
                      onClick={() => setIsAddRackModalOpen(true)}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      Add Rack
                    </button>
                  </div>

                  {bays.map((bay) => {
                    const levelLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    const slotLabels = Array.from({ length: bay.levels }).flatMap((_, levelIndex) =>
                      Array.from({ length: bay.slotsPerLevel }).map((__, slotIndex) => {
                        const levelPrefix = levelLetters[levelIndex] || `L${levelIndex + 1}`;
                        return `${levelPrefix}${slotIndex + 1}`;
                      })
                    );
                    const filledSlots = slotLabels.map((label, index) => ({
                      label,
                      item: bay.items[index] || null,
                    }));

                    return (
                      <div key={bay.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-gray-900 text-sm">{bay.name}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-red-300 text-red-600 bg-red-50">{bay.utilization}%</span>
                        </div>

                        <p className="text-xs text-gray-500 mb-3">
                          {bay.levels} levels · {bay.levels * bay.slotsPerLevel} slots · {bay.condition}
                        </p>

                        <div className="grid grid-cols-8 gap-2">
                          {filledSlots.map((slot) => (
                            <div
                              key={`${bay.id}-${slot.label}`}
                              className={`h-14 rounded-md border flex items-center justify-center text-center px-1 ${
                                !slot.item
                                  ? 'bg-white border-gray-300 text-gray-400'
                                  : slot.item.status === 'available'
                                  ? 'bg-cyan-500 border-cyan-400 text-white'
                                  : slot.item.status === 'alert'
                                  ? 'bg-red-500 border-red-400 text-white'
                                  : 'bg-yellow-500 border-yellow-400 text-white'
                              }`}
                              title={slot.item ? slot.item.code : `Empty ${slot.label}`}
                            >
                              <div className="leading-tight">
                                <p className="text-[10px] font-bold">{slot.item ? slot.item.code.slice(-3) : '--'}</p>
                                <p className="text-[10px] font-bold">{slot.label}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-gray-500 mt-3">150ml Clear PET Pump Bottle</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'inventory' && (
                <div>
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest">Items in this zone ({zoneItems.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {zoneItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectItem?.(item.id)}
                        className="flex items-center justify-between gap-3 py-2.5 px-3 rounded border border-gray-200 cursor-pointer bg-white"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-600 font-mono whitespace-nowrap">{item.code}</p>
                          <p className="text-sm text-gray-900 font-medium">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                            {item.quantity} {item.unit}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold border-2 border-emerald-600 text-emerald-600 bg-transparent">
                            In Stock
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {selectedItem && (
          <div className="bg-white text-gray-900 min-h-full">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">Inventory — {selectedItem.name}</p>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-md bg-gray-100 text-gray-500 hover:text-gray-800"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-cyan-50 border border-cyan-300 text-cyan-700">SIH: {selectedItem.stockBreakdown.sih.toLocaleString()} pcs</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-50 border border-blue-300 text-blue-700">WH: {selectedItem.stockBreakdown.wh.toLocaleString()}</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-indigo-50 border border-indigo-300 text-indigo-700">ML1: {selectedItem.stockBreakdown.ml1.toLocaleString()}</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-violet-50 border border-violet-300 text-violet-700">ML2: {selectedItem.stockBreakdown.ml2.toLocaleString()}</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-50 border border-amber-300 text-amber-700">Reserved: {selectedItem.stockBreakdown.reserved.toLocaleString()}</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-50 border border-emerald-300 text-emerald-700">{selectedItem.stockBreakdown.inStock}</span>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-2">Item Details</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Item Code</p>
                    <p className="text-xs font-bold text-emerald-700">{selectedItem.code}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">INC / Category</p>
                    <p className="text-xs font-semibold text-gray-900">{selectedItem.category}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">UOM</p>
                    <p className="text-xs font-semibold text-emerald-700">{selectedItem.uom}</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-2">Storage Location</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Zone</p>
                    <p className="text-xs font-semibold text-gray-900">{selectedItem.zone}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Rack / Slot</p>
                    <p className="text-xs font-semibold text-emerald-700">{selectedItem.rackSlot}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Batch No.</p>
                    <p className="text-xs font-semibold text-emerald-700">{selectedItem.batchNo}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">MFG / EXP Date</p>
                    <p className="text-xs font-semibold text-gray-900">{selectedItem.mfgExp}</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-2">Stock Breakdown</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="rounded-md border border-cyan-200 bg-cyan-50 p-2">
                    <p className="text-[10px] text-cyan-700">Stock in Warehouse</p>
                    <p className="text-2xl font-bold text-cyan-700">{selectedItem.stockBreakdown.wh.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-2">
                    <p className="text-[10px] text-blue-700">In Manufacturing</p>
                    <p className="text-2xl font-bold text-blue-700">{(selectedItem.stockBreakdown.ml1 + selectedItem.stockBreakdown.ml2).toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                    <p className="text-[10px] text-emerald-700">Stock in Hand</p>
                    <p className="text-2xl font-bold text-emerald-700">{selectedItem.stockBreakdown.sih.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-2">Avg Consumption (Monthly)</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Aug 2025</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItemAvg.aug.toLocaleString()} pcs</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Sep 2025</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItemAvg.sep.toLocaleString()} pcs</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Oct 2025</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItemAvg.oct.toLocaleString()} pcs</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">3-Month Avg / Mo</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItemAvg.threeMonthAvg.toLocaleString()} pcs/month</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Days of Stock (SIH)</p>
                    <p className="text-sm font-bold text-emerald-700">{selectedItemAvg.daysOfStock} days</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-2">Item Specifications</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Material</p>
                    <p className="text-xs font-semibold text-gray-900">{selectedItemSpecs.material}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white">
                    <p className="text-[10px] text-gray-500">Size</p>
                    <p className="text-xs font-semibold text-gray-900">{selectedItemSpecs.size}</p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-2 bg-white col-span-2">
                    <p className="text-[10px] text-gray-500">Print Status</p>
                    <p className="text-xs font-semibold text-emerald-700">{selectedItemSpecs.printStatus}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-2">
              <button
                onClick={() => setIsAdjustStockOpen(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                Adjust Stock
              </button>
              <button
                onClick={() => onClearSelectedItem?.()}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {isAddRackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-190 rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-700">
              <h3 className="text-3xl font-bold tracking-tight">Add New Rack / Bay</h3>
              <button
                onClick={() => setIsAddRackModalOpen(false)}
                className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                aria-label="Close add rack popup"
              >
                ✕
              </button>
            </div>

            <div className="px-7 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Zone / Location *</label>
                  <select
                    value={rackForm.zoneLocation}
                    onChange={(e) => handleRackFormChange('zoneLocation', e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  >
                    <option>RM Store</option>
                    <option>Actives Store</option>
                    <option>Primary Pack Store</option>
                    <option>Labels Store</option>
                    <option>Secondary Pack Store</option>
                    <option>Finished Goods Store</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Bay Code *</label>
                  <input
                    value={rackForm.bayCode}
                    onChange={(e) => handleRackFormChange('bayCode', e.target.value)}
                    placeholder="e.g. F1"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Rack Name</label>
                <input
                  value={rackForm.rackName}
                  onChange={(e) => handleRackFormChange('rackName', e.target.value)}
                  placeholder="e.g. Bay F1 — Ambient Shelf"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">No. of Levels</label>
                  <input
                    type="number"
                    min={1}
                    value={rackForm.levels}
                    onChange={(e) => handleRackFormChange('levels', e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Slots Per Level</label>
                  <input
                    type="number"
                    min={1}
                    value={rackForm.slotsPerLevel}
                    onChange={(e) => handleRackFormChange('slotsPerLevel', e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Condition</label>
                  <select
                    value={rackForm.condition}
                    onChange={(e) => handleRackFormChange('condition', e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  >
                    <option>Ambient</option>
                    <option>Cool &lt;25°C</option>
                    <option>Cold 2–8°C</option>
                    <option>Humidity controlled</option>
                    <option>Climate controlled</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-7 py-4 border-t border-slate-700">
              <button
                onClick={handleAddRack}
                className="px-6 py-2.5 rounded-xl bg-cyan-400 text-slate-900 font-bold hover:bg-cyan-300"
              >
                Add Rack
              </button>
              <button
                onClick={() => setIsAddRackModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-700 text-slate-100 font-bold hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdjustStockOpen && selectedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-190 rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-700">
              <div>
                <h3 className="text-4xl font-bold tracking-tight leading-tight">Adjust Stock — {selectedItem.name}</h3>
              </div>
              <button
                onClick={() => setIsAdjustStockOpen(false)}
                className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                aria-label="Close adjust stock popup"
              >
                ✕
              </button>
            </div>

            <div className="px-7 py-6 space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Current Stock</p>
                <div className="h-px bg-cyan-700/40 mb-3" />
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-md border border-cyan-700 bg-cyan-900/30 text-cyan-300 font-bold">WH: {selectedItem.stockBreakdown.wh.toLocaleString()} pcs</span>
                  <span className="px-3 py-1 rounded-md border border-blue-700 bg-blue-900/30 text-blue-300 font-bold">ML1: {selectedItem.stockBreakdown.ml1.toLocaleString()}</span>
                  <span className="px-3 py-1 rounded-md border border-violet-700 bg-violet-900/30 text-violet-300 font-bold">ML2: {selectedItem.stockBreakdown.ml2.toLocaleString()}</span>
                  <span className="px-3 py-1 rounded-md border border-emerald-700 bg-emerald-900/30 text-emerald-300 font-bold">SIH: {selectedItem.stockBreakdown.sih.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Adjust Type</label>
                  <select
                    value={adjustForm.adjustType}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, adjustType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  >
                    <option>Add (Receipt)</option>
                    <option>Deduct (Consumption)</option>
                    <option>Write-off</option>
                    <option>Return from ML</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Location</label>
                  <select
                    value={adjustForm.location}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  >
                    <option>WH Stock</option>
                    <option>ML1 Stock</option>
                    <option>ML2 Stock</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Reason</label>
                  <input
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Reason for adjustment"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Adjusted By</label>
                <select
                  value={adjustForm.adjustedBy}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, adjustedBy: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-cyan-500"
                >
                  <option>Karan Nair</option>
                  <option>Ravi Kumar</option>
                  <option>Priya Sharma</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-7 py-4 border-t border-slate-700">
              <button
                onClick={applyAdjustStock}
                className="px-6 py-2.5 rounded-xl bg-cyan-400 text-slate-900 font-bold hover:bg-cyan-300"
              >
                Save Adjustment
              </button>
              <button
                onClick={() => setIsAdjustStockOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-700 text-slate-100 font-bold hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ZoneDetailsSidebar;
