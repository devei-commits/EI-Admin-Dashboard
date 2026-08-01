import { useMemo, useState } from 'react';
import type { TransferLabel } from './TransferPickModal';
import { ModalOverlay } from '../../../components/ui/ModalOverlay';

/**
 * Pick & Initiate Transfer (dispatch) modal — opens after labels are generated.
 * The picker scans/checks each transfer label, attaches a photo, fills vehicle/driver/dispatch
 * details + a dispatch photo, then "Dispatch & Update Status" moves the transfer to In Transit.
 *
 * Photos (Option A): each image is compressed to a small JPEG data URL client-side and stored in
 * the MRN's `generated_labels` JSON (per-label `photo`, plus a `dispatch` entry). No file server /
 * S3 needed — move to S3 later if photo volume grows. Restock labels are excluded from dispatch.
 */

export interface DispatchDetails {
  vehicleNo: string;
  driver: string;
  trackingNo: string;
  dispatchDate: string;
  dispatchPhoto: string | null;
}

export interface DispatchLabelState extends TransferLabel {
  picked: boolean;
  photo: string | null;
}

interface TransferDispatchModalProps {
  open: boolean;
  onClose: () => void;
  labels: TransferLabel[]; // all labels from the pick step; restock ones are filtered out here
  route?: string;
  today?: string; // ISO yyyy-mm-dd to seed dispatch date (Date.now is avoided for testability)
  onDispatch: (result: { labels: DispatchLabelState[]; dispatch: DispatchDetails }) => Promise<void> | void;
  saving?: boolean;
}

/** Compress an image File to a small JPEG data URL (max ~900px, quality 0.6). */
function compressImage(file: File, maxDim = 900, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const TransferDispatchModal = ({
  open,
  onClose,
  labels,
  route = 'MW → ML1',
  today = '',
  onDispatch,
  saving = false,
}: TransferDispatchModalProps) => {
  const transferLabels = useMemo(() => labels.filter((l) => l.kind === 'transfer'), [labels]);

  const [rows, setRows] = useState<Record<string, { picked: boolean; photo: string | null }>>({});
  const [dispatch, setDispatch] = useState<DispatchDetails>({
    vehicleNo: '',
    driver: '',
    trackingNo: '',
    dispatchDate: today,
    dispatchPhoto: null,
  });
  const [error, setError] = useState<string | null>(null);

  const rowOf = (code: string) => rows[code] ?? { picked: false, photo: null };
  const setRow = (code: string, patch: Partial<{ picked: boolean; photo: string | null }>) =>
    setRows((prev) => ({ ...prev, [code]: { ...rowOf(code), ...patch } }));

  const pickedCount = transferLabels.filter((l) => rowOf(l.code).picked).length;
  const photoCount = transferLabels.filter((l) => rowOf(l.code).photo).length;
  const allPicked = transferLabels.length > 0 && pickedCount === transferLabels.length;

  const trNumbers = useMemo(
    () => Array.from(new Set(transferLabels.map((l) => l.trNo).filter(Boolean) as string[])),
    [transferLabels]
  );

  const toggleAll = () => {
    const next = !allPicked;
    setRows((prev) => {
      const out = { ...prev };
      for (const l of transferLabels) out[l.code] = { ...rowOf(l.code), picked: next };
      return out;
    });
  };

  const onPhoto = async (code: string, file: File | null) => {
    if (!file) return;
    try {
      const data = await compressImage(file);
      setRow(code, { photo: data, picked: true });
    } catch {
      setError('Could not read that photo. Try again.');
    }
  };

  const onDispatchPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const data = await compressImage(file);
      setDispatch((d) => ({ ...d, dispatchPhoto: data }));
    } catch {
      setError('Could not read the dispatch photo.');
    }
  };

  const handleDispatch = async () => {
    setError(null);
    const picked = transferLabels.filter((l) => rowOf(l.code).picked);
    if (picked.length === 0) return setError('Mark at least one label as picked.');
    if (!dispatch.vehicleNo.trim()) return setError('Vehicle No. is required.');
    if (!dispatch.driver.trim()) return setError('Driver / transporter is required.');
    if (!dispatch.trackingNo.trim()) return setError('Tracking / LR No. is required.');
    if (!dispatch.dispatchDate) return setError('Dispatch date is required.');
    const payloadLabels: DispatchLabelState[] = picked.map((l) => ({
      ...l,
      picked: true,
      photo: rowOf(l.code).photo,
    }));
    await onDispatch({ labels: payloadLabels, dispatch });
  };

  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="default" scroll align="start">
      <div
        className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 id="dispatch-modal-title" className="text-lg font-bold text-ink">
              🚚 Pick &amp; Initiate Transfer{trNumbers.length ? ` — ${trNumbers.join('/')}` : ''}
              {trNumbers.length > 1 ? ' (consolidated)' : ''}
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              {route} · {transferLabels.length} label{transferLabels.length === 1 ? '' : 's'} · scan + photo + dispatch
            </p>
          </div>
          <button onClick={onClose} className="text-ink-4 hover:text-ink-2 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-6">
          {error && <div className="px-4 py-3 rounded-lg border border-err-soft bg-err-soft text-err text-sm">{error}</div>}

          {/* Pick checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-ink-2">✅ Pick checklist (confirm each label · attach photo)</div>
              <button onClick={toggleAll} className="text-xs font-semibold text-brand hover:text-brand-press">
                {allPicked ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="border border-border rounded-lg overflow-auto max-h-[70vh]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-20 bg-surface-2 text-ink-2">
                  <tr className="text-left [&_th]:bg-surface-2">
                    <th scope="col" className="px-3 py-2 font-semibold">Label</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Item</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Qty</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Rack</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-center">Picked?</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-center">Photo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {transferLabels.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-4">No transfer labels to dispatch.</td></tr>
                  ) : (
                    transferLabels.map((l) => {
                      const st = rowOf(l.code);
                      return (
                        <tr key={l.code} className="hover:bg-surface-2">
                          <td className="px-3 py-2 font-medium text-ink">{l.code}</td>
                          <td className="px-3 py-2 text-ink-2">{l.itemName} <span className="text-ink-4">{l.itemCode}</span></td>
                          <td className="px-3 py-2 text-ink-2">{l.qty} {l.uom}</td>
                          <td className="px-3 py-2 text-ink-3">{l.rack ?? l.route ?? '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={st.picked} onChange={(e) => setRow(l.code, { picked: e.target.checked })} className="w-4 h-4 accent-brand" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <label className="inline-flex items-center gap-1 cursor-pointer text-xs">
                              {st.photo ? (
                                <img src={st.photo} alt="" className="w-8 h-8 object-cover rounded border border-border" />
                              ) : (
                                <span className="px-2 py-1 rounded border border-border text-ink-3 hover:bg-surface-3">📷 Add</span>
                              )}
                              <input type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={(e) => { void onPhoto(l.code, e.target.files?.[0] ?? null); }} />
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-ink-3">
              {pickedCount} of {transferLabels.length} picked · {photoCount} photo{photoCount === 1 ? '' : 's'} captured.
              {' '}Use <b>Select all</b> or check a subset if dispatching in multiple trips.
            </div>
          </div>

          {/* Dispatch details */}
          <div>
            <div className="text-sm font-semibold text-ink-2 mb-2">🚚 Vehicle / dispatch details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-xs font-medium text-ink-2">Vehicle No.
                <input value={dispatch.vehicleNo} onChange={(e) => setDispatch((d) => ({ ...d, vehicleNo: e.target.value }))}
                  placeholder="TS-09-AB-7714"
                  className="mt-1 w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </label>
              <label className="text-xs font-medium text-ink-2">Driver / Transporter
                <input value={dispatch.driver} onChange={(e) => setDispatch((d) => ({ ...d, driver: e.target.value }))}
                  placeholder="Internal-001"
                  className="mt-1 w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </label>
              <label className="text-xs font-medium text-ink-2">Tracking / LR No.
                <input value={dispatch.trackingNo} onChange={(e) => setDispatch((d) => ({ ...d, trackingNo: e.target.value }))}
                  placeholder="LR / tracking number"
                  className="mt-1 w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </label>
              <label className="text-xs font-medium text-ink-2">Dispatch Date
                <input type="date" value={dispatch.dispatchDate} onChange={(e) => setDispatch((d) => ({ ...d, dispatchDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </label>
              <div className="text-xs font-medium text-ink-2">Dispatch Photo / Doc
                <label className="mt-1 flex items-center gap-2 cursor-pointer">
                  {dispatch.dispatchPhoto ? (
                    <img src={dispatch.dispatchPhoto} alt="" className="w-10 h-10 object-cover rounded border border-border" />
                  ) : (
                    <span className="px-3 py-2 rounded border border-border text-ink-3 text-sm hover:bg-surface-3">📷 Attach</span>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { void onDispatchPhoto(e.target.files?.[0] ?? null); }} />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-2">Cancel</button>
          <button onClick={handleDispatch} disabled={saving || pickedCount === 0}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Dispatching…' : `Dispatch & Update Status (${pickedCount})`}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

export default TransferDispatchModal;
