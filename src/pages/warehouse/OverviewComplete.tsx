import { useState } from 'react';

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

const OutboundDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const getStatusCounts = () => {
    return {
      total: mockMRNs.length,
      pendingPick: mockMRNs.filter(m => m.status === 'Pending Pick').length,
      inPick: mockMRNs.filter(m => m.status === 'In Pick').length,
      inTransfer: mockMRNs.filter(m => m.status === 'In Transfer').length,
      completed: mockMRNs.filter(m => m.status === 'Completed').length,
    };
  };

  const counts = getStatusCounts();

  const filteredMRNs = mockMRNs.filter(mrn => {
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
          <button className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded transition-colors">
            Assign & Pick
          </button>
        );
      case 'In Pick':
        return (
          <button className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded transition-colors">
            Continue Pick
          </button>
        );
      case 'In Transfer':
        return (
          <button className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded transition-colors">
            Complete Transfer
          </button>
        );
      case 'Completed':
        return (
          <button className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded transition-colors border border-slate-200">
            View
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-white">
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
    </div>
  );
};

export default OutboundDashboard;
