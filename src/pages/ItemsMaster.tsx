import React, { useState } from 'react';
import { useItems } from '../context/ItemsContext';

const ItemsMaster: React.FC = () => {
  const { items, updateItem, deleteItem } = useItems();
  const safeItems = Array.isArray(items) ? items : [];
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const handleView = (item: any) => {
    setSelectedItem(item);
    setEditedData(JSON.parse(JSON.stringify(item.data)));
    setEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (selectedItem) {
      const updatedItem = {
        ...selectedItem,
        data: editedData,
        lastModified: new Date().toISOString(),
      };
      updateItem(selectedItem.id, updatedItem);
      setIsModalOpen(false);
      setEditMode(false);
      setSelectedItem(null);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItem(id);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'raw-material': 'Raw Material',
      'bom': 'BOM',
      'packaging': 'Packaging',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'raw-material': 'bg-blue-100 text-blue-800',
      'bom': 'bg-green-100 text-green-800',
      'packaging': 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Filter items based on selected type
  const filteredItems = typeFilter === 'all' 
    ? safeItems 
    : safeItems.filter(item => item.type === typeFilter);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Items Master</h1>
            
            {/* Filter Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Filter by Type:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="raw-material">Raw Material</option>
                <option value="bom">BOM</option>
                <option value="packaging">Packaging</option>
              </select>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {safeItems.length === 0 
                  ? 'No items found. Create items from Raw Material, BOM, or Packaging pages.'
                  : `No ${typeFilter === 'all' ? '' : getTypeLabel(typeFilter)} items found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 rounded-lg">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-3 text-left text-sm font-semibold">Item Name</th>
                    <th className="border border-gray-300 p-3 text-left text-sm font-semibold">Code</th>
                    <th className="border border-gray-300 p-3 text-left text-sm font-semibold">Type</th>
                    <th className="border border-gray-300 p-3 text-left text-sm font-semibold">Created</th>
                    <th className="border border-gray-300 p-3 text-left text-sm font-semibold">Last Modified</th>
                    <th className="border border-gray-300 p-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-3 text-sm font-medium">{item.name}</td>
                      <td className="border border-gray-300 p-3 text-sm text-gray-600">{item.code}</td>
                      <td className="border border-gray-300 p-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                      </td>
                      <td className="border border-gray-300 p-3 text-sm text-gray-600">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="border border-gray-300 p-3 text-sm text-gray-600">
                        {new Date(item.lastModified).toLocaleDateString()}
                      </td>
                      <td className="border border-gray-300 p-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(item)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedItem.name}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getTypeColor(selectedItem.type)}`}>
                    {getTypeLabel(selectedItem.type)}
                  </span>
                  <p className="text-sm text-gray-600">Code: {selectedItem.code}</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {editMode ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Item</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(editedData).map(([key, value]: [string, any]) => {
                      if (typeof value === 'object' && value !== null) return null;
                      if (Array.isArray(value)) return null;
                      
                      return (
                        <div key={key}>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </label>
                          {typeof value === 'boolean' ? (
                            <select
                              value={value ? 'true' : 'false'}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  [key]: e.target.value === 'true',
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={typeof value === 'number' ? 'number' : 'text'}
                              value={value || ''}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  [key]: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Display all form fields organized by sections */}
                  {Object.entries(selectedItem.data).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(selectedItem.data).map(([key, value]: [string, any]) => {
                        // Skip empty values
                        if (value === '' || value === null || value === undefined) return null;
                        
                        // Handle arrays (like vendors, documents, etc.)
                        if (Array.isArray(value)) {
                          if (value.length === 0) return null;
                          return (
                            <div key={key} className="border-t pt-4">
                              <h4 className="text-md font-semibold text-gray-800 mb-3 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-4">
                                {value.map((item, idx) => (
                                  <div key={idx} className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(item).map(([itemKey, itemValue]: [string, any]) => (
                                        <div key={itemKey}>
                                          <span className="text-xs font-semibold text-gray-600 uppercase">
                                            {itemKey}:
                                          </span>
                                          <span className="text-sm text-gray-800 ml-2">
                                            {String(itemValue)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        
                        // Handle objects
                        if (typeof value === 'object' && value !== null) {
                          return null;
                        }
                        
                        // Handle simple values
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 border-b pb-3">
                            <div className="col-span-1">
                              <label className="text-xs font-semibold text-gray-600 uppercase">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </label>
                            </div>
                            <div className="col-span-2">
                              <p className="text-sm text-gray-800 break-words">
                                {typeof value === 'boolean' ? (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {value ? 'Yes' : 'No'}
                                  </span>
                                ) : (
                                  String(value)
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-700">Created:</p>
                    <p>{new Date(selectedItem.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Last Modified:</p>
                    <p>{new Date(selectedItem.lastModified).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
              >
                Close
              </button>
              {editMode ? (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsMaster;
