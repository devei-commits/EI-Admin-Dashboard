/**
 * BD Management — page host (route /bd). Reads the active tab from `?tab=`,
 * fetches the Customer Tracker rows once, and renders the shell + the active
 * view. Detail (§3A) and History (§3B) popups are managed here, as are the
 * Queries / Grievances / Meetings queues (Phase 2). Analytics is Phase 3.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import BDDashboardShell from '../../components/bd/BDDashboardShell';
import { CustomerTrackerView, type TrackerAction } from '../../components/bd/CustomerTrackerView';
import { CustomerDetailPopup } from '../../components/bd/CustomerDetailPopup';
import { HistoryTimelinePopup } from '../../components/bd/HistoryTimelinePopup';
import { ComingSoonView } from '../../components/bd/ComingSoonView';
import { QueriesView } from '../../components/bd/QueriesView';
import { GrievancesView } from '../../components/bd/GrievancesView';
import { MeetingsView } from '../../components/bd/MeetingsView';
import { NewTxnPopup, type TxnKind } from '../../components/bd/NewTxnPopup';
import { fetchBdCustomers } from '../../services/bd.service';
import type { BdCustomerRow } from '../../types/bd.types';
import { bdTabFromParam, bdParamFromTab, type BdTab } from '../../lib/bdNav';

const BDPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = bdTabFromParam(searchParams.get('tab'));

  const [customers, setCustomers] = useState<BdCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string>('');

  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [timelineFor, setTimelineFor] = useState<{ code: string; name: string } | null>(null);
  const [newTxn, setNewTxn] = useState<{ kind: TxnKind; client: { code: string; name: string } } | null>(null);

  const setTab = useCallback((tab: BdTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', bdParamFromTab(tab));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetchBdCustomers();
    if (res.success) {
      setCustomers(res.data ?? []);
      setSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setError(res.error || 'Failed to load customers');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach((c) => m.set(c.code, c.name));
    return m;
  }, [customers]);

  const counts: Partial<Record<BdTab, number>> = {
    'Customer Tracker': customers.length,
    Queries: customers.reduce((s, c) => s + (c.queries?.open ?? 0), 0),
    Grievances: customers.reduce((s, c) => s + (c.grievances?.open ?? 0), 0),
  };

  const handleAction = useCallback((action: TrackerAction, code: string, name?: string) => {
    setNewTxn({ kind: action, client: { code, name: name || code } });
  }, []);

  return (
    <>
      <BDDashboardShell
        activeTab={activeTab}
        onTabChange={setTab}
        counts={counts}
        subtitle={activeTab === 'Customer Tracker' ? 'One row per client — health at a glance' : undefined}
        liveSyncTime={syncedAt}
        refreshing={loading}
        onRefresh={() => void load()}
      >
        {activeTab === 'Customer Tracker' && (
          <CustomerTrackerView
            rows={customers}
            loading={loading}
            error={error}
            onRefresh={() => void load()}
            onOpenDetail={(code) => setDetailCode(code)}
            onOpenTimeline={(code) => setTimelineFor({ code, name: nameByCode.get(code) || '' })}
            onAction={(action, row) => handleAction(action, row.code, row.name)}
          />
        )}
        {activeTab === 'Queries' && <QueriesView clients={customers} onDataChanged={() => void load()} />}
        {activeTab === 'Grievances' && <GrievancesView clients={customers} onDataChanged={() => void load()} />}
        {activeTab === 'Meetings' && <MeetingsView clients={customers} onDataChanged={() => void load()} />}
        {activeTab === 'Analytics' && (
          <ComingSoonView title="Analytics" phase="Phase 3" icon={BarChart3}
            bullets={['CLV ranking & tier-mix donut', 'PIS TAT & Order TAT', 'Product-wise sales summary & revenue share']} />
        )}
      </BDDashboardShell>

      {detailCode && (
        <CustomerDetailPopup
          code={detailCode}
          onClose={() => setDetailCode(null)}
          onOpenTimeline={(code) => { setTimelineFor({ code, name: nameByCode.get(code) || '' }); }}
          onAction={(action, code, name) => handleAction(action, code, name)}
          onSaved={() => void load()}
        />
      )}

      {timelineFor && (
        <HistoryTimelinePopup
          code={timelineFor.code}
          name={timelineFor.name}
          onClose={() => setTimelineFor(null)}
        />
      )}

      {newTxn && (
        <NewTxnPopup
          kind={newTxn.kind}
          clients={customers}
          presetClient={newTxn.client}
          onClose={() => setNewTxn(null)}
          onCreated={() => void load()}
        />
      )}
    </>
  );
};

export default BDPage;
