/**
 * PickModal Component  
 * Interface for picking FG items from warehouse
 */

import React, { useState, useEffect } from 'react';
import { Package, MapPin, Check, User, Calendar, File, StickyNote, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { PickModalProps } from '../../types/orderFulfillment';
import { formatNumber, getTodayISO, cleanAddress } from '../../utils/orderFulfillmentUtils';

export const PickModal: React.FC<PickModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  selectedBprNos,
  onConfirmPick,
}) => {
  const [pickerName, setPickerName] = useState('');
  const [pickDate, setPickDate] = useState(getTodayISO());
  const [pickSlipNo, setPickSlipNo] = useState(
    `PS-${String(Date.now()).slice(-5)}`
  );
  const [remarks, setRemarks] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const allPickable =
    saleOrder?.items.flatMap((item) =>
      item.batchSplits
        .filter((sp) => sp.ffStatus === 'fg_ready')
        .map((sp) => ({ item, split: sp }))
    ) ?? [];
  const pickableSplits =
    selectedBprNos?.length
      ? allPickable.filter(({ split }) => selectedBprNos.includes(split.bprNo))
      : allPickable;

  useEffect(() => {
    if (saleOrder && pickableSplits.length > 0) {
      const initialQty: Record<string, number> = {};
      pickableSplits.forEach(({ split }) => {
        initialQty[split.bprNo] = split.fgQty;
      });
      setQuantities(initialQty);
    }
  }, [saleOrder?.soNo, isOpen, selectedBprNos?.join(',')]);

  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
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

    setSubmitting(true);
    try {
      await Promise.resolve(onConfirmPick(pickData));
      handleClose();
    } catch {
      // Error already logged by parent; keep modal open
    } finally {
      setSubmitting(false);
    }
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
        <div className="mb-6 p-4 bg-brand-soft border border-brand-soft rounded-lg">
          <p className="text-sm text-brand">
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
          <div className="p-4 border rounded-lg bg-surface-3 h-fit">
            <h3 className="font-semibold text-ink mb-2 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-ink-3" /> Shipping Address
            </h3>
            <address className="not-italic text-ink-3">
              <strong className="font-semibold text-ink">
                {saleOrder.customer}
              </strong>
              <br />
              <span className="whitespace-pre-wrap">{cleanAddress(saleOrder.shipAddress, saleOrder.customer)}</span>
            </address>
          </div>
        </div>

        {/* Pickable Items Table */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-ink mb-2">
            Items Ready for Picking
          </h3>
          {pickableSplits.length > 0 ? (
            <div className="overflow-auto max-h-[70vh] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-surface-3 sticky top-0 z-20 [&_th]:bg-surface-3">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">
                      BPR No
                    </th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">
                      Location
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">
                      Available
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">
                      Pick Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pickableSplits.map(({ item, split }, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">
                          {item.productName}
                        </p>
                        <p className="text-xs text-ink-3">{item.pack}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-brand">
                        {split.bprNo}
                      </td>
                      <td className="px-4 py-3">
                        {split.fgLocation ? (
                          <span className="inline-flex items-center gap-1.5 bg-brand-soft text-brand px-2 py-1 rounded-full text-xs font-medium">
                            <MapPin size={12} />
                            {split.fgLocation}
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ok">
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
            <div className="p-4 bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg">
              <p className="text-sm text-warn">
                No items are currently in 'FG Ready' status for this order.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 bg-surface-3 border-t">
        <Button variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={pickableSplits.length === 0 || !pickerName || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Confirm Pick & Generate List
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
};
