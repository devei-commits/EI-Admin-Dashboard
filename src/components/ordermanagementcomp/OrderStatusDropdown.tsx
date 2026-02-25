import React, { useState } from 'react';
import { UnifiedBadge, getStatusBadgeColor } from '../ui';

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

 const handleStatusSelect = (status: string) => {
  onStatusChange(status);
  setIsOpen(false);
 };

 return (
  <div className="relative">
   <button
    onClick={() => setIsOpen(!isOpen)}
    className="w-full px-3 py-1 text-sm rounded-md border hover:opacity-80 transition-opacity"
   >
    <UnifiedBadge variant={getStatusBadgeColor(currentStatus)}>
     {currentStatus}
    </UnifiedBadge>
    <span className="ml-2">▼</span>
   </button>

   {isOpen && (
    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
     {statusOptions.map((status) => (
      <button
       key={status}
       onClick={() => handleStatusSelect(status)}
       className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
        status === currentStatus ? 'bg-slate-50 font-medium' : ''
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