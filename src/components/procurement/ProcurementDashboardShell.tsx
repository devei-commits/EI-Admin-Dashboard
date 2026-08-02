import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Loader2 } from 'lucide-react';
import type { MainTab, SideSection } from '../../types/procurement.types';
import { ProcurementSidebar } from './ProcurementSidebar';

export type ProcurementDashboardShellProps = {
  mainTab: MainTab;
  onMainTabChange: (tab: MainTab) => void;
  sideSection: SideSection;
  onSideSectionChange: (section: SideSection) => void;
  sideCounts: Record<SideSection, number>;
  quoteStats: { urgent: number; pendingAction: number };
  liveSyncTime: string;
  importingPoExcel: boolean;
  onImportPoExcel: () => void;
  showGlobalLoader: boolean;
  procurementContent: ReactNode;
  secondaryContent?: ReactNode;
};

export default function ProcurementDashboardShell({
  mainTab,
  onMainTabChange,
  sideSection,
  onSideSectionChange,
  sideCounts,
  quoteStats,
  liveSyncTime,
  importingPoExcel,
  onImportPoExcel,
  showGlobalLoader,
  procurementContent,
  secondaryContent,
}: ProcurementDashboardShellProps): React.ReactElement {
  const handleNavigate = (tab: MainTab, section?: SideSection) => {
    if (tab !== 'Procurement') {
      onMainTabChange(tab);
      return;
    }
    if (section) {
      onSideSectionChange(section);
    } else {
      onMainTabChange('Procurement');
    }
  };

  const sectionTitle =
    mainTab === 'Procurement' ? sideSection : mainTab;

  return (
    <>
      {showGlobalLoader && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-hairline bg-surface px-8 py-6 shadow-[var(--e3)]">
            <Loader2 className="h-10 w-10 shrink-0 animate-spin text-brand" aria-hidden />
            <p className="text-sm font-medium text-ink-2">Loading…</p>
          </div>
        </div>
      )}

      <div className="flex min-h-screen bg-canvas text-ink">
        <ProcurementSidebar
          mainTab={mainTab}
          sideSection={sideSection}
          sideCounts={sideCounts}
          onNavigate={handleNavigate}
        />

        <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
          <div className="sticky top-0 z-20 bg-surface border-b border-hairline px-4 sm:px-6 py-3 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs text-ink-3 mb-0.5">Order Management / Procurement</div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink truncate">
                  {sectionTitle}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={onImportPoExcel}
                  disabled={importingPoExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-sm font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-60"
                  title="Import PO Excel (PR rows, Quotation rows, Raw PO Detail)"
                >
                  {importingPoExcel ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                      Importing…
                    </>
                  ) : (
                    'Import PO Excel'
                  )}
                </button>
                <Link
                  to="/planning"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-press underline-offset-2 hover:underline shrink-0"
                >
                  <LayoutDashboard size={16} className="shrink-0" aria-hidden />
                  Planning
                </Link>
                <span className="px-2 py-1 rounded-full border border-[color:var(--st-red-fg)]/30 bg-err-soft text-err">
                  {quoteStats.urgent} Urgent
                </span>
                <span className="px-2 py-1 rounded-full border border-[color:var(--st-amber-fg)]/30 bg-warn-soft text-warn">
                  {quoteStats.pendingAction} Pending
                </span>
                <span className="hidden md:inline px-2 py-1 rounded-full border border-[color:var(--st-green-fg)]/30 bg-ok-soft text-ok">
                  Live · {liveSyncTime}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-4 sm:px-6 py-5">
            {mainTab === 'Procurement' ? (
              <div className="bg-surface rounded-[var(--r-lg)] border border-hairline p-4 sm:p-5 shadow-[var(--e1)]">
                {procurementContent}
              </div>
            ) : (
              <div className="bg-surface rounded-[var(--r-lg)] border border-hairline p-4 sm:p-5 shadow-[var(--e1)] space-y-4">
                {secondaryContent}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
