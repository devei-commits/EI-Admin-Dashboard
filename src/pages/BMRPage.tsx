import React, { useState } from 'react';
import { FileText, Printer, Plus, Search, ChevronDown, Package, Warehouse, TestTube, Factory, FlaskConical } from 'lucide-react';

import QCReview from '../components/bmr/QCReview';
import UnderProduction from '../components/bmr/UnderProduction';
import Dispensing from '../components/bmr/Dispensing';
import WarehouseView from '../components/bmr/Warehouse';
import MaterialSourcing from '../components/bmr/MaterialSourcing';
import BatchConfirmationModal from '../components/bmr/modals/BatchConfirmationModal';
import type { BMRStage, WarehouseMaterialRequest, DispensingRequest, ProducingBatch, BMRData } from '../types/bmr.types';

const initialBmrData: BMRData[] = [
  { id: '1', bmrNo: 'BMR-01001', batch: 'SO-03074-B01', product: 'Anti-Acne Facewash 100g (100g Tube)', units: 7000, bulkKg: 700, orderDate: '2026-02-23', delivery: '2026-03-12', mcd: '2026-03-07', impact: 1, material: '5/6 overall', area: '—', stage: 'Pending' },
  { id: '2', bmrNo: 'BMR-01002', batch: 'SO-03074-B02', product: 'Anti-Acne Facewash 100g (100g Tube)', units: 7000, bulkKg: 700, orderDate: '2026-02-23', delivery: '2026-03-12', mcd: '2026-03-07', impact: 1, material: '3/6 @ factory', area: 'AREA-1', stage: 'Scheduled' },
  { id: '3', bmrNo: 'BMR-01003', batch: 'SO-03088-B01', product: 'Sunscreen Gel SPF50 50g (50g Tube)', units: 8000, bulkKg: 400, orderDate: '2026-02-21', delivery: '2026-03-09', mcd: '2026-03-07', impact: 1, material: '4/6 @ factory', area: 'AREA-1', stage: 'In Production' },
  { id: '4', bmrNo: 'BMR-01004', batch: 'SO-03079-B01', product: 'Anti-Itch Lotion 100g (100g Tube)', units: 4000, bulkKg: 400, orderDate: '2026-02-25', delivery: '2026-03-18', mcd: '2026-03-07', impact: 1, material: '4/6 @ factory', area: 'AREA-2', stage: 'QC Review' },
];

const StatCard: React.FC<{ title: string; value: number; description: string; icon: React.ReactNode }> = ({ title, value, description, icon }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm flex items-start space-x-4">
    <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  </div>
);

const StageTab: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            active
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
        {icon}
        <span className="ml-2">{label}</span>
    </button>
);

const BMRBPR: React.FC = () => {
  const [activeView, setActiveView] = useState<'BMR' | 'BPR'>('BMR');
  const [activeStageTab, setActiveStageTab] = useState('Dashboard');
  const [bmrData, setBmrData] = useState<BMRData[]>(initialBmrData);
  const [materialRequests, setMaterialRequests] = useState<WarehouseMaterialRequest[]>([]);
  const [dispensingRequests, setDispensingRequests] = useState<DispensingRequest[]>([]);
  const [producingBatches, setProducingBatches] = useState<ProducingBatch[]>([]);
  const [mrCounter, setMrCounter] = useState(1001);
  const [selectedBMR, setSelectedBMR] = useState<BMRData | null>(null);
  const [isBatchConfirmationOpen, setIsBatchConfirmationOpen] = useState(false);

  const handleMaterialRequestSubmit = (requestData: {
    bmrNo: string;
    factory: string;
    requiredBy: string;
    materials: Array<{ material: string; code: string; totalRequired: string; toTransfer: number; whStock: number }>;
  }) => {
    const newRequest: WarehouseMaterialRequest = {
      id: `mr-${mrCounter}`,
      mrNo: `MR-${mrCounter}`,
      bmrNo: requestData.bmrNo,
      factory: requestData.factory,
      requested: new Date().toISOString().split('T')[0],
      requiredBy: requestData.requiredBy,
      materials: requestData.materials.map(m => ({
        material: m.material,
        code: m.code,
        required: m.totalRequired,
        toTransfer: m.toTransfer,
        whStock: m.whStock,
        status: 'Pending' as const,
        picked: false,
      })),
      status: 'Pending Pick',
    };

    setMaterialRequests(prev => [...prev, newRequest]);
    setMrCounter(prev => prev + 1);
    setActiveStageTab('Warehouse');
  };

  const handlePickItem = (mrId: string, materialIndex: number) => {
    setMaterialRequests(prev => prev.map(mr => {
      if (mr.id === mrId) {
        const updatedMaterials = [...mr.materials];
        updatedMaterials[materialIndex] = {
          ...updatedMaterials[materialIndex],
          picked: true,
        };
        return { ...mr, materials: updatedMaterials };
      }
      return mr;
    }));
  };

  const handlePickAll = (mrId: string) => {
    setMaterialRequests(prev => prev.map(mr => {
      if (mr.id === mrId) {
        const updatedMaterials = mr.materials.map(m => ({
          ...m,
          picked: true,
        }));
        return { ...mr, materials: updatedMaterials };
      }
      return mr;
    }));
  };

  const handleDispatchToFactory = (mrId: string) => {
    setMaterialRequests(prev => prev.map(mr => {
      if (mr.id === mrId) {
        return {
          ...mr,
          status: 'In Transit',
          dispatchedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          dispatchedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        };
      }
      return mr;
    }));
  };

  const handleMarkReceivedAtFactory = (mrId: string) => {
    // Move from warehouse to dispensing
    const warehouseRequest = materialRequests.find(mr => mr.id === mrId);
    if (warehouseRequest) {
      // Create dispensing request
      const dispensingRequest: DispensingRequest = {
        id: `disp-${warehouseRequest.id}`,
        mrNo: warehouseRequest.mrNo,
        bmrNo: warehouseRequest.bmrNo,
        factory: warehouseRequest.factory,
        dispatchedOn: warehouseRequest.dispatchedOn || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        schedule: warehouseRequest.requiredBy,
        tankArea: `TANK-01 / ${warehouseRequest.factory}`,
        materials: warehouseRequest.materials.map(m => ({
          material: m.material,
          code: m.code,
          required: m.required,
          freeStock: m.whStock,
          dispensed: 0,
        })),
        status: 'Pending Dispensing',
      };

      // Remove from warehouse (mark as Completed) and add to dispensing
      setMaterialRequests(prev => prev.map(mr => 
        mr.id === mrId ? { ...mr, status: 'Completed' } : mr
      ));
      setDispensingRequests(prev => [...prev, dispensingRequest]);
      
      // Auto-navigate to Dispensing tab
      setActiveStageTab('Dispensing');
    }
  };

  const handleDispenseItem = (dispensingId: string, materialIndex: number, quantity: number) => {
    setDispensingRequests(prev => prev.map(dr => {
      if (dr.id === dispensingId) {
        const updated = [...dr.materials];
        updated[materialIndex] = {
          ...updated[materialIndex],
          dispensed: quantity,
        };
        return { ...dr, materials: updated };
      }
      return dr;
    }));
  };

  const handleCompleteDispensingRequest = (dispensingId: string) => {
    // Find the dispensing request
    const completedDispensingRequest = dispensingRequests.find(dr => dr.id === dispensingId);
    
    if (completedDispensingRequest) {
      // Create a producing batch from the dispensing request
      const producingBatch: ProducingBatch = {
        id: `pb-${completedDispensingRequest.id}`,
        bmrNo: completedDispensingRequest.bmrNo,
        batch: completedDispensingRequest.mrNo.replace('MR-', 'SO-'), // Convert MR number to batch format
        product: 'Anti-Acne Facewash 100g', // This would normally come from the request, but we don't have it stored
        units: 7000, // Mock data - in real scenario would come from BMR data
        bulkKg: 700, // Mock data
        schedule: completedDispensingRequest.schedule || '2026-03-02',
        tankArea: completedDispensingRequest.tankArea || 'TANK-01 / AREA-1',
        progress: 0,
        status: 'Dispensed',
        dispatchedOn: completedDispensingRequest.dispatchedOn,
      };

      // Mark dispensing request as Completed and add to producing batches
      setDispensingRequests(prev => prev.map(dr =>
        dr.id === dispensingId ? { ...dr, status: 'Completed' } : dr
      ));
      setProducingBatches(prev => [...prev, producingBatch]);
      
      // Auto-navigate to Under Production tab
      setActiveStageTab('Under Production');
    }
  };

  const handleConfirmBatch = (batchSize: number) => {
    if (selectedBMR) {
      // Update the BMR stage from Pending to Scheduled
      setBmrData(prev => prev.map(bmr => 
        bmr.id === selectedBMR.id 
          ? { ...bmr, stage: 'Scheduled', units: batchSize || bmr.units } 
          : bmr
      ));
      
      // Auto-navigate to Material Sourcing tab
      setActiveStageTab('Material Sourcing');
    }
  };

  const handleScheduleConfirm = (scheduleData: {
    productionDate: string;
    manufacturingArea: string;
    productionTank: string;
  }) => {
    console.log('Schedule confirmed:', scheduleData);
    // Navigate to Material Sourcing tab
    setActiveStageTab('Material Sourcing');
    // Close the batch confirmation modal
    setIsBatchConfirmationOpen(false);
    setSelectedBMR(null);
  };

  const stats = {
    total: bmrData.length,
    pending: bmrData.filter(d => d.stage === 'Pending').length,
    scheduled: bmrData.filter(d => d.stage === 'Scheduled').length,
    inProduction: bmrData.filter(d => d.stage === 'In Production').length,
    qcReview: bmrData.filter(d => d.stage === 'QC Review').length,
    completed: bmrData.filter(d => d.stage === 'Completed').length,
  };

  const getStageBadge = (stage: BMRStage) => {
    switch (stage) {
      case 'Pending': return 'bg-gray-200 text-gray-800';
      case 'Scheduled': return 'bg-yellow-200 text-yellow-800';
      case 'In Production': return 'bg-blue-200 text-blue-800';
      case 'QC Review': return 'bg-orange-200 text-orange-800';
      case 'Completed': return 'bg-green-200 text-green-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getActionButton = (stage: BMRStage, item: BMRData) => {
    switch (stage) {
      case 'Pending': 
        return (
          <button 
            onClick={() => {
              setSelectedBMR(item);
              setIsBatchConfirmationOpen(true);
            }}
            className="px-3 py-1 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Confirm Batch
          </button>
        );
      case 'Scheduled': return <button className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Request Material</button>;
      case 'In Production': return <button className="px-3 py-1 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600">Submit BMR</button>;
      case 'QC Review': return <button className="px-3 py-1 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600">QC Review</button>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileText className="mr-2 text-blue-600" />
              Bulk Manufacturing Records
            </h1>
            <p className="text-sm text-gray-500 mt-1">Full batch workflow: Pending → Scheduled → Material Sourcing → Dispensing → Production → QC → Completed</p>
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 inline-block">
              <p className="text-xs text-blue-800">
                💡 <span className="font-semibold">Quick Guide:</span> Click "Confirm Batch" → Fix any gaps → Schedule production → Materials auto-flow through warehouse → dispensing → production
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Create BMR
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Printer className="mr-2 h-4 w-4" /> Print Template
            </button>
          </div>
        </div>
        <div className="mt-4 flex space-x-2">
            <button onClick={() => setActiveView('BMR')} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${activeView === 'BMR' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>BMR</button>
            <button onClick={() => setActiveView('BPR')} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${activeView === 'BPR' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>BPR</button>
        </div>
      </header>

      {activeView === 'BMR' && (
        <main>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard title="TOTAL BMRS" value={stats.total} description="all batches" icon={<FileText size={20} />} />
            <StatCard title="PENDING" value={stats.pending} description="awaiting confirm" icon={<FileText size={20} />} />
            <StatCard title="SCHEDULED" value={stats.scheduled} description="material sourcing" icon={<FileText size={20} />} />
            <StatCard title="IN PRODUCTION" value={stats.inProduction} description="floor active" icon={<FileText size={20} />} />
            <StatCard title="QC REVIEW" value={stats.qcReview} description="pending quality" icon={<FileText size={20} />} />
            <StatCard title="COMPLETED" value={stats.completed} description="batch closed" icon={<FileText size={20} />} />
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="flex space-x-1">
                    <StageTab label="Dashboard" icon={<FileText size={16} />} active={activeStageTab === 'Dashboard'} onClick={() => setActiveStageTab('Dashboard')} />
                    <StageTab label="Material Sourcing" icon={<Package size={16} />} active={activeStageTab === 'Material Sourcing'} onClick={() => setActiveStageTab('Material Sourcing')} />
                    <StageTab label="Warehouse" icon={<Warehouse size={16} />} active={activeStageTab === 'Warehouse'} onClick={() => setActiveStageTab('Warehouse')} />
                    <StageTab label="Dispensing" icon={<FlaskConical size={16} />} active={activeStageTab === 'Dispensing'} onClick={() => setActiveStageTab('Dispensing')} />
                    <StageTab label="Under Production" icon={<Factory size={16} />} active={activeStageTab === 'Under Production'} onClick={() => setActiveStageTab('Under Production')} />
                    <StageTab label="QC Review" icon={<TestTube size={16} />} active={activeStageTab === 'QC Review'} onClick={() => setActiveStageTab('QC Review')} />
                </div>
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input type="text" placeholder="Search BMR / batch / product" className="pl-9 pr-3 py-2 w-64 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="relative">
                        <select className="appearance-none pr-8 pl-3 py-2 w-40 border border-gray-300 rounded-md text-sm bg-white">
                            <option>All stages</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {activeStageTab === 'Dashboard' && (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-275 divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { header: 'BMR No', width: 'w-[8%]', align: 'text-left' },
                        { header: 'Batch', width: 'w-[7%]', align: 'text-left' },
                        { header: 'Product', width: 'w-[14%]', align: 'text-left' },
                        { header: 'Units', width: 'w-[6%]', align: 'text-right' },
                        { header: 'Bulk(kg)', width: 'w-[7%]', align: 'text-right' },
                        { header: 'Order Date', width: 'w-[8%]', align: 'text-left' },
                        { header: 'Delivery', width: 'w-[8%]', align: 'text-left' },
                        { header: 'MCD', width: 'w-[7%]', align: 'text-left' },
                        { header: 'Impact', width: 'w-[6%]', align: 'text-center' },
                        { header: 'Material', width: 'w-[7%]', align: 'text-center' },
                        { header: 'Area', width: 'w-[6%]', align: 'text-left' },
                        { header: 'Stage', width: 'w-[9%]', align: 'text-left' },
                        { header: 'Action', width: 'w-[7%]', align: 'text-right' },
                      ].map(({ header, width, align }) => (
                        <th key={header} scope="col" className={`${width} px-3 py-3 ${align} text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bmrData.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-4 text-sm font-medium text-blue-600 truncate">{item.bmrNo}</td>
                        <td className="px-3 py-4 text-sm text-gray-500 truncate">{item.batch}</td>
                        <td className="px-3 py-4 text-sm text-gray-900 truncate">{item.product}</td>
                        <td className="px-3 py-4 text-sm text-right tabular-nums text-gray-500">{item.units.toLocaleString()}</td>
                        <td className="px-3 py-4 text-sm text-right tabular-nums text-gray-500">{item.bulkKg}</td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">{item.orderDate}</td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">{item.delivery}</td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">{item.mcd}</td>
                        <td className="px-3 py-4 text-sm text-center text-red-500">{item.impact}</td>
                        <td className="px-3 py-4 text-sm text-center text-orange-500">{item.material}</td>
                        <td className="px-3 py-4 text-sm text-gray-500 truncate">{item.area}</td>
                        <td className="px-3 py-4 text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStageBadge(item.stage)}`}>
                            {item.stage}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-sm font-medium">
                          {getActionButton(item.stage, item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeStageTab === 'Material Sourcing' && <MaterialSourcing onMaterialRequestSubmit={handleMaterialRequestSubmit} />}
            {activeStageTab === 'Warehouse' && (
              <WarehouseView 
                materialRequests={materialRequests}
                onPickItem={handlePickItem}
                onPickAll={handlePickAll}
                onDispatchToFactory={handleDispatchToFactory}
                onMarkReceivedAtFactory={handleMarkReceivedAtFactory}
                onBackToMaterialSourcing={() => setActiveStageTab('Material Sourcing')} 
              />
            )}
            {activeStageTab === 'Dispensing' && (
              <Dispensing 
                dispensingRequests={dispensingRequests}
                onDispenseItem={handleDispenseItem}
                onCompleteDispensingRequest={handleCompleteDispensingRequest}
              />
            )}
            {activeStageTab === 'Under Production' && <UnderProduction producingBatches={producingBatches} />}
            {activeStageTab === 'QC Review' && <QCReview />}
          </div>
        </main>
      )}
      {activeView === 'BPR' && (
        <div className="bg-white p-6 rounded-lg shadow text-center">
            <h2 className="text-xl font-bold">Batch Packaging Records</h2>
            <p className="mt-2 text-gray-500">This section is under construction. The BPR dashboard will be implemented here.</p>
        </div>
      )}

      {selectedBMR && (
        <BatchConfirmationModal
          isOpen={isBatchConfirmationOpen}
          onClose={() => {
            setIsBatchConfirmationOpen(false);
            setSelectedBMR(null);
          }}
          bmrData={{
            bmrNo: selectedBMR.bmrNo,
            batch: selectedBMR.batch,
            product: selectedBMR.product,
            units: selectedBMR.units,
            bulkKg: selectedBMR.bulkKg,
            material: selectedBMR.material,
            mcd: selectedBMR.mcd,
          }}
          onConfirmBatch={handleConfirmBatch}
          onScheduleConfirm={handleScheduleConfirm}
        />
      )}
    </div>
  );
};

export default BMRBPR;
