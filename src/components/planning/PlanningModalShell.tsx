import React, { useEffect } from 'react';

/**
 * PlanningModalShell — one consistent overlay for every Planning modal.
 * Provides the standardized backdrop, z-index, centering, Escape-to-close and
 * backdrop-click-to-close. The caller supplies its own card as `children`
 * (kept intact) and puts `role="dialog" aria-modal="true"` on that card, so the
 * dialog node stays the real, sized element (good a11y + layout).
 *
 * `dismissable={false}` for form modals so an accidental Escape / backdrop
 * click can't discard in-progress input.
 */
export interface PlanningModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind z-index utility. Nested modals pass a higher one. */
  z?: string;
  /** Vertical alignment of the card. */
  align?: 'center' | 'end-mobile';
  /** Allow the overlay itself to scroll (tall modals). */
  scroll?: boolean;
  /** When false, Escape and backdrop-click do NOT close (use for forms). */
  dismissable?: boolean;
  /** Attach a ref to the scrolling overlay (e.g. for scroll-to-top on tab change). */
  overlayRef?: React.Ref<HTMLDivElement>;
}

export function PlanningModalShell({
  onClose,
  children,
  z = 'z-[100]',
  align = 'center',
  scroll = false,
  dismissable = true,
  overlayRef,
}: PlanningModalShellProps): React.ReactElement {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  const items = align === 'end-mobile' ? 'items-end sm:items-center' : 'items-center';

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 ${z} bg-black/40 backdrop-blur-[1px] flex ${items} justify-center p-4 ${scroll ? 'overflow-y-auto' : ''}`}
      role="presentation"
      onClick={dismissable ? onClose : undefined}
    >
      {children}
    </div>
  );
}
