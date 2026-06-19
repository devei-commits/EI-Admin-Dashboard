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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-white/55 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-xl">
            <Loader2 className="h-10 w-10 shrink-0 animate-spin text-indigo-600" aria-hidden />
            <p className="text-sm font-medium text-gray-700">Loading…</p>
          </div>
        </div>
      )}

      <div className="flex min-h-screen bg-[#F7F7F9] text-gray-900">
        <ProcurementSidebar
          mainTab={mainTab}
          sideSection={sideSection}
          sideCounts={sideCounts}
          onNavigate={handleNavigate}
        />

        <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs text-gray-500 mb-0.5">Order Management / Procurement</div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 truncate">
                  {sectionTitle}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={onImportPoExcel}
                  disabled={importingPoExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline shrink-0"
                >
                  <LayoutDashboard size={16} className="shrink-0" aria-hidden />
                  Planning
                </Link>
                <span className="px-2 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                  {quoteStats.urgent} Urgent
                </span>
                <span className="px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                  {quoteStats.pendingAction} Pending
                </span>
                <span className="hidden md:inline px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Live · {liveSyncTime}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-4 sm:px-6 py-5">
            {mainTab === 'Procurement' ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 shadow-sm">
                {procurementContent}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
                {secondaryContent}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
