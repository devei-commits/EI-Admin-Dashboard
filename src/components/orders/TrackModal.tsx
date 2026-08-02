/**
 * TrackModal Component
 * Per-split shipment tracking with stepper timeline. Mark Delivered per split or Mark All Delivered.
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
} from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { TrackModalProps } from '../../types/orderFulfillment';
import { formatDate, getTodayISO } from '../../utils/orderFulfillmentUtils';

const STEPS = [
  { key: 'order_placed', label: 'Order Placed', icon: ClipboardList },
  { key: 'fg_stored', label: 'FG Stored', icon: Warehouse },
  { key: 'picked', label: 'Picked', icon: Box },
  { key: 'invoiced', label: 'Invoice', icon: FileText },
  { key: 'dispatched', label: 'Dispatched', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

function getStepIndex(ffStatus: string): number {
  const map: Record<string, number> = {
    fg_pending: 0, wip: 0, bulk_qc: 0,
    fg_ready: 1,
    picking: 2,
    invoiced: 3,
    shipped: 4,
    delivered: 6,
    closed: 6,
  };
  return map[ffStatus] ?? 0;
}

function Stepper({ split }: { split: { ffStatus: string; fgLocation?: string | null; pickedQty?: number; invoiceNo?: string | null; dispatchDate?: string | null; awbNo?: string | null; courier?: string | null; etaDate?: string | null; deliveryDate?: string | null } }) {
  const baseStep = getStepIndex(split.ffStatus);
  const activeStep = split.ffStatus === 'shipped' ? 5 : baseStep;

  return (
    <div className="flex flex-col gap-0">
      {STEPS.map((step, idx) => {
        const done = idx < activeStep;
        const active = idx === activeStep;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex gap-3 items-start">
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                ${done ? 'bg-ok text-white' : active ? 'bg-brand text-white' : 'bg-surface-3 text-ink-3'}
              `}
            >
              {done && <Check className="w-3.5 h-3.5" />}
              {active && (idx === 5 ? <MapPin className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />)}
              {!done && !active && idx === 6 && <span className="text-[10px]">?</span>}
            </div>
            <div className="pb-4">
              <div className={`text-xs font-bold ${done ? 'text-ok' : active ? 'text-brand' : 'text-ink-4'}`}>
                {step.key === 'fg_stored' && split.fgLocation ? `FG Stored — ${split.fgLocation}` : step.label}
              </div>
              <div className="text-[10px] text-ink-3 mt-0.5">
                {step.key === 'picked' && (split.pickedQty != null) && split.pickedQty > 0 && `${split.pickedQty.toLocaleString('en-IN')} units`}
                {step.key === 'invoiced' && split.invoiceNo && `${split.invoiceNo} · ${split.dispatchDate ? formatDate(split.dispatchDate) : ''}`}
                {step.key === 'dispatched' && (split.courier || split.awbNo) && `${split.courier || ''} ${split.awbNo ? `AWB: ${split.awbNo}` : ''} ${split.dispatchDate ? formatDate(split.dispatchDate) : ''}`}
                {step.key === 'out_for_delivery' && split.etaDate && `ETA: ${formatDate(split.etaDate)}`}
                {step.key === 'delivered' && split.deliveryDate && formatDate(split.deliveryDate)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const TrackModal: React.FC<TrackModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  selectedBprNos,
  onConfirmDelivery,
}) => {
  const [deliveryDate, setDeliveryDate] = useState(getTodayISO());
  const [receivedBy, setReceivedBy] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');

  if (!saleOrder) return null;

  const allSplitsRaw = saleOrder.items.flatMap((item) =>
    item.batchSplits.map((sp) => ({
      ...sp,
      productName: item.productName,
      pack: item.pack,
    }))
  );
  const allSplits =
    selectedBprNos?.length
      ? allSplitsRaw.filter((sp) => selectedBprNos.includes(sp.bprNo))
      : allSplitsRaw;

  const shippedSplits = allSplits.filter((sp) => sp.ffStatus === 'shipped');
  const allDelivered = allSplits.length > 0 && allSplits.every((sp) => ['delivered', 'closed'].includes(sp.ffStatus));
  const hasShipped = shippedSplits.length > 0;

  const handleMarkAllDelivered = () => {
    onConfirmDelivery({
      deliveryDate,
      receivedBy,
      remarks: deliveryRemarks,
      ...(selectedBprNos?.length ? { bprNos: selectedBprNos } : {}),
    });
    handleClose();
  };

  const handleMarkSplitDelivered = (bprNo: string) => {
    onConfirmDelivery({
      deliveryDate: getTodayISO(),
      receivedBy,
      remarks: deliveryRemarks,
      bprNos: [bprNo],
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
      title={`Tracking — ${saleOrder.soNo}`}
      size="xl"
    >
      <div className="p-6">
        {allDelivered ? (
          <div className="mb-6 p-4 bg-ok-soft border border-[color:var(--st-green-fg)]/30 rounded-lg flex gap-3">
            <CheckCircle className="h-5 w-5 text-ok shrink-0 mt-0.5" />
            <p className="text-sm text-ok">This order has been fully delivered.</p>
          </div>
        ) : !hasShipped ? (
          <div className="mb-6 p-4 bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg flex gap-3">
            <Package className="h-5 w-5 text-warn shrink-0 mt-0.5" />
            <p className="text-sm text-warn">
              This order has not been shipped yet. Complete dispatch first.
            </p>
          </div>
        ) : null}

        <div className="space-y-6">
          {allSplits.filter((s) => ['fg_ready', 'picking', 'invoiced', 'shipped', 'delivered', 'closed'].includes(s.ffStatus)).map((split, idx) => (
            <div key={idx} className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-surface-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-ink text-sm">{split.productName}</p>
                  <p className="text-xs text-ink-3">{split.pack} · {split.bprNo} · {(split.pickedQty ?? split.fgQty ?? 0).toLocaleString('en-IN')} units</p>
                </div>
                {(split.awbNo || split.courier) && (
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-ink-2">AWB: {split.awbNo || '—'}</p>
                    <p className="text-[10px] text-ink-3">{split.courier}</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <Stepper split={split} />
              </div>
              {split.ffStatus === 'shipped' && (
                <div className="px-4 py-2 bg-surface-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-ink-3">
                    ETA: <b className="text-ink-2">{split.etaDate ? formatDate(split.etaDate) : '—'}</b>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => handleMarkSplitDelivered(split.bprNo)}>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Mark Delivered
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 bg-surface-3 border-t">
        <Button variant="ghost" onClick={handleClose}>
          Close
        </Button>
        {hasShipped && !allDelivered && (
          <Button onClick={handleMarkAllDelivered}>
            <Check className="w-4 h-4 mr-2" />
            Mark All Delivered
          </Button>
        )}
      </div>
    </Modal>
  );
};
