/**
 * ShipModal Component  
 * Dispatch and shipping details — matches reference workflow
 */

import React, { useState, useEffect } from 'react';
import { Truck, Check, Package, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { ShipModalProps } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO } from '../../utils/orderFulfillmentUtils';
import { fetchTransporters, type TransporterOption } from '../../services/fulfillment.service';

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const ShipModal: React.FC<ShipModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  selectedBprNos,
  onDispatch,
}) => {
  const [courier, setCourier] = useState('');
  const [awbNo, setAwbNo] = useState('');
  const [dispatchDate, setDispatchDate] = useState(getTodayISO());
  const [numBoxes, setNumBoxes] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [eta, setEta] = useState(addDays(getTodayISO(), 3));
  const [vehicleRemarks, setVehicleRemarks] = useState('');
  const [transporters, setTransporters] = useState<TransporterOption[]>([]);
  const [loadingTransporters, setLoadingTransporters] = useState(false);

  const allInvoiced =
    saleOrder?.items.flatMap((item) =>
      item.batchSplits
        .filter((sp) => sp.ffStatus === 'invoiced')
        .map((sp) => ({ item, split: sp }))
    ) ?? [];
  const invoicedSplits =
    selectedBprNos?.length
      ? allInvoiced.filter(({ split }) => selectedBprNos.includes(split.bprNo))
      : allInvoiced;

  useEffect(() => {
    if (isOpen) {
      setCourier('');
      setAwbNo('');
      setDispatchDate(getTodayISO());
      setNumBoxes('');
      setTotalWeight('');
      setEta(addDays(getTodayISO(), 3));
      setVehicleRemarks('');

      setLoadingTransporters(true);
      fetchTransporters()
        .then(setTransporters)
        .catch(() => setTransporters([]))
        .finally(() => setLoadingTransporters(false));
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (invoicedSplits.length === 0 || !courier || !awbNo) return;

    onDispatch({
      awbNo,
      courier,
      dispatchDate,
      numBoxes: parseInt(numBoxes) || 0,
      totalWeight: parseFloat(totalWeight) || 0,
      eta,
      vehicleNo: vehicleRemarks,
      driverName: '',
      driverPhone: '',
      remarks: vehicleRemarks,
      ...(selectedBprNos?.length ? { bprNos: selectedBprNos } : {}),
    });
    onClose();
  };

  if (!saleOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dispatch — ${saleOrder.soNo}`}
      size="lg"
    >
      <div className="p-6">
        <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
          <Truck className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700">
            Enter shipment details to confirm dispatch. AWB / LR number will be used for delivery tracking.
          </p>
        </div>

        {/* Deliver To */}
        <div className="mb-5 p-4 border rounded-lg bg-gray-50 flex items-start gap-3">
          <Package className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delivering To</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{saleOrder.customer}</p>
            <p className="text-xs text-gray-500">{saleOrder.shipAddress}</p>
          </div>
        </div>

        {/* Shipment form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Courier / Transporter *</label>
            {loadingTransporters ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select...</option>
                {transporters.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">AWB / LR Number *</label>
            <input
              type="text"
              value={awbNo}
              onChange={(e) => setAwbNo(e.target.value)}
              placeholder="e.g. BD1234567890"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <Input
            label="Dispatch Date"
            type="date"
            value={dispatchDate}
            onChange={(e) => setDispatchDate(e.target.value)}
          />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">No. of Boxes / Cartons</label>
            <input
              type="number"
              value={numBoxes}
              onChange={(e) => setNumBoxes(e.target.value)}
              placeholder="e.g. 48"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Gross Weight (KG)</label>
            <input
              type="number"
              value={totalWeight}
              onChange={(e) => setTotalWeight(e.target.value)}
              placeholder="e.g. 840"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <Input
            label="Estimated Delivery"
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Vehicle No / Driver / Remarks</label>
            <input
              type="text"
              value={vehicleRemarks}
              onChange={(e) => setVehicleRemarks(e.target.value)}
              placeholder="e.g. MH12AB1234 · Ramesh · Handle fragile items gently"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Items Being Dispatched */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Items Being Dispatched</p>
          {invoicedSplits.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Product</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">BPR No</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Invoice No</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoicedSplits.map(({ item, split }, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.pack}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-purple-600">{split.bprNo}</td>
                      <td className="px-4 py-3">
                        {split.invoiceNo ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            {String(split.invoiceNo)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-600">
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
                No items have been invoiced for this order yet. Please generate an invoice first.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          disabled={invoicedSplits.length === 0 || !courier || !awbNo}
        >
          <Truck className="mr-2 h-4 w-4" />
          Confirm Dispatch
        </Button>
      </div>
    </Modal>
  );
};
