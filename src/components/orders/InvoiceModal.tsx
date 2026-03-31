/**
 * InvoiceModal Component  
 * Generate invoice for picked orders — fetches invoice no and transporters from DB
 */

import React, { useState, useEffect, useRef } from 'react';
import { Check, DollarSign, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedSelect as Select, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { InvoiceModalProps, OrderItem } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO } from '../../utils/orderFulfillmentUtils';
import {
  fetchNextInvoiceNo,
  fetchTransporters,
  createInvoice,
  type TransporterOption,
} from '../../services/fulfillment.service';

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  selectedBprNos,
  onGenerateInvoice,
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
  const [transporter, setTransporter] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transporters, setTransporters] = useState<TransporterOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const allPicked =
    saleOrder?.items.flatMap((item) =>
      item.batchSplits
        .filter((sp) => sp.ffStatus === 'picking')
        .map((sp) => ({ item, split: sp }))
    ) ?? [];
  const pickedSplits =
    selectedBprNos?.length
      ? allPicked.filter(({ split }) => selectedBprNos.includes(split.bprNo))
      : allPicked;

  useEffect(() => {
    if (!isOpen || !saleOrder) return;

    let cancelled = false;
    setLoadingData(true);

    Promise.all([fetchNextInvoiceNo(), fetchTransporters()])
      .then(([nextInvNo, transporterList]) => {
        if (cancelled) return;
        setInvoiceNo(nextInvNo);
        setTransporters(transporterList);

        const today = new Date(getTodayISO());
        const due = new Date(today);
        const daysToAdd = parseInt(saleOrder.paymentTerms?.replace(/\D/g, '') || '30') || 30;
        due.setDate(today.getDate() + daysToAdd);
        setDueDate(due.toISOString().split('T')[0]);
      })
      .catch((err) => console.error('Failed to load invoice data:', err))
      .finally(() => { if (!cancelled) setLoadingData(false); });

    return () => { cancelled = true; };
  }, [isOpen, saleOrder]);

  const handleConfirm = async () => {
    const formEl = formRef.current;
    if (formEl && !formEl.reportValidity()) {
      const firstInvalid = formEl.querySelector(':invalid');
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    if (pickedSplits.length === 0 || !preparedBy || !invoiceNo) return;

    const subtotal = pickedSplits.reduce(
      (acc, { item, split }) => acc + (split.pickedQty ?? 0) * (item.unitPrice ?? item.rate ?? 0), 0
    );
    const gstPercent = 18;
    const totalValue = subtotal * (1 + gstPercent / 100);

    const selectedTransporter = transporters.find(t => t.name === transporter);

    const rate = (item: OrderItem) => item.unitPrice ?? item.rate ?? 0;
    const lineItems = pickedSplits.map(({ item, split }) => ({
      productName: item.productName,
      pack: item.pack,
      bprNo: split.bprNo,
      pickedQty: split.pickedQty ?? 0,
      rate: rate(item),
      amount: (split.pickedQty ?? 0) * rate(item),
    }));

    try {
      await createInvoice({
        fulfillmentOrderId: (saleOrder as any)?.id,
        invoiceNo,
        invoiceDate,
        dueDate,
        preparedBy,
        transporterId: selectedTransporter?.id || null,
        transporterName: transporter,
        lrAwbNo: lrNo || null,
        remarks: remarks || null,
        subtotal,
        gstPercent,
        totalValue,
        lineItems,
        ...(selectedBprNos?.length ? { bprNos: selectedBprNos } : {}),
      });
    } catch (err) {
      console.error('Failed to create invoice record:', err);
    }

    onGenerateInvoice({
      invoiceNo,
      invoiceDate,
      courier: transporter,
      paymentRef: lrNo,
      gstPercent,
      invoiceValue: totalValue,
      remarks,
      ...(selectedBprNos?.length ? { bprNos: selectedBprNos } : {}),
    });

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
    (acc, { item, split }) => acc + (split.pickedQty ?? 0) * (item.unitPrice ?? item.rate ?? 0), 0
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Create Invoice for SO: ${saleOrder.soNo}`} size="xl">
      <div className="p-6">
        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-orange-500 mr-3" size={20} />
            <span className="text-gray-500 text-sm">Loading invoice data...</span>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-3">
                <DollarSign className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Generate an invoice for the picked items. This will create a formal
                  invoice document and prepare the order for shipment.
                </p>
              </div>
            </div>

            <form ref={formRef} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-4">
                <div>
                  <Input label="Invoice No." value={invoiceNo} readOnly disabled />
                  <p className="text-xs text-gray-400 mt-1">Auto-generated</p>
                </div>
                <Input label="Invoice Date" type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                <Input label="Due Date" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <Input label="Prepared By" required value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Enter your name" />
              </div>

              <div className="space-y-4">
                <Select
                  label="Transporter"
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  options={[
                    { value: '', label: 'Select Transporter' },
                    ...transporters.map(t => ({ value: t.name, label: t.name })),
                  ]}
                />
                <Input label="LR / AWB No." value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="Tracking number" />
                <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes for invoice" />
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Items to be Invoiced</h3>
              {pickedSplits.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Product</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">BPR No</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Picked Qty</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Rate</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pickedSplits.map(({ item, split }, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{item.productName}</p>
                            <p className="text-xs text-gray-500">{item.pack}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-purple-600">{split.bprNo}</td>
                          <td className="px-4 py-3 text-right font-medium text-blue-600">{formatNumber(split.pickedQty ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">₹{formatNumber(item.unitPrice ?? item.rate)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{formatNumber((split.pickedQty ?? 0) * (item.unitPrice ?? item.rate ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-800">Total Invoice Value</td>
                        <td className="px-4 py-3 text-right font-bold text-xl text-gray-900">₹{formatNumber(totalInvoiceValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    No items have been picked for this order yet. Please complete the picking process first.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={loadingData || pickedSplits.length === 0 || !preparedBy || !invoiceNo}>
          <Check className="mr-2 h-4 w-4" />
          Confirm & Generate Invoice
        </Button>
      </div>
    </Modal>
  );
};
