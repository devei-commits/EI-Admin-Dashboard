import React, { useState } from 'react';
import eilogofull from '../../assets/logo/eilogofull.svg';
import AdminMainMenuButton from '../AdminMainMenuButton';
import type { MainTab, SideSection } from '../../types/procurement.types';
import { PROCUREMENT_SECTIONS } from '../../lib/procurementNav';

export type ProcurementSidebarProps = {
  mainTab: MainTab;
  sideSection: SideSection;
  sideCounts: Record<SideSection, number>;
  onNavigate: (tab: MainTab, section?: SideSection) => void;
};

function sectionButtonClass(active: boolean): string {
  return `flex items-center justify-between gap-2 w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 text-sm border-l-4 ${
    active
      ? 'bg-indigo-50 text-indigo-900 font-semibold border-l-indigo-600'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-transparent hover:border-l-indigo-300'
  }`;
}

export function ProcurementSidebar({
  mainTab,
  sideSection,
  sideCounts,
  onNavigate,
}: ProcurementSidebarProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const handleSection = (section: SideSection) => {
    onNavigate('Procurement', section);
    setIsOpen(false);
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-slate-200 z-50 flex items-center px-4 shadow-sm">
        <AdminMainMenuButton />
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close procurement menu' : 'Open procurement menu'}
        >
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <img src={eilogofull} alt="Esthetic Insights" className="h-8 ml-3 object-contain" />
      </div>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-white/60 backdrop-blur-md z-30 mt-14"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed md:sticky md:top-0 h-screen md:h-screen flex flex-col bg-background border-r border-slate-200 z-40 transition-transform duration-300 ease-in-out w-64 shrink-0 shadow-sm
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          mt-14 md:mt-0`}
      >
        <div className="hidden md:flex p-5 items-center gap-2 border-b border-slate-100 shrink-0">
          <AdminMainMenuButton />
          <img src={eilogofull} alt="Esthetic Insights" className="max-h-10 max-w-full object-contain mx-auto" />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Procurement</p>
          <ul className="space-y-1">
            {PROCUREMENT_SECTIONS.map((section) => {
              const active = mainTab === 'Procurement' && sideSection === section;
              return (
                <li key={section}>
                  <button
                    type="button"
                    onClick={() => handleSection(section)}
                    className={sectionButtonClass(active)}
                  >
                    <span>{section}</span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 tabular-nums shrink-0 ${
                        active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {sideCounts[section] ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <p className="text-xs text-slate-400 text-center">© 2025 Esthetic Insights</p>
        </div>
      </aside>
    </>
  );
}
