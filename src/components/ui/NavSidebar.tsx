import React, { useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import eilogofull from '../../assets/logo/eilogofull.svg';
import AdminMainMenuButton from '../AdminMainMenuButton';

/**
 * NavSidebar — the single module-navigation sidebar. Replaces the ~8 near-identical
 * per-module sidebars (Procurement/Planning/Fulfillment/Warehouse/BD/Quality/…):
 * mobile header + hamburger, collapse toggle with localStorage persistence,
 * section buttons with active highlight + optional count badge, brand footer.
 *
 * Section keys are strings (works for every module's view union). Each module
 * passes its own sections, active key, navigate handler, and a unique
 * `collapseKey` for the persisted collapsed state.
 */
export interface NavSidebarSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export interface NavSidebarProps {
  sections: NavSidebarSection[];
  activeKey: string;
  onNavigate: (key: string) => void;
  /** localStorage key for the persisted collapsed state (unique per module). */
  collapseKey: string;
  /** Uppercase section-group label (e.g. "Procurement"). */
  title?: string;
  /** aria-label prefix for the mobile menu button. */
  moduleName?: string;
  /** Controlled mobile-drawer open state (for layouts whose own top bar drives it, e.g. Production). Omit for self-managed. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Hide NavSidebar's own mobile top bar (when the page already has a header with a menu button). */
  hideMobileHeader?: boolean;
}

function sectionButtonClass(active: boolean, collapsed: boolean): string {
  return `flex items-center gap-2.5 w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 text-sm border-l-4 ${
    collapsed ? 'md:justify-center md:px-0' : 'justify-between'
  } ${
    active
      ? 'bg-brand-soft text-brand font-semibold border-l-brand'
      : 'text-ink-2 hover:bg-surface-3 hover:text-ink border-l-transparent hover:border-l-brand-soft'
  }`;
}

export function NavSidebar({
  sections,
  activeKey,
  onNavigate,
  collapseKey,
  title = 'Menu',
  moduleName = 'module',
  mobileOpen,
  onMobileClose,
  hideMobileHeader = false,
}: NavSidebarProps): React.ReactElement {
  const controlled = mobileOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlled ? mobileOpen : internalOpen;
  const closeMobile = () => { if (controlled) onMobileClose?.(); else setInternalOpen(false); };
  const toggleMobile = () => { if (controlled) onMobileClose?.(); else setInternalOpen((o) => !o); };
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(collapseKey) === '1'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(collapseKey, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const handleSection = (key: string) => {
    onNavigate(key);
    closeMobile();
  };

  return (
    <>
      {!hideMobileHeader && (
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-hairline z-50 flex items-center px-4 shadow-[var(--e1)]">
          <AdminMainMenuButton />
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
            onClick={toggleMobile}
            aria-label={isOpen ? `Close ${moduleName} menu` : `Open ${moduleName} menu`}
          >
            <svg className="w-6 h-6 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
          <img src={eilogofull} alt="Esthetic Insights" className="h-8 ml-3 object-contain" />
        </div>
      )}

      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 mt-14" onClick={closeMobile} aria-hidden />
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
          <p className={`text-xs font-semibold text-ink-4 uppercase tracking-wider px-4 mb-2 ${collapsed ? 'md:hidden' : ''}`}>{title}</p>
          <ul className="space-y-1">
            {sections.map(({ key, label, icon, count }) => {
              const active = activeKey === key;
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
                      <span className="shrink-0 inline-flex">{icon}</span>
                      <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
                    </span>
                    {count != null && (
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 tabular-nums shrink-0 ${collapsed ? 'md:hidden' : ''} ${active ? 'bg-brand-soft text-brand' : 'bg-surface-3 text-ink-3'}`}>
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
            className={`hidden md:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors ${collapsed ? 'md:justify-center' : ''}`}
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
