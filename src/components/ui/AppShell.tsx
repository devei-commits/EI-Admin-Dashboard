import { useState, type ReactNode } from 'react';
import GlobalRail from './GlobalRail';

/**
 * AppShell — the single frame for every authenticated route.
 *
 * Left: persistent GlobalRail (thin icon rail on md+, drawer on mobile).
 * Right: route content. Standalone modules render their own NavSidebar as a
 * section panel inside `children`, giving the "rail + panel + content" model.
 * A floating hamburger opens the rail drawer on mobile.
 */
const AppShell = ({ children }: { children: ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-row min-h-screen min-w-0 bg-canvas">
      <GlobalRail mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Floating menu button — mobile only, opens the rail drawer */}
      <button
        type="button"
        className="md:hidden fixed top-3 left-4 z-[90] p-2.5 rounded-lg border border-border bg-surface shadow-[var(--e1)] hover:bg-surface-3 transition-colors text-ink"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-w-0 flex-1 flex flex-col">{children}</div>
    </div>
  );
};

export default AppShell;
