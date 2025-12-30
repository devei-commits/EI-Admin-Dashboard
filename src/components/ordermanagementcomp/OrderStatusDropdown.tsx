import React, { useState } from 'react';

interface OrderStatusDropdownProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

const OrderStatusDropdown: React.FC<OrderStatusDropdownProps> = ({ 
  currentStatus, 
  onStatusChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions = [
    'Review at BD',
    'Review at R&D Lead',
    'Review at OA',
    'Approved',
    'Rejected',
    'Dispatch',
    'Packaging',
    'Shipped'
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Review at BD':
      case 'Review at R&D Lead':
      case 'Review at OA':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Dispatch':
      case 'Packaging':
        return 'bg-blue-100 text-blue-800';
      case 'Shipped':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusSelect = (status: string) => {
    onStatusChange(status);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-1 text-sm rounded-md border ${getStatusColor(currentStatus)} hover:opacity-80 transition-opacity`}
      >
        {currentStatus}
        <span className="ml-2">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusSelect(status)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                status === currentStatus ? 'bg-gray-50 font-medium' : ''
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderStatusDropdown;