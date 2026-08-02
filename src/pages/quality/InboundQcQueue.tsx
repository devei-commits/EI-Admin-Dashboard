import React, { useEffect, useMemo, useState } from 'react';
import { fetchGRNList } from '../../services/grn.service';
import { filterInboundQcQueue, type QualityGrnQueueInput } from '../../lib/qualityGrnQueueDisplay';
import QualityGrnQueueTable from './QualityGrnQueueTable';

const InboundQcQueue: React.FC = () => {
  const [grns, setGrns] = useState<QualityGrnQueueInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGRNList()
      .then((list) => setGrns(list as QualityGrnQueueInput[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  }, []);

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
            GRNs sent from warehouse via Send to QC — complete inspection in Order Management.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-ink-3">Loading queue…</p>
        ) : (
          <QualityGrnQueueTable
            grns={queue}
            emptyMessage="No GRNs awaiting inbound QC."
            actionLabel="Inspect in Warehouse"
          />
        )}
      </div>
    </div>
  );
};

export default InboundQcQueue;
