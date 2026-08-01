import React, { useEffect, useMemo, useState } from 'react';
import { fetchGRNList } from '../../services/grn.service';
import {
  filterInboundQcQueue,
  filterQcHistory,
  filterQuarantineQueue,
  type QualityGrnQueueInput,
} from '../../lib/qualityGrnQueueDisplay';

const QualityOverview: React.FC = () => {
  const [grns, setGrns] = useState<QualityGrnQueueInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGRNList()
      .then((list) => setGrns(list as QualityGrnQueueInput[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      inboundQc: filterInboundQcQueue(grns).length,
      quarantine: filterQuarantineQueue(grns).length,
      history: filterQcHistory(grns).length,
    }),
    [grns],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-surface-2 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Order Management / Quality
          </p>
          <h1 className="text-2xl font-bold text-ink mt-1">Quality Overview</h1>
          <p className="text-sm text-ink-2 mt-2">
            Inbound QC, quarantine review, and release after warehouse verification.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Inbound QC</p>
            <p className="text-3xl font-bold text-ink mt-2">{loading ? '—' : counts.inboundQc}</p>
            <p className="text-xs text-ink-3 mt-1">Sent from warehouse · pending QC</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Quarantine</p>
            <p className="text-3xl font-bold text-ink mt-2">{loading ? '—' : counts.quarantine}</p>
            <p className="text-xs text-ink-3 mt-1">Awaiting Send to QC from warehouse</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ok">QC Passed</p>
            <p className="text-3xl font-bold text-ink mt-2">{loading ? '—' : counts.history}</p>
            <p className="text-xs text-ink-3 mt-1">Completed QC inspections</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityOverview;
