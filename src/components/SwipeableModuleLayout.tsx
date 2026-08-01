import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdminSidebarProvider, useAdminSidebar } from '../context/AdminSidebarContext';
import Sidebar from './Sidebar';

/**
 * Responsive off-canvas navigation drawer for standalone module pages.
 *
 * - The full menu lives in a single off-canvas drawer (reuses <Sidebar variant="drawer" />).
 * - One hamburger control toggles it (no duplicate menu bars).
 * - Touch swipe gestures: swipe right from the left edge to open; swipe left to close.
 *   The panel follows the finger live and snaps open/closed on release by distance/velocity.
 */

const DRAWER_WIDTH = 256;     // matches Sidebar drawer `w-64`
const EDGE_ZONE = 28;         // px from the left edge where an "open" swipe may begin
const COMMIT_THRESHOLD = 8;   // px of travel before a gesture is claimed
const OPEN_RATIO = 0.4;       // fraction of width past which we snap open/closed on release
const VELOCITY_TRIGGER = 0.5; // px/ms fling velocity that forces open/close regardless of distance

function FixedMenuButton() {
  const sidebar = useAdminSidebar();
  if (!sidebar) return null;
  const { open, toggle } = sidebar;
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

function DrawerWithSwipe() {
  const sidebar = useAdminSidebar();
  const [dragPx, setDragPx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const setDrag = (v: number | null) => { dragRef.current = v; setDragPx(v); };

  const open = sidebar?.open ?? false;
  const setOpen = sidebar?.setOpen;

  // Track the in-flight gesture without re-subscribing listeners on every frame.
  const g = useRef({
    active: false,
    committed: false,
    mode: null as 'open' | 'close' | null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
  });

  useEffect(() => {
    if (!setOpen) return;

    const onStart = (e: TouchEvent) => {
      if (dragRef.current != null) return;
      const t = e.touches[0];
      if (!t) return;
      if (!open && t.clientX <= EDGE_ZONE) {
        g.current = { active: true, committed: false, mode: 'open', startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastT: e.timeStamp, vx: 0 };
      } else if (open) {
        g.current = { active: true, committed: false, mode: 'close', startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastT: e.timeStamp, vx: 0 };
      } else {
        g.current.active = false;
      }
    };

    const onMove = (e: TouchEvent) => {
      const st = g.current;
      if (!st.active) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - st.startX;
      const dy = t.clientY - st.startY;

      if (!st.committed) {
        if (Math.abs(dx) < COMMIT_THRESHOLD && Math.abs(dy) < COMMIT_THRESHOLD) return;
        if (Math.abs(dy) > Math.abs(dx)) { st.active = false; return; } // vertical scroll — let it go
        st.committed = true;
      }

      const dt = e.timeStamp - st.lastT;
      if (dt > 0) st.vx = (t.clientX - st.lastX) / dt;
      st.lastX = t.clientX;
      st.lastT = e.timeStamp;

      const base = st.mode === 'open' ? -DRAWER_WIDTH : 0;
      const px = Math.max(-DRAWER_WIDTH, Math.min(0, base + dx));
      setDrag(px);
      if (e.cancelable) e.preventDefault(); // claim the horizontal drag, stop page scroll
    };

    const onEnd = () => {
      const st = g.current;
      if (st.active && st.committed) {
        const current = dragRef.current ?? (st.mode === 'open' ? -DRAWER_WIDTH : 0);
        const progress = (current + DRAWER_WIDTH) / DRAWER_WIDTH; // 0 = closed, 1 = open
        let next: boolean;
        if (st.vx > VELOCITY_TRIGGER) next = true;
        else if (st.vx < -VELOCITY_TRIGGER) next = false;
        else next = progress >= OPEN_RATIO;
        setOpen(next);
      }
      g.current.active = false;
      g.current.committed = false;
      g.current.mode = null;
      setDrag(null);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [open, setOpen]);

  return (
    <>
      {/* Left-edge swipe affordance (touch hint), only when the drawer is closed */}
      {!open && dragPx == null && (
        <div className="md:hidden fixed top-0 left-0 h-screen w-1.5 z-[80] pointer-events-none bg-gradient-to-r from-black/10 to-transparent" aria-hidden />
      )}
      <Sidebar variant="drawer" open={open} onOpenChange={setOpen} dragPx={dragPx} />
    </>
  );
}

/** Wraps a standalone module route with a swipeable off-canvas main-menu drawer. */
const SwipeableModuleLayout = ({ children }: { children: ReactNode }) => {
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
      <DrawerWithSwipe />
      <FixedMenuButton />
      {children}
    </AdminSidebarProvider>
  );
};

export default SwipeableModuleLayout;
