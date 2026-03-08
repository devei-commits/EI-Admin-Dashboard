/**
 * InvoiceModal Component  
 * Generate invoice for picked orders — bright theme with line items
 */

import React, { useState, useEffect } from 'react';
import {
  Check,
  DollarSign,
} from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { InvoiceModalProps } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO } from '../../utils/orderFulfillmentUtils';

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onGenerateInvoice,
}) => {
  const [invoiceNo, setInvoiceNo] = useState(
    `INV-${saleOrder?.soNo.replace('SO', '') ?? ''}`
  );
  const [invoiceDate, setInvoiceDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
  const [transporter, setTransporter] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  const pickedSplits =
    saleOrder?.items.flatMap((item) =>
      item.batchSplits
        .filter((sp) => sp.ffStatus === 'picked')
        .map((sp) => ({ item, split: sp }))
    ) ?? [];

  useEffect(() => {
    if (saleOrder) {
      setInvoiceNo(`INV-${saleOrder.soNo.replace('SO', '')}`);
      const today = new Date(getTodayISO());
      const due = new Date(today);
      const daysToAdd = parseInt(saleOrder.paymentTerms?.replace(/\D/g, '') || '30') || 30;
      due.setDate(today.getDate() + daysToAdd);
      setDueDate(due.toISOString().split('T')[0]);
    }
  }, [saleOrder, isOpen]);

  const handleConfirm = () => {
    if (pickedSplits.length === 0) return;

    const invoiceData = {
      invoiceNo,
      invoiceDate,
      courier: transporter,
      paymentRef: lrNo,
      gstPercent: 18,
      invoiceValue: pickedSplits.reduce(
        (acc, { item, split }) =>
          acc + (split.pickedQty ?? 0) * item.rate,
        0
      ),
      remarks,
    };

    onGenerateInvoice(invoiceData);
    handleClose();
  };

  const handleClose = () => {
    setPreparedBy('');
    setTransporter('');
    setLrNo('');
    setRemarks('');
    onClose();
  };

  if (!saleOrder) return null;

  const totalInvoiceValue = pickedSplits.reduce(
    (acc, { item, split }) => acc + (split.pickedQty ?? 0) * item.rate,
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Create Invoice for SO: ${saleOrder.soNo}`}
      size="xl"
    >
      <div className="p-6">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <DollarSign className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Generate an invoice for the picked items. This will create a formal
              invoice document and prepare the order for shipment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left Column: Invoice Details */}
          <div className="space-y-4">
            <Input
              label="Invoice No."
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
            <Input
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              label="Prepared By"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          {/* Right Column: Transport Details */}
          <div className="space-y-4">
            <Input
              label="Transporter"
              value={transporter}
              onChange={(e) => setTransporter(e.target.value)}
              placeholder="e.g., Delhivery, FedEx"
            />
            <Input
              label="LR / AWB No."
              value={lrNo}
              onChange={(e) => setLrNo(e.target.value)}
              placeholder="Tracking number"
            />
            <Input
              label="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes for invoice"
            />
          </div>
        </div>

        {/* Picked Items Table */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Items to be Invoiced
          </h3>
          {pickedSplits.length > 0 ? (
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
                      Picked Qty
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">
                      Rate
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pickedSplits.map(({ item, split }, idx) => (
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
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {formatNumber(split.pickedQty ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        ₹{formatNumber(item.rate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        ₹{formatNumber((split.pickedQty ?? 0) * item.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-right font-bold text-gray-800"
                    >
                      Total Invoice Value
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xl text-gray-900">
                      ₹{formatNumber(totalInvoiceValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                No items have been picked for this order yet. Please complete the
                picking process first.
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
          disabled={pickedSplits.length === 0 || !preparedBy || !invoiceNo}
        >
          <Check className="mr-2 h-4 w-4" />
          Confirm & Generate Invoice
        </Button>
      </div>
    </Modal>
  );
};

