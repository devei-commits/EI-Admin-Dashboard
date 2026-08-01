import React, { useEffect, useMemo, useState } from 'react';
import { fetchGRNList } from '../../services/grn.service';
import { filterQcHistory, type QualityGrnQueueInput } from '../../lib/qualityGrnQueueDisplay';
import QualityGrnQueueTable from './QualityGrnQueueTable';

const QcHistory: React.FC = () => {
  const [grns, setGrns] = useState<QualityGrnQueueInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGRNList()
      .then((list) => setGrns(list as QualityGrnQueueInput[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  }, []);

  const history = useMemo(() => filterQcHistory(grns), [grns]);

  return (
    <div className="flex-1 overflow-y-auto bg-surface-2 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Order Management / Quality
          </p>
          <h1 className="text-2xl font-bold text-ink mt-1">QC History</h1>
          <p className="text-sm text-ink-2 mt-2">GRNs with QC TESTED · PASS status.</p>
        </div>
        {loading ? (
          <p className="text-sm text-ink-3">Loading history…</p>
        ) : (
          <QualityGrnQueueTable grns={history} emptyMessage="No QC-passed GRNs yet." actionLabel="View" />
        )}
      </div>
    </div>
  );
};

export default QcHistory;
