import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Loader2 } from 'lucide-react';
import AdminMainMenuButton from '../AdminMainMenuButton';
import type { MainTab, SideSection } from '../../types/procurement.types';

const MAIN_TABS: MainTab[] = ['Procurement', 'Vendors', 'Reports'];

const PIPELINE_SECTIONS: SideSection[] = [
  'Overview',
  'Requests',
  'Quotations',
  'Draft POs',
  'Issued POs',
];

const OPERATIONS_SECTIONS: SideSection[] = ['GRN Monitor'];

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

function sectionTabClass(active: boolean): string {
  return active
    ? 'text-indigo-700 border-indigo-600'
    : 'text-gray-600 border-transparent hover:text-gray-900';
}

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
  const renderSectionTab = (section: SideSection) => {
    const active = mainTab === 'Procurement' && sideSection === section;
    return (
      <button
        key={section}
        type="button"
        onClick={() => onSideSectionChange(section)}
        className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${sectionTabClass(active)}`}
      >
        <span>{section}</span>
        <span
          className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
            active ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {sideCounts[section]}
        </span>
      </button>
    );
  };

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

      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 pt-3">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <AdminMainMenuButton />
              <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold">
                EI
              </div>
              <div className="text-sm font-semibold text-gray-900">Procurement Dashboard</div>
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
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Order Management / Procurement</div>
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">Procurement</h1>
            <p className="text-sm text-gray-500">Requests, quotations, purchase orders, and inbound GRN</p>
          </div>
        </div>

        <div className="flex gap-1 mb-5 bg-gray-100 border border-gray-200 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onMainTabChange(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                mainTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {mainTab === 'Procurement' ? (
          <>
            <div className="flex flex-wrap gap-1 mb-2 border-b border-gray-200 bg-white px-2 pt-1 rounded-t-lg overflow-x-auto">
              {PIPELINE_SECTIONS.map(renderSectionTab)}
            </div>
            <div className="flex flex-wrap gap-1 mb-5 border-b border-gray-200 bg-white px-2 pb-1 overflow-x-auto">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider self-center px-2">
                Operations
              </span>
              {OPERATIONS_SECTIONS.map(renderSectionTab)}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 shadow-sm">{procurementContent}</div>
          </>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
            {secondaryContent}
          </div>
        )}
      </div>
    </>
  );
}
