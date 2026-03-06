/**
 * ShipModal Component  
 * Dispatch and shipping details — bright theme
 */

import React, { useState, useEffect } from 'react';
import { Truck, Package, Calendar, Check, User, FileText } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { ShipModalProps } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO } from '../../utils/orderFulfillmentUtils';

export const ShipModal: React.FC<ShipModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onDispatch,
}) => {
  const [shipDate, setShipDate] = useState(getTodayISO());
  const [shippedBy, setShippedBy] = useState('');

  const invoicedSplits =
    saleOrder?.items.flatMap((item) =>
      item.batchSplits
        .filter((sp) => sp.ffStatus === 'invoiced')
        .map((sp) => ({ item, split: sp }))
    ) ?? [];

  useEffect(() => {
    if (isOpen) {
      setShipDate(getTodayISO());
      setShippedBy('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (invoicedSplits.length === 0) return;

    const shipmentData = {
      awbNo: shipDate,
      courier: shippedBy,
      dispatchDate: shipDate,
      numBoxes: 1,
      totalWeight: 0,
      eta: shipDate,
      vehicleNo: '',
      driverName: '',
      driverPhone: '',
      remarks: '',
    };

    onDispatch(shipmentData);
    onClose();
  };

  if (!saleOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Confirm Shipment for SO: ${saleOrder.soNo}`}
      size="md"
    >
      <div className="p-6">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            Confirm the dispatch of the invoiced items. This will mark the
            order as shipped.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <Input
            label="Shipped By"
            value={shippedBy}
            onChange={(e) => setShippedBy(e.target.value)}
            placeholder="Enter name of dispatcher"
          />
          <Input
            label="Shipment Date"
            type="date"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
          />
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Items to be Shipped
          </h3>
          {invoicedSplits.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">
                      Product
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">
                      BPR No
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">
                      Shipped Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoicedSplits.map(({ item, split }, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-500">{item.pack}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-purple-600">
                        {split.bprNo}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {formatNumber(split.pickedQty ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                No items have been invoiced for this order yet. Please generate
                an invoice first.
              </p>
            </div>
          )}
        </div>

        {saleOrder.invoiceNo && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              Invoice & Transport Details
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <p>
                <span className="font-medium text-gray-600">Invoice #:</span>{' '}
                {saleOrder.invoiceNo}
              </p>
              <p>
                <span className="font-medium text-gray-600">Date:</span>{' '}
                {saleOrder.invoiceDate}
              </p>
              <p>
                <span className="font-medium text-gray-600">Courier:</span>{' '}
                {saleOrder.courier || 'N/A'}
              </p>
              <p>
                <span className="font-medium text-gray-600">AWB #:</span>{' '}
                {saleOrder.awbNo || 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={invoicedSplits.length === 0 || !shippedBy}
        >
          <Check className="mr-2 h-4 w-4" />
          Confirm Shipment
        </Button>
      </div>
    </Modal>
  );
};
