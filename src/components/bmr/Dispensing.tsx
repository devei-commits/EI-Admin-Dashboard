import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';

interface DispensingRequest {
  id: string;
  mrNo: string;
  bmrNo: string;
  factory: string;
  dispatchedOn: string;
  materials: Array<{
    material: string;
    code: string;
    required: string;
    freeStock: number;
    dispensed: number;
  }>;
  status: 'Pending Dispensing' | 'Completed';
}

interface DispensingProps {
  dispensingRequests: DispensingRequest[];
  onDispenseItem: (dispensingId: string, materialIndex: number, quantity: number) => void;
  onCompleteDispensingRequest: (dispensingId: string) => void;
}

const Dispensing: React.FC<DispensingProps> = ({ 
  dispensingRequests, 
  onDispenseItem,
  onCompleteDispensingRequest
}) => {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  if (dispensingRequests.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <FlaskConical size={48} className="text-gray-300" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700">No batches ready for dispensing</h2>
        <p className="mt-2 text-sm text-gray-500">
          Transfer must be completed and received at factory first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dispensingRequests.map((request) => {
        const dispensedCount = request.materials.filter(m => m.dispensed > 0).length;
        const totalCount = request.materials.length;
        const dispenseProgress = Math.round((dispensedCount / totalCount) * 100);
        const isExpanded = expandedRequest === request.id;

        return (
          <div key={request.id} className="bg-white rounded-lg border-2 border-blue-300 shadow-sm overflow-hidden">
            {/* Header - Top section */}
            <div className="bg-linear-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{request.bmrNo} · {request.mrNo}</h3>
                  <p className="text-sm text-gray-600 mt-1">Dispatched on {request.dispatchedOn}</p>
                </div>
                <span className="px-3 py-1 text-xs font-semibold bg-blue-200 text-blue-800 rounded-full">
                  {request.status}
                </span>
              </div>

              {/* Info Row */}
              <div className="flex items-center space-x-6 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Factory:</span>
                  <span className="ml-2 text-gray-900">{request.factory}</span>
                </div>
              </div>
            </div>

            {/* Materials Table */}
            <div className="px-6 py-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Free Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispensed</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {request.materials.map((material, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{material.material}</div>
                        <div className="text-xs text-gray-500">{material.code}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{material.required}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {material.freeStock}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="number"
                          min="0"
                          max={parseInt(material.required)}
                          value={material.dispensed || ''}
                          onChange={(e) => onDispenseItem(request.id, index, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            const requiredNum = parseInt(material.required);
                            onDispenseItem(request.id, index, requiredNum);
                          }}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                        >
                          Dispense
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Progress and Complete Button */}
              <div className="mt-6 space-y-3">
                {/* Progress tracking */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-600">
                    Dispensed: {dispensedCount}/{totalCount} materials
                  </span>
                  <span className="text-gray-500">{dispenseProgress}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${dispenseProgress}%` }}
                  />
                </div>

                {/* Complete button - visible when at least one item is dispensed */}
                {dispensedCount > 0 && request.status === 'Pending Dispensing' && (
                  <button
                    onClick={() => onCompleteDispensingRequest(request.id)}
                    className="w-full mt-4 px-4 py-3 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    Complete Dispensing
                  </button>
                )}

                {request.status === 'Completed' && (
                  <div className="w-full px-4 py-3 text-center text-sm font-semibold text-white bg-green-600 rounded-md">
                    ✓ Dispensing Completed
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Dispensing;
