import React, { useState } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

/**
 * NavSidebar — the single module-section panel. One row per subsection
 * (icon + name + optional count), sits to the right of the GlobalRail.
 *
 * - Expanded: full names (default). Collapse toggle in the footer.
 * - Collapsed: icon-only rail; hovering an icon reveals its name in a tooltip.
 * No logo (the GlobalRail already shows it) and no copyright line.
 *
 * Section keys are plain strings (each module's view union). Modules pass their
 * own sections, active key, navigate handler, and a unique `collapseKey`.
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

  const rowClass = (active: boolean) =>
    `group/nav relative flex items-center gap-3 w-full text-left rounded-xl text-sm transition-all duration-200 ${
      collapsed ? 'md:justify-center md:px-0 md:w-11 md:h-11 md:mx-auto px-3 py-2.5' : 'px-3 py-2.5'
    } ${
      active
        ? 'bg-brand-soft text-brand font-semibold shadow-[var(--e1)]'
        : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
    }`;

  return (
    <>
      {!hideMobileHeader && (
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-hairline z-50 flex items-center gap-2 px-4 shadow-[var(--e1)]">
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
          <span className="text-sm font-semibold text-ink truncate">{title}</span>
        </div>
      )}

      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 mt-14" onClick={closeMobile} aria-hidden />
      )}

      <aside
        className={`fixed md:sticky md:top-0 h-screen md:h-screen flex flex-col bg-surface border-r border-hairline z-40 transition-[width,transform] duration-300 ease-in-out w-64 shrink-0
          ${collapsed ? 'md:w-16' : 'md:w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          mt-14 md:mt-0`}
      >
        <nav className={`flex-1 pb-4 pt-8 md:pt-7 ${collapsed ? 'overflow-y-auto md:overflow-visible px-2' : 'overflow-y-auto overflow-x-hidden px-3'}`}>
          <p className={`text-base font-bold text-ink tracking-tight mb-4 ${collapsed ? 'md:hidden px-2' : 'px-2'}`}>{title}</p>
          <ul className="space-y-1">
            {sections.map(({ key, label, icon, count }) => {
              const active = activeKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => handleSection(key)}
                    className={rowClass(active)}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="shrink-0 inline-flex">{icon}</span>
                    <span className={`flex-1 min-w-0 text-left leading-snug ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
                    {count != null && (
                      <span className={`text-[11px] font-semibold rounded-full px-1.5 min-w-[20px] text-center tabular-nums shrink-0 ${collapsed ? 'md:hidden' : ''} ${active ? 'bg-brand text-white' : 'bg-surface-3 text-ink-3'}`}>
                        {count}
                      </span>
                    )}
                    {/* Collapsed: name tooltip on hover */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[70] hidden md:group-hover/nav:flex items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-surface shadow-[var(--e2)]">
                        {label}
                        {count != null && <span className="rounded-full bg-white/15 px-1.5 tabular-nums">{count}</span>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-hairline bg-surface-2 shrink-0">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`hidden md:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors ${collapsed ? 'md:justify-center' : ''}`}
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? <PanelLeft className="w-4 h-4 shrink-0" /> : <PanelLeftClose className="w-4 h-4 shrink-0" />}
            <span className={collapsed ? 'md:hidden' : ''}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}
