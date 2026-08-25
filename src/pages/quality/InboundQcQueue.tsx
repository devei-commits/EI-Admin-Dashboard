import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGRNList, fetchGRNAssignableUsers } from '../../services/grn.service';
import {
  filterInboundQcQueue,
  type QualityGrnQueueInput,
  type QualityGrnQueueRow,
} from '../../lib/qualityGrnQueueDisplay';
import {
  buildQualityOrderManagementRow,
  type QualityOrderManagementInput,
  type QualityOrderManagementRow,
} from '../../lib/qualityOrderManagementTableDisplay';
import QualityCheckModal from '../../components/quality/QualityCheckModal';
import QualityGrnQueueTable from './QualityGrnQueueTable';

/**
 * GRNs the warehouse has sent to QC.
 *
 * This queue used to be read-only: its only action was a link to /warehouse/inbound labelled
 * "Inspect in Warehouse", so a GRN sitting at "QC Pending" had no way to be acted on from Quality —
 * the inspection form lived on a different page. It now opens that same form on the row.
 */
const InboundQcQueue: React.FC = () => {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<QualityGrnQueueInput[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQcRow, setActiveQcRow] = useState<QualityOrderManagementRow | null>(null);
  const [activeQcReadOnly, setActiveQcReadOnly] = useState(false);

  const loadQueue = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [list, users] = await Promise.all([fetchGRNList(), fetchGRNAssignableUsers()]);
      setGrns(list as QualityGrnQueueInput[]);
      setAssigneeOptions(
        users.map((u) => String(u.displayName ?? '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)),
      );
    } catch {
      setGrns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const queue = useMemo(() => filterInboundQcQueue(grns), [grns]);

  return (
    <div className="flex-1 overflow-y-auto bg-surface-2 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Order Management / Quality
          </p>
          <h1 className="text-2xl font-bold text-ink mt-1">Inbound QC Queue</h1>
          <p className="text-sm text-ink-2 mt-2">
            GRNs sent from warehouse via Send to QC. Use <strong>Complete QC</strong> to record the
            inspection — results and verdict are saved against the GRN. Rows stay here once decided,
            marked <strong>QC Tested</strong>, so the record doesn't disappear from the queue.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-ink-3">Loading queue…</p>
        ) : (
          <QualityGrnQueueTable
            grns={queue}
            emptyMessage="No GRNs awaiting inbound QC."
            actionLabel="Complete QC"
            actionLabelFor={(row: QualityGrnQueueRow) => (row.qcDecided ? 'View' : undefined)}
            onAction={(grn) => {
              const decided = String(grn.qcStatus ?? '').trim();
              setActiveQcReadOnly(decided === 'Passed' || decided === 'Pass' || decided === 'Rejected');
              setActiveQcRow(buildQualityOrderManagementRow(grn as QualityOrderManagementInput));
            }}
          />
        )}

        {activeQcRow ? (
          <QualityCheckModal
            row={activeQcRow}
            assigneeOptions={assigneeOptions}
            readOnly={activeQcReadOnly}
            onClose={() => setActiveQcRow(null)}
            onSaved={() => void loadQueue()}
            onThirdPartyReleased={() => navigate('/quality/third-party-tracking')}
          />
        ) : null}
      </div>
    </div>
  );
};

export default InboundQcQueue;
