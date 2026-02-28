import React, { useState } from 'react';
import { Factory, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface MaterialItem {
  material: string;
  code: string;
  required: string;
  toTransfer: number;
  whStock: number;
  status: 'Pending' | 'Picked';
  picked: boolean;
}

interface MaterialRequest {
  id: string;
  mrNo: string;
  bmrNo: string;
  factory: string;
  requested: string;
  requiredBy: string;
  materials: MaterialItem[];
  status: 'Pending Pick' | 'In Transit' | 'Completed';
  dispatchedAt?: string;
  dispatchedOn?: string;
}

interface WarehouseProps {
  onBackToMaterialSourcing: () => void;
  materialRequests: MaterialRequest[];
  onPickItem: (mrId: string, materialIndex: number) => void;
  onPickAll: (mrId: string) => void;
  onDispatchToFactory: (mrId: string) => void;
  onMarkReceivedAtFactory: (mrId: string) => void;
}

const Warehouse: React.FC<WarehouseProps> = ({ 
  onBackToMaterialSourcing, 
  materialRequests,
  onPickItem,
  onPickAll,
  onDispatchToFactory,
  onMarkReceivedAtFactory
}) => {
  const pendingPickCount = materialRequests.filter(mr => mr.status === 'Pending Pick').length;
  const inTransitCount = materialRequests.filter(mr => mr.status === 'In Transit').length;
  const completedCount = materialRequests.filter(mr => mr.status === 'Completed').length;

  if (materialRequests.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <Factory size={48} className="text-gray-300" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700">No transfer requests yet</h2>
        <p className="mt-2 text-sm text-gray-500">
          Go to <button onClick={onBackToMaterialSourcing} className="text-blue-600 font-semibold hover:underline">Material Sourcing</button>, select a BMR and click "Request Material"
        </p>
        <div className="mt-6">
          <button 
            onClick={onBackToMaterialSourcing}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Material Sourcing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
          <div className="text-3xl font-bold text-gray-900">{pendingPickCount}</div>
          <div className="text-sm font-medium text-gray-600">PENDING PICK</div>
          <div className="text-xs text-gray-500">awaiting warehouse</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <div className="text-3xl font-bold text-gray-900">{inTransitCount}</div>
          <div className="text-sm font-medium text-gray-600">IN TRANSIT</div>
          <div className="text-xs text-gray-500">dispatched</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="text-3xl font-bold text-gray-900">{completedCount}</div>
          <div className="text-sm font-medium text-gray-600">COMPLETED</div>
          <div className="text-xs text-gray-500">received</div>
        </div>
      </div>

      {/* Material Requests */}
      {materialRequests.map((request) => {
        const pickedCount = request.materials.filter(m => m.picked).length;
        const totalCount = request.materials.length;
        const pickProgress = Math.round((pickedCount / totalCount) * 100);

        return (
          <div key={request.id} className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <h3 className="text-xl font-bold text-gray-900">{request.mrNo}</h3>
                <span className="px-3 py-1 text-xs font-semibold bg-yellow-200 text-yellow-800 rounded-full">
                  {request.status}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => onPickAll(request.id)}
                  disabled={pickedCount === totalCount}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pick All Items
                </button>
                <div className="text-sm font-medium text-gray-600">
                  {pickedCount}/{totalCount} picked
                </div>
              </div>
            </div>

            {/* Info Row */}
            <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">BMRS:</span>
                <span className="ml-2 text-gray-900">{request.bmrNo}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Factory:</span>
                <span className="ml-2 text-gray-900">{request.factory}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Requested:</span>
                <span className="ml-2 text-gray-900">{request.requested}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Required by:</span>
                <span className="ml-2 text-red-600 font-semibold">{request.requiredBy}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${pickProgress}%` }}
                />
              </div>
              <div className="text-xs text-right text-gray-500 mt-1">{pickProgress}%</div>
            </div>

            {/* Materials Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Transfer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WH Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {request.materials.map((material, index) => (
                    <tr key={index} className={material.picked ? 'bg-green-50' : ''}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{material.material}</div>
                        <div className="text-xs text-gray-500">{material.code}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{material.required}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${material.toTransfer > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                        {material.toTransfer > 0 ? `${material.toTransfer} kg` : '0 kg'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {material.whStock} kg
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          material.picked 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {material.picked ? '✓ Picked' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => onPickItem(request.id, index)}
                          disabled={material.picked}
                          className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-md ${
                            material.picked
                              ? 'bg-green-100 text-green-700 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Pick
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dispatch Actions */}
            <div className="mt-4 space-y-3">
              {/* Show dispatch button only when all items are picked */}
              {pickProgress === 100 && request.status === 'Pending Pick' && (
                <button
                  onClick={() => onDispatchToFactory(request.id)}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Dispatch to Factory
                </button>
              )}

              {/* Show dispatch info and received button when in transit */}
              {request.status === 'In Transit' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="text-sm font-medium text-gray-700">
                      Dispatched on <span className="text-blue-600 font-semibold">{request.dispatchedOn}</span> at <span className="text-blue-600 font-semibold">{request.dispatchedAt}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onMarkReceivedAtFactory(request.id)}
                    className="w-full px-4 py-3 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700"
                  >
                    Mark Received at Factory
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Warehouse;
