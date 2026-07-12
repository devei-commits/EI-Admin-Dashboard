/**
 * SoActionModals — reusable operational modal host.
 *
 * Extracted from SaleOrdersView so any view (e.g. the SO Dashboard) can drive
 * the full Add / Detail / Edit / Pick / Invoice / Ship / Track flow imperatively
 * via a ref, without re-implementing the modal state machine.
 *
 * Usage:
 *   const ref = useRef<SoActionModalsHandle>(null);
 *   <SoActionModals ref={ref} saleOrders={...} onPickConfirm={...} ... />
 *   ref.current?.openPick('SO-03601');
 */
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import type {
  SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData,
} from '../../types/orderFulfillment';
import { AddSOModal } from './AddSOModal';
import { SODetailModal } from './SODetailModal';
import { PickModal } from './PickModal';
import { InvoiceModal } from './InvoiceModal';
import { ShipModal } from './ShipModal';
import { TrackModal } from './TrackModal';
import { EditSOModal } from './EditSOModal';

export type SoUpdatePayload = {
  customer: string;
  customerCity: string;
  orderDate: string;
  dueDate: string;
  priority: 'normal' | 'high';
  shipAddress: string;
  paymentTerms: string;
  notes: string;
  items: Array<{ sku: string; productName: string; pack: string; orderedQty: number; unitPrice: number }>;
};

export interface SoActionModalsProps {
  saleOrders: SaleOrder[];
  onAddSO: (data: AddSOData) => void;
  onUpdateSO: (soNo: string, data: SoUpdatePayload) => Promise<void> | void;
  /** Returns updated order on success so we can chain into the Invoice modal with fresh data. */
  onPickConfirm: (soNo: string, data: PickData) => void | Promise<SaleOrder | void>;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void | Promise<void>;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
  /** Fired after any successful mutation so the host view can refresh its data. */
  onAfterChange?: () => void;
}

export interface SoActionModalsHandle {
  openAdd: () => void;
  openDetail: (soNo: string) => void;
  openEdit: (soNo: string) => void;
  openPick: (soNo: string, bprNos?: string[]) => void;
  openInvoice: (soNo: string, bprNos?: string[]) => void;
  openShip: (soNo: string, bprNos?: string[]) => void;
  openTrack: (soNo: string, bprNos?: string[]) => void;
  /** Edit-lock check exposed so callers can hide/disable the Edit action. */
  isEditLocked: (so: SaleOrder) => boolean;
}

// Edit is always allowed — no lock regardless of batch / production status.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function computeEditLocked(_so: SaleOrder): boolean {
  return false;
}

export const SoActionModals = forwardRef<SoActionModalsHandle, SoActionModalsProps>(function SoActionModals(
  { saleOrders, onAddSO, onUpdateSO, onPickConfirm, onGenerateInvoice, onDispatch, onConfirmDelivery, onAfterChange },
  ref
) {
  const [isAddSOModalOpen, setIsAddSOModalOpen] = useState(false);
  const [detailModalSO, setDetailModalSO] = useState<SaleOrder | null>(null);
  const [pickModalSO, setPickModalSO] = useState<SaleOrder | null>(null);
  const [invoiceModalSO, setInvoiceModalSO] = useState<SaleOrder | null>(null);
  const [shipModalSO, setShipModalSO] = useState<SaleOrder | null>(null);
  const [trackModalSO, setTrackModalSO] = useState<SaleOrder | null>(null);
  const [editModalSO, setEditModalSO] = useState<SaleOrder | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pickSelectedBprNos, setPickSelectedBprNos] = useState<string[] | undefined>(undefined);
  const [invoiceSelectedBprNos, setInvoiceSelectedBprNos] = useState<string[] | undefined>(undefined);
  const [shipSelectedBprNos, setShipSelectedBprNos] = useState<string[] | undefined>(undefined);
  const [trackSelectedBprNos, setTrackSelectedBprNos] = useState<string[] | undefined>(undefined);

  const findSo = (soNo: string) => saleOrders.find((o) => o.soNo === soNo) ?? null;

  useImperativeHandle(ref, () => ({
    openAdd: () => setIsAddSOModalOpen(true),
    openDetail: (soNo) => { const so = findSo(soNo); if (so) setDetailModalSO(so); },
    openEdit: (soNo) => { const so = findSo(soNo); if (so) setEditModalSO(so); },
    openPick: (soNo, bprNos) => { const so = findSo(soNo); if (so) { setPickModalSO(so); setPickSelectedBprNos(bprNos); } },
    openInvoice: (soNo, bprNos) => { const so = findSo(soNo); if (so) { setInvoiceModalSO(so); setInvoiceSelectedBprNos(bprNos); } },
    openShip: (soNo, bprNos) => { const so = findSo(soNo); if (so) { setShipModalSO(so); setShipSelectedBprNos(bprNos); } },
    openTrack: (soNo, bprNos) => { const so = findSo(soNo); if (so) { setTrackModalSO(so); setTrackSelectedBprNos(bprNos); } },
    isEditLocked: computeEditLocked,
  }), [saleOrders]);

  const handlePickConfirm = async (data: PickData) => {
    if (!pickModalSO) return;
    const so = pickModalSO;
    const bprNos = data.splits.map((s) => s.bprNo);
    try {
      const updated = await Promise.resolve(onPickConfirm(so.soNo, data));
      setPickModalSO(null);
      setPickSelectedBprNos(undefined);
      // Chain straight into the Invoice modal for the just-picked batches.
      setInvoiceModalSO((updated as SaleOrder | undefined) ?? so);
      setInvoiceSelectedBprNos(bprNos);
      onAfterChange?.();
    } catch {
      setPickModalSO(null);
      setPickSelectedBprNos(undefined);
    }
  };

  const handleInvoiceGenerate = async (data: InvoiceData) => {
    if (!invoiceModalSO) return;
    await Promise.resolve(onGenerateInvoice(invoiceModalSO.soNo, data));
    onAfterChange?.();
  };

  const handleDispatchConfirm = (data: ShipData) => {
    if (!shipModalSO) return;
    onDispatch(shipModalSO.soNo, data);
    onAfterChange?.();
  };

  const handleDeliveryConfirm = (data: DeliveryData) => {
    if (!trackModalSO) return;
    onConfirmDelivery(trackModalSO.soNo, data);
    onAfterChange?.();
  };

  return (
    <>
      <AddSOModal
        isOpen={isAddSOModalOpen}
        onClose={() => setIsAddSOModalOpen(false)}
        onSave={(data) => { onAddSO(data); onAfterChange?.(); }}
      />

      <SODetailModal
        isOpen={!!detailModalSO}
        onClose={() => setDetailModalSO(null)}
        saleOrder={detailModalSO}
        onEditSO={(soNo) => { const so = findSo(soNo); if (so) setEditModalSO(so); }}
        editDisabled={false}
        editDisabledReason={undefined}
        onAction={(action, _soNo, split) => {
          if (!detailModalSO) return;
          const bprNos = split ? [split.bprNo] : undefined;
          switch (action) {
            case 'pick': setPickModalSO(detailModalSO); setPickSelectedBprNos(bprNos); break;
            case 'invoice': setInvoiceModalSO(detailModalSO); setInvoiceSelectedBprNos(bprNos); break;
            case 'ship': setShipModalSO(detailModalSO); setShipSelectedBprNos(bprNos); break;
            case 'track': setTrackModalSO(detailModalSO); setTrackSelectedBprNos(bprNos); break;
          }
          setDetailModalSO(null);
        }}
      />

      <EditSOModal
        isOpen={!!editModalSO}
        saleOrder={editModalSO}
        canEdit={true}
        lockReason={undefined}
        isSaving={editSaving}
        onClose={() => setEditModalSO(null)}
        onSave={async (payload) => {
          if (!editModalSO) return;
          setEditSaving(true);
          try {
            await Promise.resolve(onUpdateSO(editModalSO.soNo, payload));
            setEditModalSO(null);
            onAfterChange?.();
          } finally {
            setEditSaving(false);
          }
        }}
      />

      <PickModal
        isOpen={!!pickModalSO}
        onClose={() => { setPickModalSO(null); setPickSelectedBprNos(undefined); }}
        saleOrder={pickModalSO}
        selectedBprNos={pickSelectedBprNos}
        onConfirmPick={handlePickConfirm}
      />

      <InvoiceModal
        isOpen={!!invoiceModalSO}
        onClose={() => { setInvoiceModalSO(null); setInvoiceSelectedBprNos(undefined); }}
        saleOrder={invoiceModalSO}
        selectedBprNos={invoiceSelectedBprNos}
        onGenerateInvoice={handleInvoiceGenerate}
      />

      <ShipModal
        isOpen={!!shipModalSO}
        onClose={() => { setShipModalSO(null); setShipSelectedBprNos(undefined); }}
        saleOrder={shipModalSO}
        selectedBprNos={shipSelectedBprNos}
        onDispatch={handleDispatchConfirm}
      />

      <TrackModal
        isOpen={!!trackModalSO}
        onClose={() => { setTrackModalSO(null); setTrackSelectedBprNos(undefined); }}
        saleOrder={trackModalSO}
        selectedBprNos={trackSelectedBprNos}
        onConfirmDelivery={handleDeliveryConfirm}
      />
    </>
  );
});
