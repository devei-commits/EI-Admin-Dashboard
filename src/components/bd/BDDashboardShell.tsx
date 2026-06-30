/**
 * BD Management dashboard shell — sidebar + sticky header + content slot.
 * Self-contained (does not depend on the procurement shell's header chrome).
 * Controlled: active tab + switching handled by the page host. Tool-native light.
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { BDSidebar } from './BDSidebar';
import type { BdTab } from '../../lib/bdNav';

export interface BDDashboardShellProps {
  activeTab: BdTab;
  onTabChange: (tab: BdTab) => void;
  counts?: Partial<Record<BdTab, number>>;
  subtitle?: string;
  liveSyncTime?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

const BDDashboardShell: React.FC<BDDashboardShellProps> = ({
  activeTab, onTabChange, counts, subtitle, liveSyncTime, refreshing, onRefresh, children,
}) => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <BDSidebar activeTab={activeTab} counts={counts} onNavigate={onTabChange} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                BD Management
              </p>
              <h1 className="truncate text-lg font-bold text-slate-800">{activeTab}</h1>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              {liveSyncTime && (
                <span className="hidden sm:inline text-[11px] text-slate-400">
                  Synced {liveSyncTime}
                </span>
              )}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  title="Refresh"
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
                >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden px-4 py-4 sm:px-6">{children}</main>
      </div>
    </div>
  );
};

export default BDDashboardShell;
