/**
 * TrackModal Component  
 * Per-split shipment tracking with 7-step stepper timeline — bright theme
 */

import React, { useState } from 'react';
import {
  MapPin,
  Check,
  Truck,
  Package,
  ClipboardList,
  Warehouse,
  FileText,
  Box,
  CheckCircle,
  Circle,
  User,
  Calendar,
  StickyNote,
} from 'lucide-react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import { StatusBadge } from './StatusBadge';
import type { TrackModalProps } from '../../types/orderFulfillment';
import { formatDate, getTodayISO } from '../../utils/orderFulfillmentUtils';

const TRACKING_STEPS = [
  { key: 'order_placed', label: 'Order Placed', icon: ClipboardList },
  { key: 'fg_ready', label: 'FG Ready', icon: Warehouse },
  { key: 'picked', label: 'Picked', icon: Box },
  { key: 'invoiced', label: 'Invoiced', icon: FileText },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

const getStepIndex = (ffStatus: string): number => {
  const statusMap: { [key: string]: number } = {
    'fg_pending': 0, 'wip': 0, 'bulk_qc': 0,
    'fg_ready': 1,
    'picked': 2,
    'invoiced': 3,
    'shipped': 4,
    'delivered': 5,
    'closed': 5,
  };
  return statusMap[ffStatus] ?? 0;
};

// Stepper component removed - simplified tracking view
// const Stepper: React.FC<...> = ...

export const TrackModal: React.FC<TrackModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onConfirmDelivery,
}) => {
  const [deliveryDate, setDeliveryDate] = useState(getTodayISO());
  const [receivedBy, setReceivedBy] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');

  if (!saleOrder) return null;

  const allSplits = saleOrder.items.flatMap((item) =>
    item.batchSplits.map((sp) => ({
      ...sp,
      productName: item.productName,
      pack: item.pack,
    }))
  );

  const hasShipped = allSplits.some((sp) => ['shipped', 'delivered'].includes(sp.ffStatus));
  const allDelivered = allSplits.length > 0 && allSplits.every((sp) => ['delivered', 'closed'].includes(sp.ffStatus));

  const handleConfirmDelivery = () => {
    onConfirmDelivery({
      deliveryDate,
      receivedBy,
      remarks: deliveryRemarks,
    });
    handleClose();
  };

  const handleClose = () => {
    setDeliveryDate(getTodayISO());
    setReceivedBy('');
    setDeliveryRemarks('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Track Shipment for SO: ${saleOrder.soNo}`}
      size="xl"
    >
      <div className="p-6">
        {allDelivered ? (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">This order has been fully delivered.</p>
          </div>
        ) : hasShipped ? (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <Truck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              The order is on its way. Confirm delivery once it reaches the
              destination.
            </p>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
            <Package className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              This order has not been shipped yet. Complete the previous steps
              to proceed.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {allSplits.map((split, idx) => (
            <div key={idx} className="p-4 border rounded-lg bg-gray-50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-800">
                    {split.productName} ({split.pack})
                  </p>
                  <p className="text-sm text-gray-500">
                    BPR No: <span className="font-mono text-purple-600">{split.bprNo}</span>
                  </p>
                </div>
                <StatusBadge status={split.ffStatus} type="ff" />
              </div>
            </div>
          ))}
        </div>

        {hasShipped && !allDelivered && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Delivery
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  label="Received By"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Enter recipient's name"
                />
                <Input
                  label="Delivery Date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <Input
                label="Delivery Remarks"
                value={deliveryRemarks}
                onChange={(e) => setDeliveryRemarks(e.target.value)}
                placeholder="Optional notes (e.g., condition of goods)"
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={handleClose}>
          Close
        </Button>
        {hasShipped && !allDelivered && (
          <Button
            onClick={handleConfirmDelivery}
            disabled={!receivedBy.trim()}
          >
            <Check className="mr-2 h-4 w-4" />
            Mark as Delivered
          </Button>
        )}
      </div>
    </Modal>
  );
};
