/**
 * PickModal Component  
 * Interface for picking FG items from warehouse
 */

import React, { useState, useEffect } from 'react';
import { Package, MapPin, Check, User, Calendar, File, StickyNote } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { PickModalProps } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO } from '../../utils/orderFulfillmentUtils';

export const PickModal: React.FC<PickModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onConfirmPick,
}) => {
  const [pickerName, setPickerName] = useState('');
  const [pickDate, setPickDate] = useState(getTodayISO());
  const [pickSlipNo, setPickSlipNo] = useState(
    `PS-${String(Date.now()).slice(-5)}`
  );
  const [remarks, setRemarks] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const pickableSplits =
    saleOrder?.items.flatMap((item) =>
      item.batchSplits
        .filter((sp) => sp.ffStatus === 'fg_ready')
        .map((sp) => ({ item, split: sp }))
    ) ?? [];

  useEffect(() => {
    if (saleOrder && pickableSplits.length > 0) {
      const initialQty: Record<string, number> = {};
      pickableSplits.forEach(({ split }) => {
        initialQty[split.bprNo] = split.fgQty;
      });
      setQuantities(initialQty);
    }
  }, [saleOrder?.soNo, isOpen]);

  const handleConfirm = () => {
    if (pickableSplits.length === 0) return;

    const pickData = {
      splits: Object.entries(quantities).map(([bprNo, qty]) => ({
        bprNo,
        pickedQty: qty,
      })),
      pickerName,
      pickDate,
      pickSlipNo,
      remarks,
    };

    onConfirmPick(pickData);
    handleClose();
  };

  const handleClose = () => {
    setPickerName('');
    setPickDate(getTodayISO());
    setPickSlipNo(`PS-${String(Date.now()).slice(-5)}`);
    setRemarks('');
    setQuantities({});
    onClose();
  };

  if (!saleOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Create Pick List for SO: ${saleOrder.soNo}`}
      size="lg"
    >
      <div className="p-6">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            Confirm the quantities to be picked from the warehouse for each
            batch. A pick list will be generated for the warehouse team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Pick Details */}
          <div className="space-y-4">
            <Input
              label="Picker Name"
              value={pickerName}
              onChange={(e) => setPickerName(e.target.value)}
              placeholder="Enter warehouse staff name"
            />
            <Input
              label="Pick Date"
              type="date"
              value={pickDate}
              onChange={(e) => setPickDate(e.target.value)}
            />
            <Input
              label="Pick Slip No."
              value={pickSlipNo}
              onChange={(e) => setPickSlipNo(e.target.value)}
            />
            <Input
              label="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes for picking"
            />
          </div>

          {/* Right Column: Ship To */}
          <div className="p-4 border rounded-lg bg-gray-50 h-fit">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" /> Shipping Address
            </h3>
            <address className="not-italic text-gray-600">
              <strong className="font-semibold text-gray-800">
                {saleOrder.customer}
              </strong>
              <br />
              {saleOrder.shipAddress}
            </address>
          </div>
        </div>

        {/* Pickable Items Table */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Items Ready for Picking
          </h3>
          {pickableSplits.length > 0 ? (
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
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">
                      Location
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">
                      Available
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">
                      Pick Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pickableSplits.map(({ item, split }, idx) => (
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
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 px-2 py-1 rounded-full text-xs font-medium">
                          <MapPin size={12} />
                          {split.fgLocation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {formatNumber(split.fgQty)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          className="w-24 text-right"
                          value={quantities[split.bprNo] ?? ''}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [split.bprNo]: parseInt(e.target.value) || 0,
                            })
                          }
                          max={split.fgQty}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                No items are currently in 'FG Ready' status for this order.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={pickableSplits.length === 0 || !pickerName}
        >
          <Check className="mr-2 h-4 w-4" />
          Confirm Pick & Generate List
        </Button>
      </div>
    </Modal>
  );
};
