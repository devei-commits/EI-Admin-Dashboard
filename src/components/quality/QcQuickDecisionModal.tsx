import React, { useEffect, useState } from 'react';
import { X, Check, XCircle } from 'lucide-react';
import { fetchGRNQcReference, updateGRN } from '../../services/grn.service';
import type { GrnQcSpecsStored } from '../../lib/grnQcSpecs';
import type { QualityOrderManagementRow } from '../../lib/qualityOrderManagementTableDisplay';
import { ModalOverlay } from '../ui/ModalOverlay';

type QcQuickDecisionModalProps = {
  row: QualityOrderManagementRow;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Fast-track QC decision for a GRN line still "Awaiting QC" — skips the full checklist/attachments
 * review in QualityCheckModal and just records Approve/Reject. Distinct from that modal on purpose:
 * this is the shortcut path, not a smaller version of the full review.
 */
const QcQuickDecisionModal: React.FC<QcQuickDecisionModalProps> = ({ row, onClose, onSaved }) => {
  const [saving, setSaving] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qcSpecs, setQcSpecs] = useState<GrnQcSpecsStored | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGRNQcReference(row.id)
      .then((ref) => {
        if (cancelled) return;
        setQcSpecs({ ...ref.qcSpecs, attachments: ref.qcSpecs.attachments ?? [] });
      })
      .catch(() => {
        // Fast-track works even without a fetched reference — updateGRN is still sent with
        // qcStatus alone in that case, matching what the backend already accepts elsewhere.
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const decide = async (verdict: 'approve' | 'reject'): Promise<void> => {
    setSaving(verdict);
    setError(null);
    try {
      // Mirrors QualityCheckModal.persist(): the backend has only ever been exercised with
      // qcStatus alongside qcSpecs, so send both rather than qcStatus alone.
      // qcFastTrack tells the backend not to run validateQcSpecsForPassed — this modal skips the
      // full checklist on purpose, so the reference qcSpecs above has no reviewed (Pass/Fail +
      // result) tests for that validator to find, and "Approve QC" would 400 every time without it.
      await updateGRN(row.id, {
        qcStatus: verdict === 'approve' ? 'Passed' : 'Rejected',
        ...(qcSpecs ? { qcSpecs } : {}),
        qcFastTrack: true,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save decision');
      setSaving(null);
    }
  };

  return (
    <ModalOverlay onClose={onClose} dismissable={!saving}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-surface shadow-xl border border-border overflow-hidden"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-hairline">
          <div>
            <h2 className="text-sm font-bold text-ink">⏳ QC Decision — {row.itemName}</h2>
            <p className="text-[11px] text-ink-3 mt-0.5">
              {row.grnSourceNo} · {row.itemCode} · {row.section} · {row.qtyInQ} in Q
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-ink-2">
            Fast-track decision — records the QC result directly without running the full checklist.
            Use this to approve or reject the line and move it out of "Awaiting QC" now.
          </p>

          {error ? (
            <p className="text-xs text-rose-700" role="alert">{error}</p>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void decide('approve')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-ok text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-40"
            >
              <Check size={14} /> {saving === 'approve' ? 'Approving…' : 'Approve QC'}
            </button>
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void decide('reject')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-rose-300 bg-rose-50 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
            >
              <XCircle size={14} /> {saving === 'reject' ? 'Rejecting…' : 'Reject QC'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

export default QcQuickDecisionModal;
