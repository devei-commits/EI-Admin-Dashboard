/**
 * DraftSplitModal — Port of splitDraftIntoMultiple from v15f.
 * Split a multi-line draft PO into one draft per line.
 */
import { useGlobalState } from '../../context/GlobalStateContext';

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
        <div className="bg-white rounded-xl p-6">
          <p className="text-red-600">Draft PO not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-gray-200 rounded-lg">Close</button>
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
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">Split Draft PO</h2>
            <p className="text-slate-300 text-sm mt-1">{draft.id} · {draft.vendor} · {lines.length} line(s)</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!canSplit ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
              Cannot split — this draft has only {lines.length} line. At least 2 lines are required.
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                This will split <b>{draft.id}</b> into <b>{lines.length}</b> separate draft POs (one per line item):
              </p>
              <div className="space-y-2 max-h-60 overflow-auto">
                {lines.map((line: any, idx: number) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 text-sm">
                    <div className="font-medium">{line.itemName}</div>
                    <div className="text-xs text-gray-500 font-mono">{line.itemId} · {line.qty} {line.uom} · ₹{line.unit}/unit</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2 bg-gray-200 rounded-lg text-sm hover:bg-gray-300">
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={!canSplit}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Split into {lines.length} Drafts
          </button>
        </div>
      </div>
    </div>
  );
}
