/**
 * Grouped GRN receipt — confirm step 1 for several GRNs arriving on the same vehicle.
 *
 * The receipt details and the documents that came with the delivery are captured once here and
 * written to every selected GRN. Doing this per GRN meant retyping the vehicle, driver and time and
 * re-uploading identical paperwork, and left records implying separate deliveries.
 */
import { useMemo, useState } from 'react';
import { X, Truck } from 'lucide-react';
import { ModalOverlay } from '../ui/ModalOverlay';
import { GrnConfirmReceiptSection } from './GrnConfirmReceiptSection';
import { DocFileUploadCell } from './DocFileUploadCell';
import {
  emptyGrnReceiptMeta,
  grnReceiptValidationErrors,
  type InboundGrnReceiptMeta,
} from '../../lib/inboundGrnReceiptMeta';
import {
  GRN_REQUIRED_DOC_LABELS,
  docKeysForChecklist,
  type GrnRequiredDocKey,
} from '../../lib/grnCopyReceiptDisplay';
import {
  buildGroupedReceiptUpdates,
  groupBlockReason,
  isGroupableForReceipt,
  sortGroupCandidates,
  type GroupableGrn,
} from '../../lib/groupedGrnReceipt';

type Props = {
  candidates: GroupableGrn[];
  assignableUsers: { displayName?: string | null }[];
  onClose: () => void;
  /** Applies the grouped receipt; resolves with how many GRNs were written. */
  onApply: (updates: ReturnType<typeof buildGroupedReceiptUpdates>) => Promise<void>;
};

export default function GroupedGrnReceiptModal({ candidates, assignableUsers, onClose, onApply }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<InboundGrnReceiptMeta>(emptyGrnReceiptMeta());
  const [sharedDocs, setSharedDocs] = useState<Record<string, { fileName?: string; ref?: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** Hide GRNs that cannot join — the list runs to a hundred rows and most are noise. */
  const [hideConfirmed, setHideConfirmed] = useState(true);

  const allRows = useMemo(() => sortGroupCandidates(candidates), [candidates]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((g) => {
      if (hideConfirmed && !isGroupableForReceipt(g)) return false;
      if (!q) return true;
      return `${g.grnNo} ${g.vendor ?? ''} ${g.poNo ?? ''}`.toLowerCase().includes(q);
    });
  }, [allRows, search, hideConfirmed]);
  const eligibleCount = useMemo(() => allRows.filter(isGroupableForReceipt).length, [allRows]);
  // Resolved against ALL rows, not the filtered view — a GRN selected before searching must stay
  // selected when it scrolls out of the filter.
  const selectedGrns = useMemo(() => allRows.filter((g) => selected.has(g.id)), [allRows, selected]);
  const visibleSelectable = useMemo(() => rows.filter(isGroupableForReceipt), [rows]);
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((g) => selected.has(g.id));

  // Composed fresh here, so an untouched checklist means "nothing ticked yet" — not "legacy GRN,
  // require the original three". Only what the operator actually ticks is asked for.
  const docKeys: GrnRequiredDocKey[] = useMemo(
    () => docKeysForChecklist(meta.checklist),
    [meta.checklist],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    setError(null);
    if (selectedGrns.length < 2) {
      setError('Select at least two GRNs — use the normal Confirm Receipt for a single GRN.');
      return;
    }
    const errs = grnReceiptValidationErrors(meta);
    if (errs.length) { setError(errs[0]); return; }
    const missingDocs = docKeys.filter((k) => !String(sharedDocs[k]?.fileName ?? '').trim());
    if (missingDocs.length > 0) {
      setError(
        `Upload ${missingDocs.map((k) => GRN_REQUIRED_DOC_LABELS[k]).join(', ')} — ticked on the checklist for this delivery.`,
      );
      return;
    }
    setBusy(true);
    try {
      await onApply(buildGroupedReceiptUpdates(selectedGrns, { meta, sharedDocs }, new Date().toISOString()));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="default">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-[95vw] xl:max-w-[76rem] my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-brand" aria-hidden />
            <div>
              <h2 className="text-base font-bold text-ink">Grouped GRN Receipt</h2>
              <p className="text-xs text-ink-3">
                One vehicle, several GRNs — details and documents are captured once and applied to all selected.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-5">
          <section className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-ink">
              1 · Select GRNs <span className="text-ink-3 font-normal">({selectedGrns.length} selected)</span>
            </h3>
            <p className="mt-1 text-xs text-ink-3">
              Only GRNs whose receipt has not been confirmed can join — re-confirming would overwrite an
              arrival record that is already signed off.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search GRN no, vendor or PO…"
                aria-label="Search GRNs"
                className="min-w-[16rem] flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <label className="flex items-center gap-1.5 text-xs text-ink-2">
                <input
                  type="checkbox"
                  checked={hideConfirmed}
                  onChange={(e) => setHideConfirmed(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Hide already confirmed
              </label>
              <button
                type="button"
                disabled={visibleSelectable.length === 0}
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    // Acts on what is visible, so a search narrows what "all" means.
                    if (allVisibleSelected) visibleSelectable.forEach((g) => next.delete(g.id));
                    else visibleSelectable.forEach((g) => next.add(g.id));
                    return next;
                  })
                }
                className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-50"
              >
                {allVisibleSelected ? 'Clear shown' : `Select shown (${visibleSelectable.length})`}
              </button>
              <span className="text-[11px] text-ink-4">
                {rows.length} of {allRows.length} shown · {eligibleCount} eligible
              </span>
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-hairline">
              {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-3">
                  {search.trim() ? `No GRN matches “${search.trim()}”.` : 'No GRNs awaiting receipt.'}
                </p>
              ) : rows.map((g) => {
                const blocked = groupBlockReason(g);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-3 px-3 py-2 ${blocked ? 'opacity-50' : 'cursor-pointer hover:bg-surface-2'}`}
                    title={blocked ?? undefined}
                  >
                    <input
                      type="checkbox"
                      disabled={Boolean(blocked)}
                      checked={selected.has(g.id)}
                      onChange={() => toggle(g.id)}
                      className="h-4 w-4"
                    />
                    <span className="font-mono text-xs font-semibold text-brand w-40 shrink-0">{g.grnNo}</span>
                    <span className="text-xs text-ink-2 truncate flex-1">{g.vendor || '—'}</span>
                    <span className="text-[11px] text-ink-4 truncate w-44">{g.poNo || ''}</span>
                    {blocked && <span className="text-[11px] text-ink-4 shrink-0">{blocked}</span>}
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <GrnConfirmReceiptSection
              value={meta}
              onChange={(patch) => setMeta((prev) => ({ ...prev, ...patch }))}
              assignableUsers={assignableUsers as never}
              disabled={busy}
            />
          </section>

          {docKeys.length > 0 && (
            <section className="rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-ink">
                3 · Shared documents <span className="text-err">*</span>
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                Uploaded once for the whole delivery and attached to every selected GRN. Asked for per the
                checklist above.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {docKeys.map((key) => (
                  <div key={key} className="rounded-lg border border-border bg-surface p-3">
                    <div className="text-xs font-semibold text-ink">
                      {GRN_REQUIRED_DOC_LABELS[key]} <span className="text-err">*</span>
                    </div>
                    <DocFileUploadCell
                      docKey={key}
                      fileName={sharedDocs[key]?.fileName ?? null}
                      uploaded={Boolean(sharedDocs[key]?.fileName)}
                      disabled={busy}
                      onUpload={(file) =>
                        setSharedDocs((prev) => ({ ...prev, [key]: { ...prev[key], fileName: file.name } }))
                      }
                      onClear={() => setSharedDocs((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && (
            <p className="rounded-md border border-err bg-err-soft px-3 py-2 text-xs font-semibold text-err">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => void apply()}
            disabled={busy}
            className="rounded-lg bg-ok px-4 py-2 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50"
          >
            {busy ? 'Applying…' : `Confirm Receipt for ${selectedGrns.length || ''} GRNs`.trim()}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
