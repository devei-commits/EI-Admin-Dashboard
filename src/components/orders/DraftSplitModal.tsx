/**
 * DraftSplitModal — Port of splitDraftIntoMultiple from v15f.
 * Split a multi-line draft PO into one draft per line.
 */
import React from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { UnifiedModal } from '../ui/UnifiedComponents';

interface Props {
  draftId: string;
  onClose: () => void;
}

export default function DraftSplitModal({ draftId, onClose }: Props) {
  const { state, dispatch } = useGlobalState();

  const draft = (state.po.drafts || []).find((d: any) => d.id === draftId);
  if (!draft) {
    return (
      <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50">
        <div role="dialog" aria-modal="true" aria-label="Draft PO not found" className="bg-surface rounded-xl p-6">
          <p className="text-err">Draft PO not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-surface-3 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const lines = draft.lines || [];
  const canSplit = lines.length > 1;

  const handleSplit = () => {
    if (!canSplit) return;

    // Generate one new draft per line
    const newDrafts = lines.map((line: any) => ({
      id: 'PO-DRAFT-' + Math.random().toString(16).slice(2, 6).toUpperCase(),
      vendor: draft.vendor,
      vendorId: draft.vendorId,
      createdAt: new Date().toISOString(),
      status: 'DRAFT',
      termsId: draft.termsId,
      splitHint: 'SPLIT',
      lines: [line],
      notes: draft.notes,
    }));

    // Remove original draft and add new ones
    dispatch({
      type: 'SET_STATE',
      payload: {
        po: {
          ...state.po,
          drafts: [
            ...(state.po.drafts || []).filter((d: any) => d.id !== draftId),
            ...newDrafts,
          ],
        },
      },
    });

    onClose();
  };

  return (
    <UnifiedModal
      isOpen={true}
      onClose={onClose}
      title="Split Draft PO"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2 bg-surface-3 rounded-lg text-sm hover:bg-surface-3">
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={!canSplit}
            className="px-5 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Split into {lines.length} Drafts
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-3 -mt-4">{draft.id} · {draft.vendor} · {lines.length} line(s)</p>

      {!canSplit ? (
        <div className="bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg p-4 text-warn text-sm">
          Cannot split — this draft has only {lines.length} line. At least 2 lines are required.
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-3">
            This will split <b>{draft.id}</b> into <b>{lines.length}</b> separate draft POs (one per line item):
          </p>
          <div className="space-y-2 max-h-60 overflow-auto">
            {lines.map((line: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-3 bg-surface-3 text-sm">
                <div className="font-medium">{line.itemName}</div>
                <div className="text-xs text-ink-3 font-mono">{line.itemId} · {line.qty} {line.uom} · ₹{line.unit}/unit</div>
              </div>
            ))}
          </div>
        </>
      )}
    </UnifiedModal>
  );
}
