import { useRef, useState } from 'react';

interface MRN {
  id: string;
  mrnNo: string;
  requestedBy: string;
  requestedByType: string;
  productName: string;
  productCode: string;
  batchSize: string;
  itemsCount: number;
  requiredDate: string;
  picker: string | null;
  status: 'Pending Pick' | 'In Pick' | 'In Transfer' | 'Completed';
}

interface PickLineItem {
  id: string;
  name: string;
  location: string;
  available: number;
  required: number;
  uom: string;
}

type StatusFilter = 'All' | 'Pending Pick' | 'In Pick' | 'In Transfer' | 'Completed';

const mockMRNs: MRN[] = [
  {
    id: '1',
    mrnNo: 'EI-MRN-2025-001',
    requestedBy: 'Batch Mfg',
    requestedByType: 'ML1',
    productName: 'EI Sunscreen SPF50+',
    productCode: 'BTH-SUN-001',
    batchSize: '500 KG',
    itemsCount: 12,
    requiredDate: '2025-11-20',
    picker: null,
    status: 'Pending Pick',
  },
  {
    id: '2',
    mrnNo: 'EI-MRN-2025-002',
    requestedBy: 'Batch Mfg',
    requestedByType: 'ML1',
    productName: 'EI Gentle Foaming Facewash',
    productCode: 'BTH-FW-001',
    batchSize: '500 KG',
    itemsCount: 8,
    requiredDate: '2025-11-21',
    picker: 'Santosh Kumar',
    status: 'In Pick',
  },
  {
    id: '3',
    mrnNo: 'EI-MRN-2025-003',
    requestedBy: 'Packaging',
    requestedByType: 'ML2',
    productName: 'EI Sunscreen SPF50+ — Fill & Pack',
    productCode: 'BTH-SUN-001-PACK',
    batchSize: '10,000 units',
    itemsCount: 3,
    requiredDate: '2025-11-22',
    picker: 'Ravi Kumar',
    status: 'In Transfer',
  },
  {
    id: '4',
    mrnNo: 'EI-MRN-2025-004',
    requestedBy: 'Batch Mfg',
    requestedByType: 'ML2',
    productName: 'EI Gentle Foaming Facewash',
    productCode: 'BTH-FW-002',
    batchSize: '500 KG',
    itemsCount: 2,
    requiredDate: '2025-11-17',
    picker: 'Karan Nair',
    status: 'Completed',
  },
];

const mockPickItemsByMrn: Record<string, PickLineItem[]> = {
  '1': [
    { id: 'p1', name: 'Aqua (Purified Water)', location: 'A1-L2-S3', available: 380, required: 261.5, uom: 'KG' },
    { id: 'p2', name: 'Glycerin', location: 'A1-L1-S5', available: 95, required: 15, uom: 'KG' },
    { id: 'p3', name: 'Homosalate', location: 'B1-L1-S1', available: 58, required: 50, uom: 'KG' },
    { id: 'p4', name: 'Octinoxate', location: 'B1-L1-S2', available: 28, required: 37.5, uom: 'KG' },
    { id: 'p5', name: 'Octocrylene', location: 'B1-L2-S1', available: 32, required: 40, uom: 'KG' },
    { id: 'p6', name: 'Avobenzone', location: 'B1-L2-S2', available: 10, required: 15, uom: 'KG' },
    { id: 'p7', name: 'Cetearyl Alcohol', location: 'A2-L1-S4', available: 42, required: 15, uom: 'KG' },
    { id: 'p8', name: 'Ceteareth-20', location: 'A2-L1-S5', available: 28, required: 10, uom: 'KG' },
    { id: 'p9', name: 'Tocopheryl Acetate', location: 'B2-L2-S2', available: 6, required: 2.5, uom: 'KG' },
    { id: 'p10', name: 'Niacinamide', location: 'B2-L1-S1', available: 22, required: 10, uom: 'KG' },
    { id: 'p11', name: 'Ascorbyl Glucoside', location: 'B2-L1-S2', available: 4, required: 5, uom: 'KG' },
    { id: 'p12', name: 'Phenoxyethanol', location: 'B2-L2-S1', available: 18, required: 4, uom: 'KG' },
  ],
  '2': [
    { id: 'p13', name: 'SLES 70%', location: 'A2-L1-S3', available: 95, required: 65, uom: 'KG' },
    { id: 'p14', name: 'CAPB 35%', location: 'A2-L2-S3', available: 55, required: 40, uom: 'KG' },
    { id: 'p15', name: 'SCI', location: 'A2-L3-S2', available: 30, required: 15, uom: 'KG' },
  ],
  '3': [
    { id: 'p16', name: '50ml Airless Pump Bottle', location: 'C1-L3-S2', available: 2500, required: 1200, uom: 'PCS' },
    { id: 'p17', name: '100ml Airless Pump Bottle', location: 'C1-L3-S4', available: 1800, required: 850, uom: 'PCS' },
    { id: 'p18', name: '30ml Tube with Flip Cap', location: 'C2-L2-S1', available: 3200, required: 950, uom: 'PCS' },
  ],
  '4': [
    { id: 'p19', name: 'Cetearyl Alcohol', location: 'A2-L1-S4', available: 42, required: 8, uom: 'KG' },
    { id: 'p20', name: 'Ceteareth-20', location: 'A2-L1-S5', available: 28, required: 6, uom: 'KG' },
  ],
};

const OutboundDashboard = () => {
  const [mrnData, setMrnData] = useState<MRN[]>(mockMRNs);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [selectedMRNId, setSelectedMRNId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'pick' | 'view'>('pick');
  const [assignedPicker, setAssignedPicker] = useState('');
  const [assignedTransferBy, setAssignedTransferBy] = useState('');
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});
  const [pickedQty, setPickedQty] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [pickStateByMrn, setPickStateByMrn] = useState<
    Record<
      string,
      {
        assignedPicker: string;
        assignedTransferBy: string;
        pickedItems: Record<string, boolean>;
        pickedQty: Record<string, string>;
      }
    >
  >({});

  const selectedMRN = mrnData.find((mrn) => mrn.id === selectedMRNId) ?? null;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  const activePickItems = selectedMRN ? mockPickItemsByMrn[selectedMRN.id] ?? [] : [];

  const handleOpenPanel = (mrn: MRN, mode: 'pick' | 'view') => {
    setSelectedMRNId(mrn.id);
    setPanelMode(mode);

    const existingState = pickStateByMrn[mrn.id];
    setAssignedPicker(existingState?.assignedPicker ?? mrn.picker ?? '');
    setAssignedTransferBy(existingState?.assignedTransferBy ?? '');
    setPickedItems(existingState?.pickedItems ?? {});

    const initialQty: Record<string, string> = {};
    (mockPickItemsByMrn[mrn.id] ?? []).forEach((item) => {
      initialQty[item.id] = existingState?.pickedQty?.[item.id] ?? String(item.required);
    });
    setPickedQty(initialQty);
  };

  const closePickPanel = () => {
    setSelectedMRNId(null);
  };

  const persistPanelState = (mrnId: string) => {
    setPickStateByMrn((prev) => ({
      ...prev,
      [mrnId]: {
        assignedPicker,
        assignedTransferBy,
        pickedItems,
        pickedQty,
      },
    }));
  };

  const handleSavePick = () => {
    if (!selectedMRN) return;
    if (!assignedPicker) {
      showToast('Please assign a picker before saving.', 'error');
      return;
    }

    const hasAnyPickedItem = Object.values(pickedItems).some(Boolean);
    if (!hasAnyPickedItem) {
      showToast('Please select at least one picked item before saving.', 'error');
      return;
    }

    persistPanelState(selectedMRN.id);
    setMrnData((prev) =>
      prev.map((mrn) =>
        mrn.id === selectedMRN.id
          ? {
              ...mrn,
              picker: assignedPicker,
              status: 'In Pick',
            }
          : mrn
      )
    );
    showToast(`Pick saved for ${selectedMRN.mrnNo}. Status updated to In Pick.`);
  };

  const handleInitiateTransfer = () => {
    if (!selectedMRN) return;
    if (!assignedPicker) {
      showToast('Please assign a picker before initiating transfer.', 'error');
      return;
    }
    if (!assignedTransferBy) {
      showToast('Please assign transfer team before initiating transfer.', 'error');
      return;
    }

    persistPanelState(selectedMRN.id);
    setMrnData((prev) =>
      prev.map((mrn) =>
        mrn.id === selectedMRN.id
          ? {
              ...mrn,
              picker: assignedPicker,
              status: 'In Transfer',
            }
          : mrn
      )
    );
    closePickPanel();
    showToast(`Transfer initiated for ${selectedMRN.mrnNo}. Status updated to In Transfer.`);
  };

  const handleCompleteTransfer = (mrnId: string) => {
    const doneMrn = mrnData.find((mrn) => mrn.id === mrnId);
    setMrnData((prev) =>
      prev.map((mrn) =>
        mrn.id === mrnId
          ? {
              ...mrn,
              status: 'Completed',
            }
          : mrn
      )
    );
    showToast(`Cycle completed for ${doneMrn?.mrnNo ?? 'MRN'}. Status updated to Completed.`);
  };

  const getStatusCounts = () => {
    return {
      total: mrnData.length,
      pendingPick: mrnData.filter(m => m.status === 'Pending Pick').length,
      inPick: mrnData.filter(m => m.status === 'In Pick').length,
      inTransfer: mrnData.filter(m => m.status === 'In Transfer').length,
      completed: mrnData.filter(m => m.status === 'Completed').length,
    };
  };

  const counts = getStatusCounts();

  const filteredMRNs = mrnData.filter(mrn => {
    const matchesSearch = 
      mrn.mrnNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mrn.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mrn.productCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || mrn.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Pending Pick':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'In Pick':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'In Transfer':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const getActionButton = (mrn: MRN) => {
    switch (mrn.status) {
      case 'Pending Pick':
        return (
          <button
            onClick={() => handleOpenPanel(mrn, 'pick')}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded transition-colors"
          >
            Assign & Pick
          </button>
        );
      case 'In Pick':
        return (
          <button
            onClick={() => handleOpenPanel(mrn, 'pick')}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded transition-colors"
          >
            Continue Pick
          </button>
        );
      case 'In Transfer':
        return (
          <button
            onClick={() => handleCompleteTransfer(mrn.id)}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded transition-colors"
          >
            Complete Transfer
          </button>
        );
      case 'Completed':
        return (
          <button
            onClick={() => handleOpenPanel(mrn, 'view')}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded transition-colors border border-slate-200"
          >
            View
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-white relative">
      {toast && (
        <div className="fixed top-4 right-4 z-70">
          <div
            className={`px-3 py-2 rounded-md border text-xs font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="p-6 w-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-cyan-200 rounded-lg p-4">
            <div className="text-cyan-700 text-xs font-semibold uppercase tracking-wider mb-2">Total MRNs</div>
            <div className="text-3xl font-bold text-cyan-400">{counts.total}</div>
          </div>
          <div className="bg-white border border-rose-200 rounded-lg p-4">
            <div className="text-rose-700 text-xs font-semibold uppercase tracking-wider mb-2">Pending Pick</div>
            <div className="text-3xl font-bold text-rose-600">{counts.pendingPick}</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-lg p-4">
            <div className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">In Pick</div>
            <div className="text-3xl font-bold text-amber-600">{counts.inPick}</div>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2">In Transfer</div>
            <div className="text-3xl font-bold text-blue-600">{counts.inTransfer}</div>
          </div>
          <div className="bg-white border border-emerald-200 rounded-lg p-4">
            <div className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-2">Completed</div>
            <div className="text-3xl font-bold text-emerald-600">{counts.completed}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white border border-slate-200 rounded-lg">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-900 mb-4">Stock Request Notes (MRN)</h1>
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {(['All', 'Pending Pick', 'In Pick', 'In Transfer', 'Completed'] as StatusFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    statusFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search MRN, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">MRN NO.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Requested By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">For Product / Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch Size</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Required Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Picker</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMRNs.map(mrn => (
                  <tr key={mrn.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-amber-700 font-medium text-sm">{mrn.mrnNo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 text-sm">{mrn.requestedBy} — {mrn.requestedByType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 text-sm font-medium">{mrn.productName}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{mrn.productCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 text-sm">{mrn.batchSize}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 text-sm">{mrn.itemsCount} items</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-rose-600 text-sm">{mrn.requiredDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${mrn.picker ? 'text-slate-900' : 'text-slate-400'}`}>
                        {mrn.picker || 'Unassigned'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(mrn.status)}`}>
                        {mrn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getActionButton(mrn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedMRN && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/25">
          <div className="h-full w-full max-w-105 bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Stock Request — {selectedMRN.mrnNo}</h2>
              <button
                onClick={closePickPanel}
                className="h-7 w-7 rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="inline-flex px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-semibold">
                {selectedMRN.status}
              </div>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">Request Details</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500 uppercase">MRN No.</p>
                    <p className="text-[11px] font-semibold text-amber-700">{selectedMRN.mrnNo}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500 uppercase">Requested By</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedMRN.requestedBy} — {selectedMRN.requestedByType}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500 uppercase">For Product</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedMRN.productName}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500 uppercase">Batch / Size</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedMRN.productCode} · {selectedMRN.batchSize}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 col-span-2">
                    <p className="text-[9px] text-slate-500 uppercase">Required Date</p>
                    <p className="text-[11px] font-semibold text-rose-600">{selectedMRN.requiredDate}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">Assign Picker / Transfer Team</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">Picker</label>
                    <select
                      disabled={panelMode === 'view'}
                      value={assignedPicker}
                      onChange={(e) => setAssignedPicker(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    >
                      <option value="">— Assign Picker —</option>
                      <option value="Santosh Kumar">Santosh Kumar</option>
                      <option value="Ravi Kumar">Ravi Kumar</option>
                      <option value="Karan Nair">Karan Nair</option>
                      <option value="Priya Sharma">Priya Sharma</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">Transfer By</label>
                    <select
                      disabled={panelMode === 'view'}
                      value={assignedTransferBy}
                      onChange={(e) => setAssignedTransferBy(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    >
                      <option value="">— Assign Transfer Person —</option>
                      <option value="Logistics Team A">Logistics Team A</option>
                      <option value="Logistics Team B">Logistics Team B</option>
                      <option value="Dispatch Team">Dispatch Team</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">
                  Pick List — {activePickItems.length} Items
                </h3>
                <div className="rounded border border-slate-200 overflow-hidden">
                  {activePickItems.map((item) => {
                    const shortQty = pickedQty[item.id] ?? String(item.required);
                    const hasShort = Number(shortQty) < item.required;
                    return (
                      <div key={item.id} className="px-2.5 py-2 border-b border-slate-100 last:border-b-0 bg-white">
                        <div className="flex items-start gap-2">
                          <input
                            disabled={panelMode === 'view'}
                            type="checkbox"
                            checked={!!pickedItems[item.id]}
                            onChange={(e) => setPickedItems((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-900">{item.name}</p>
                            <p className="text-[10px] text-slate-500">At {item.location} · Available: <span className={item.available < item.required ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-semibold'}>{item.available} {item.uom}</span></p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">Required:</span>
                            <input
                              disabled={panelMode === 'view'}
                              value={shortQty}
                              onChange={(e) => setPickedQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] text-slate-900"
                            />
                            <span className="text-[10px] text-slate-500">{item.uom}</span>
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${hasShort ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {hasShort ? 'Short' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-700">
                ⚠ Urgent — batch scheduled 20 Nov
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-3 py-2 flex justify-end gap-2">
              {panelMode !== 'view' && (
                <>
                  <button
                    onClick={handleSavePick}
                    className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-600 text-white text-[11px] font-semibold"
                  >
                    Save Pick
                  </button>
                  <button
                    onClick={handleInitiateTransfer}
                    className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold"
                  >
                    Initiate Transfer
                  </button>
                </>
              )}
              <button
                onClick={closePickPanel}
                className="px-3 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold"
              >
                {panelMode === 'view' ? 'Close View' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundDashboard;
