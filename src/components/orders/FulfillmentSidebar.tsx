import React, { useState } from 'react';
import { ShoppingCart, Package, CaretLeft, CaretRight, type Icon } from '@phosphor-icons/react';
import eilogofull from '../../assets/logo/eilogofull.svg';
import AdminMainMenuButton from '../AdminMainMenuButton';

export type FulfillmentView = 'so-dashboard' | 'products-batches';

const SECTIONS: { key: FulfillmentView; label: string; icon: Icon }[] = [
  { key: 'so-dashboard', label: 'SO Dashboard', icon: ShoppingCart },
  { key: 'products-batches', label: 'Products & Batches', icon: Package },
];

const COLLAPSE_KEY = 'fulfillment-sidebar-collapsed';

export type FulfillmentSidebarProps = {
  activeView: FulfillmentView;
  onNavigate: (view: FulfillmentView) => void;
  counts?: Partial<Record<FulfillmentView, number>>;
};

function sectionButtonClass(active: boolean, collapsed: boolean): string {
  return `flex items-center gap-2.5 w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 text-sm border-l-4 ${
    collapsed ? 'md:justify-center md:px-0' : 'justify-between'
  } ${
    active
      ? 'bg-brand-soft text-brand font-semibold border-l-brand'
      : 'text-ink-2 hover:bg-surface-3 hover:text-ink border-l-transparent hover:border-l-brand-soft'
  }`;
}

export function FulfillmentSidebar({ activeView, onNavigate, counts }: FulfillmentSidebarProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const handleSection = (view: FulfillmentView) => {
    onNavigate(view);
    setIsOpen(false);
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-hairline z-50 flex items-center px-4 shadow-[var(--e1)]">
        <AdminMainMenuButton />
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close fulfillment menu' : 'Open fulfillment menu'}
        >
          <svg className="w-6 h-6 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 mt-14"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed md:sticky md:top-0 h-screen md:h-screen flex flex-col bg-surface border-r border-hairline z-40 transition-[width,transform] duration-300 ease-in-out w-64 shrink-0 shadow-[var(--e1)]
          ${collapsed ? 'md:w-16' : 'md:w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          mt-14 md:mt-0`}
      >
        <div className="hidden md:flex p-5 items-center gap-2 border-b border-hairline shrink-0 overflow-hidden">
          <AdminMainMenuButton />
          <img src={eilogofull} alt="Esthetic Insights" className={`max-h-10 max-w-full object-contain mx-auto ${collapsed ? 'md:hidden' : ''}`} />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
          <p className={`text-xs font-semibold text-ink-4 uppercase tracking-wider px-4 mb-2 ${collapsed ? 'md:hidden' : ''}`}>Fulfillment</p>
          <ul className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Ico }) => {
              const active = activeView === key;
              const count = counts?.[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => handleSection(key)}
                    className={sectionButtonClass(active, collapsed)}
                    title={collapsed ? label : undefined}
                    aria-label={label}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <Ico className="w-4 h-4 shrink-0" weight={active ? 'fill' : 'regular'} />
                      <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
                    </span>
                    {count != null && (
                      <span
                        className={`text-[10px] font-bold rounded-full px-2 py-0.5 tabular-nums shrink-0 ${collapsed ? 'md:hidden' : ''} ${
                          active ? 'bg-brand-soft text-brand' : 'bg-surface-3 text-ink-3'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-hairline bg-surface-2 shrink-0 space-y-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`hidden md:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors ${
              collapsed ? 'md:justify-center' : ''
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <CaretRight className="w-4 h-4 shrink-0" /> : <CaretLeft className="w-4 h-4 shrink-0" />}
            <span className={collapsed ? 'md:hidden' : ''}>Collapse</span>
          </button>
          <p className={`text-xs text-ink-4 text-center ${collapsed ? 'md:hidden' : ''}`}>© 2025 Esthetic Insights</p>
        </div>
      </aside>
    </>
  );
}
