import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchGRNAssignableUsers,
  fetchGRNList,
  updateGRN,
} from '../../services/grn.service';
import { filterQualityOrderManagementQueue } from '../../lib/qualityOrderManagementTableDisplay';
import type { QualityOrderManagementInput } from '../../lib/qualityOrderManagementTableDisplay';
import type { QualityOrderManagementRow } from '../../lib/qualityOrderManagementTableDisplay';
import QualityOrderManagementTable from './QualityOrderManagementTable';
import QualityCheckModal from '../../components/quality/QualityCheckModal';

const OrderManagementQueue: React.FC = () => {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<QualityOrderManagementInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignSavingId, setAssignSavingId] = useState<string | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [activeQcRow, setActiveQcRow] = useState<QualityOrderManagementRow | null>(null);

  const loadQueue = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [list, users] = await Promise.all([fetchGRNList(), fetchGRNAssignableUsers()]);
      setGrns(list as QualityOrderManagementInput[]);
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

  const queue = useMemo(() => filterQualityOrderManagementQueue(grns), [grns]);

  const handleAssign = async (row: QualityOrderManagementRow, assignee: string): Promise<void> => {
    setAssignSavingId(row.id);
    try {
      const updated = await updateGRN(row.id, { assignedTo: assignee || undefined });
      setGrns((prev) =>
        prev.map((g) => (g.id === row.id ? { ...g, assignedTo: updated.assignedTo } : g)),
      );
    } catch {
      // keep previous value on failure
    } finally {
      setAssignSavingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-2 p-6 sm:p-8">
      <div className="max-w-[90rem] mx-auto space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Order Management / Quality
            </p>
            <h1 className="text-2xl font-bold text-ink mt-1">Quality Control</h1>
            <p className="text-sm text-ink-2 mt-2">
              GRNs sent from warehouse — assign inspectors and run QC from here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loading}
            className="text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <QualityOrderManagementTable
          grns={queue}
          assigneeOptions={assigneeOptions}
          assignSavingId={assignSavingId}
          onAssign={(row, assignee) => void handleAssign(row, assignee)}
          onOpenQc={setActiveQcRow}
          loading={loading}
        />

        {activeQcRow ? (
          <QualityCheckModal
            row={activeQcRow}
            assigneeOptions={assigneeOptions}
            readOnly={activeQcRow.qcDecided}
            onClose={() => setActiveQcRow(null)}
            onSaved={() => void loadQueue()}
            onThirdPartyReleased={() => navigate('/quality/third-party-tracking')}
          />
        ) : null}
      </div>
    </div>
  );
};

export default OrderManagementQueue;
