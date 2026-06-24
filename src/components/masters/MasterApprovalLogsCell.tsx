import React, { useState } from 'react';
import type { MasterApprovalKind } from '../../constants/masterApprovalStatus';
import { MasterApprovalLifecycleLogsModal } from './MasterApprovalLifecycleLogsModal';

export type MasterApprovalLogsCellProps = {
  kind: MasterApprovalKind;
  itemId: string | number;
  itemCode: string;
  itemLabel?: string;
  currentStatus: string;
  recordCreatedAt?: string | null;
};

export function MasterApprovalLogsCell({
  kind,
  itemId,
  itemCode,
  itemLabel,
  currentStatus,
  recordCreatedAt,
}: MasterApprovalLogsCellProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 rounded whitespace-nowrap"
      >
        View logs
      </button>
      <MasterApprovalLifecycleLogsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        kind={kind}
        itemId={itemId}
        itemCode={itemCode}
        itemLabel={itemLabel}
        currentStatus={currentStatus}
        recordCreatedAt={recordCreatedAt}
      />
    </>
  );
}
