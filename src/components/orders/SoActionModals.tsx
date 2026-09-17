/**
 * SoActionModals — reusable operational modal host.
 *
 * Extracted from SaleOrdersView so any view (e.g. the SO Dashboard) can drive
 * the full Add / Detail / Edit / Pick / Invoice / Ship / Track flow imperatively
 * via a ref, without re-implementing the modal state machine.
 *
 * Each open* call fetches that one sales order (GET /fulfillment/:id) on demand. The host view
 * only needs the slim dashboard rows — it never loads the full order book up front.
 *
 * Usage:
 *   const ref = useRef<SoActionModalsHandle>(null);
 *   <SoActionModals ref={ref} onPickConfirm={...} ... />
 *   ref.current?.openPick(1234);
 */
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import type {
  SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData, SalesOrderStatus,
} from '../../types/orderFulfillment';
import { fetchFulfillmentOrderById, fastForwardInvoiceForOrder } from '../../services/fulfillment.service';
import { useToast } from '../../context/ToastContext';
import { AddSOModal } from './AddSOModal';
import { SODetailModal } from './SODetailModal';
import { PickModal } from './PickModal';
import { InvoiceModal } from './InvoiceModal';
import { ShipModal } from './ShipModal';
import { TrackModal } from './TrackModal';
import { EditSOModal } from './EditSOModal';
import { FastForwardModal, type FastForwardLineInput } from './FastForwardModal';

export type SoUpdatePayload = {
  customer: string;
  customerCity: string;
  orderDate: string;
  dueDate: string;
  priority: 'normal' | 'high';
  shipAddress: string;
  paymentTerms: string;
  notes: string;
  /** Authoritative sales_orders.status set via Edit SO → Update SO Status (drives PIS Extracted). */
  salesOrderStatus?: SalesOrderStatus;
  items: Array<{
    sku: string;
    productName: string;
    pack: string;
    orderedQty: number;
    unitPrice: number;
    mrp?: number | null;
    /** Individual per-line tax — % and ₹ amount, never a hardcoded platform default. */
    taxPct?: number;
    taxAmount?: number;
  }>;
};

export interface SoActionModalsProps {
  onAddSO: (data: AddSOData) => void;
  onUpdateSO: (soId: number, data: SoUpdatePayload) => Promise<void> | void;
  /** Returns updated order on success so we can chain into the Invoice modal with fresh data. */
  onPickConfirm: (soId: number, data: PickData) => void | Promise<SaleOrder | void>;
  onGenerateInvoice: (soId: number, data: InvoiceData) => void | Promise<void>;
  onDispatch: (soId: number, data: ShipData) => void;
  onConfirmDelivery: (soId: number, data: DeliveryData) => void;
  /** Fired after any successful mutation so the host view can refresh its data. */
  onAfterChange?: () => void;
}

/** All open* calls take the fulfillment order id and load that order's full detail on demand. */
export interface SoActionModalsHandle {
  openAdd: () => void;
  openDetail: (soId: number) => void;
  openEdit: (soId: number) => void;
  openPick: (soId: number, bprNos?: string[]) => void;
  openInvoice: (soId: number, bprNos?: string[]) => void;
  openShip: (soId: number, bprNos?: string[]) => void;
  openTrack: (soId: number, bprNos?: string[]) => void;
  openFastForward: (soId: number) => void;
  /** Edit-lock check exposed so callers can hide/disable the Edit action. */
  isEditLocked: (so: SaleOrder) => boolean;
}

// Edit is always allowed — no lock regardless of batch / production status.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function computeEditLocked(_so: SaleOrder): boolean {
  return false;
}

export const SoActionModals = forwardRef<SoActionModalsHandle, SoActionModalsProps>(function SoActionModals(
  { onAddSO, onUpdateSO, onPickConfirm, onGenerateInvoice, onDispatch, onConfirmDelivery, onAfterChange },
  ref
) {
  const { addToast } = useToast();
  const [loadingSo, setLoadingSo] = useState(false);
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

  // Fast Forward — triggered from the SO row menu and from the SO Detail modal's footer button.
  const [fastForwardModalSO, setFastForwardModalSO] = useState<SaleOrder | null>(null);

  /** Fetch one order's full detail (items + batch splits) for the modal that is about to open. */
  const loadSo = async (soId: number): Promise<SaleOrder | null> => {
    setLoadingSo(true);
    try {
      const so = await fetchFulfillmentOrderById(soId);
      if (!so) addToast('error', 'Could not load that sales order');
      return so;
    } finally {
      setLoadingSo(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openAdd: () => setIsAddSOModalOpen(true),
    openDetail: async (soId) => { const so = await loadSo(soId); if (so) setDetailModalSO(so); },
    openEdit: async (soId) => { const so = await loadSo(soId); if (so) setEditModalSO(so); },
    openPick: async (soId, bprNos) => { const so = await loadSo(soId); if (so) { setPickModalSO(so); setPickSelectedBprNos(bprNos); } },
    openInvoice: async (soId, bprNos) => { const so = await loadSo(soId); if (so) { setInvoiceModalSO(so); setInvoiceSelectedBprNos(bprNos); } },
    openShip: async (soId, bprNos) => { const so = await loadSo(soId); if (so) { setShipModalSO(so); setShipSelectedBprNos(bprNos); } },
    openTrack: async (soId, bprNos) => { const so = await loadSo(soId); if (so) { setTrackModalSO(so); setTrackSelectedBprNos(bprNos); } },
    openFastForward: async (soId) => { const so = await loadSo(soId); if (so) setFastForwardModalSO(so); },
    isEditLocked: computeEditLocked,
  }), []);

  const handlePickConfirm = async (data: PickData) => {
    if (!pickModalSO?.id) return;
    const so = pickModalSO as SaleOrder & { id: number };
    const bprNos = data.splits.map((s) => s.bprNo);
    try {
      const updated = await Promise.resolve(onPickConfirm(so.id, data));
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
    if (!invoiceModalSO?.id) return;
    await Promise.resolve(onGenerateInvoice(invoiceModalSO.id, data));
    onAfterChange?.();
  };

  const handleDispatchConfirm = (data: ShipData) => {
    if (!shipModalSO?.id) return;
    onDispatch(shipModalSO.id, data);
    onAfterChange?.();
  };

  const handleDeliveryConfirm = (data: DeliveryData) => {
    if (!trackModalSO?.id) return;
    onConfirmDelivery(trackModalSO.id, data);
    onAfterChange?.();
  };

  const handleFastForwardConfirm = async (lines: FastForwardLineInput[]) => {
    if (!fastForwardModalSO?.id) return;
    try {
      await fastForwardInvoiceForOrder(fastForwardModalSO.id, lines);
      onAfterChange?.();
    } catch (e) {
      const body = (e as { body?: { error?: string } })?.body;
      const msg = typeof body?.error === 'string' && body.error.trim()
        ? body.error
        : 'Failed to fast-forward this sale order.';
      addToast('error', msg);
      throw e; // keep the modal open so the entered quantities aren't lost
    }
  };

  return (
    <>
      {/* The clicked SO's detail is fetched on demand, so give that click immediate feedback. */}
      {loadingSo && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-gray-900/90 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Loading sales order…
        </div>
      )}

      <AddSOModal
        isOpen={isAddSOModalOpen}
        onClose={() => setIsAddSOModalOpen(false)}
        onSave={(data) => { onAddSO(data); onAfterChange?.(); }}
      />

      <SODetailModal
        isOpen={!!detailModalSO}
        onClose={() => setDetailModalSO(null)}
        saleOrder={detailModalSO}
        onEditSO={() => { if (detailModalSO) { setEditModalSO(detailModalSO); setDetailModalSO(null); } }}
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
            // Already has the full order loaded — no need to re-fetch via openFastForward.
            case 'fast_forward': setFastForwardModalSO(detailModalSO); break;
          }
          setDetailModalSO(null);
        }}
      />

      <FastForwardModal
        isOpen={!!fastForwardModalSO}
        onClose={() => setFastForwardModalSO(null)}
        saleOrder={fastForwardModalSO}
        onConfirm={handleFastForwardConfirm}
      />

      <EditSOModal
        isOpen={!!editModalSO}
        saleOrder={editModalSO}
        canEdit={true}
        lockReason={undefined}
        isSaving={editSaving}
        onClose={() => setEditModalSO(null)}
        onSave={async (payload) => {
          if (!editModalSO?.id) return;
          setEditSaving(true);
          try {
            await Promise.resolve(onUpdateSO(editModalSO.id, payload));
            setEditModalSO(null);
            onAfterChange?.();
          } catch (e) {
            // Surface the backend's actual reason (e.g. a cancel blocked by a confirmed production
            // batch) — without this, a rejected save just silently failed with no feedback and the
            // modal stayed open looking unchanged.
            const body = (e as { body?: { error?: string } })?.body;
            const msg = typeof body?.error === 'string' && body.error.trim()
              ? body.error
              : 'Failed to save sale order changes.';
            addToast('error', msg);
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
