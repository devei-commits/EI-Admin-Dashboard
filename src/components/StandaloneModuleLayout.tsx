import { useMemo, useState, type ReactNode } from 'react';
import { AdminSidebarProvider, useAdminSidebar } from '../context/AdminSidebarContext';
import Sidebar from './Sidebar';

function AdminSidebarDrawer() {
  const adminSidebar = useAdminSidebar();
  if (!adminSidebar) return null;

  return (
    <Sidebar
      variant="drawer"
      open={adminSidebar.open}
      onOpenChange={adminSidebar.setOpen}
    />
  );
}

/** Fixed top-left control — always mounted with the provider so it cannot render empty. */
function FixedMainMenuButton() {
  const adminSidebar = useAdminSidebar();
  if (!adminSidebar) return null;

  const { open, toggle } = adminSidebar;

  return (
    <button
      type="button"
      className="fixed top-3 left-4 z-[200] p-2.5 rounded-lg border border-border bg-surface shadow-[var(--e1)] hover:bg-surface-3 transition-colors text-ink"
      onClick={toggle}
      aria-label={open ? 'Close main menu' : 'Open main menu'}
      aria-expanded={open}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        {open ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );
}

/** Wraps standalone module routes (procurement, warehouse, etc.) with the main admin sidebar drawer. */
const StandaloneModuleLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((prev) => !prev),
      close: () => setOpen(false),
    }),
    [open]
  );

  return (
    <AdminSidebarProvider value={value}>
      <AdminSidebarDrawer />
      <FixedMainMenuButton />
      {children}
    </AdminSidebarProvider>
  );
};

export default StandaloneModuleLayout;
