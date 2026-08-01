/**
 * InvoiceModal Component  
 * Generate invoice for picked orders — transporters from DB; invoice number assigned on confirm by the API.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Check, DollarSign, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedSelect as Select, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { InvoiceModalProps, OrderItem } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO } from '../../utils/orderFulfillmentUtils';
import {
  fetchTransporters,
  createInvoice,
  type TransporterOption,
} from '../../services/fulfillment.service';
import { creditDaysFromPaymentTermsStored } from '../../lib/stagedPaymentTerms';
import { useToast } from '../../context/ToastContext';

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  selectedBprNos,
  onGenerateInvoice,
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
  const [transporter, setTransporter] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transporters, setTransporters] = useState<TransporterOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { addToast } = useToast();

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
    if (isOpen) setSubmitError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !saleOrder) return;

    let cancelled = false;
    setLoadingData(true);

    fetchTransporters()
      .then((transporterList) => {
        if (cancelled) return;
        setTransporters(transporterList);

        const today = new Date(getTodayISO());
        const due = new Date(today);
        const daysToAdd = creditDaysFromPaymentTermsStored(saleOrder.paymentTerms);
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

    if (pickedSplits.length === 0 || !preparedBy) return;

    const fulfillmentOrderId = saleOrder.id;
    if (fulfillmentOrderId == null) {
      const msg = 'This order has no fulfillment id — refresh the page and try again.';
      setSubmitError(msg);
      addToast('error', msg);
      return;
    }

    const subtotal = pickedSplits.reduce(
      (acc, { item, split }) => acc + (split.pickedQty ?? 0) * (item.unitPrice ?? item.rate ?? 0), 0
    );
    const gstPercent = 18;
    const totalValue = subtotal * (1 + gstPercent / 100);

    const selectedTransporter = transporters.find(t => t.name === transporter);

    const rate = (item: OrderItem) => item.unitPrice ?? item.rate ?? 0;
    const lineItems = pickedSplits.map(({ item, split }) => {
      const qty = split.pickedQty ?? 0;
      const unitRate = rate(item);
      return {
        productName: item.productName,
        pack: item.pack,
        bprNo: split.bprNo,
        sku: item.sku,
        quantity: qty,
        pickedQty: qty,
        rate: unitRate,
        amount: qty * unitRate,
      };
    });

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createInvoice({
        fulfillmentOrderId,
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

      const no = created.invoiceNo || '';
      const zohoId = created.zoho_invoice_id != null && String(created.zoho_invoice_id).trim()
        ? String(created.zoho_invoice_id).trim()
        : '';

      if (zohoId) {
        addToast(
          'success',
          `Invoice ${no} was generated and synced to Zoho Books (invoice id ${zohoId}).`
        );
      } else {
        addToast(
          'success',
          `Invoice ${no} was generated successfully. Zoho Books sync is off or not required — saved in the app only.`
        );
      }

      await Promise.resolve(
        onGenerateInvoice({
          invoiceNo: no,
          invoiceDate,
          courier: transporter,
          paymentRef: lrNo,
          gstPercent,
          invoiceValue: totalValue,
          remarks,
          ...(selectedBprNos?.length ? { bprNos: selectedBprNos } : {}),
        })
      );

      handleCloseAfterSuccess();
    } catch (err) {
      console.error('Failed to create invoice record:', err);
      const msg =
        err instanceof Error ? err.message : 'Invoice could not be created. Please try again.';
      setSubmitError(msg);
      addToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Reset fields and close after a successful API call (keeps modal open on failure). */
  const handleCloseAfterSuccess = () => {
    setPreparedBy('');
    setTransporter('');
    setLrNo('');
    setRemarks('');
    setSubmitError(null);
    onClose();
  };

  const handleClose = () => {
    setPreparedBy('');
    setTransporter('');
    setLrNo('');
    setRemarks('');
    setSubmitError(null);
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
            <Loader2 className="animate-spin text-brand mr-3" size={20} />
            <span className="text-ink-3 text-sm">Loading invoice data...</span>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-brand-soft border border-brand-soft rounded-lg">
              <div className="flex gap-3">
                <DollarSign className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                <p className="text-sm text-brand">
                  Generate an invoice for the picked items. When Zoho Books is enabled, the server saves the invoice
                  and syncs it to Zoho in one step — if Zoho fails, nothing is committed.
                </p>
              </div>
            </div>

            <form ref={formRef} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink-2">Invoice No.</span>
                  <div className="rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-ink-3">
                    Assigned on the server when you confirm (avoids duplicate numbers if several invoices are created at once).
                  </div>
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
              <h3 className="text-lg font-medium text-ink mb-2">Items to be Invoiced</h3>
              {pickedSplits.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-3">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Product</th>
                        <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">BPR No</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Picked Qty</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Rate</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pickedSplits.map(({ item, split }, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-ink">{item.productName}</p>
                            <p className="text-xs text-ink-3">{item.pack}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-brand">{split.bprNo}</td>
                          <td className="px-4 py-3 text-right font-medium text-brand">{formatNumber(split.pickedQty ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-ink-3">₹{formatNumber(item.unitPrice ?? item.rate)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-ink">₹{formatNumber((split.pickedQty ?? 0) * (item.unitPrice ?? item.rate ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-3 border-t-2">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-bold text-ink">Total Invoice Value</td>
                        <td className="px-4 py-3 text-right font-bold text-xl text-ink">₹{formatNumber(totalInvoiceValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg">
                  <p className="text-sm text-warn">
                    No items have been picked for this order yet. Please complete the picking process first.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="p-4 bg-surface-3 border-t space-y-3">
        {submitError ? (
          <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3 py-2 text-sm text-err" role="alert">
            {submitError}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loadingData || submitting || pickedSplits.length === 0 || !preparedBy}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {submitting ? 'Creating…' : 'Confirm & Generate Invoice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
