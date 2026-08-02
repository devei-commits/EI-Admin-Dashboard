import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * ModalOverlay — the single source of truth for modal *chrome*: backdrop,
 * centering, z-index, Escape-to-close, backdrop-click-to-close, focus-trap +
 * focus-restore, body-scroll-lock, and dialog a11y. Every modal shell in the
 * app (ProcModalShell, PrPopupShell, PlanningModalShell, orders/Modal,
 * UnifiedModal) composes this instead of re-implementing the overlay.
 *
 * The caller supplies its own card as `children` and puts
 * `role="dialog" aria-modal="true"` + `onClick={e=>e.stopPropagation()}` on it
 * (so the card stays the real, sized dialog node — good a11y + layout).
 *
 * `dismissable={false}` for form modals so a stray Escape / backdrop click
 * can't discard in-progress input.
 */
export interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  /** z-index utility; nested modals pass a higher one. Default z-[100]. */
  z?: string;
  align?: 'center' | 'start' | 'end-mobile';
  /** Let the overlay itself scroll (tall modals). */
  scroll?: boolean;
  /** When false, Escape + backdrop-click do NOT close. */
  dismissable?: boolean;
  /** Backdrop treatment. */
  backdrop?: 'default' | 'strong' | 'light';
  /** Lock <body> scroll while open. Default true. */
  lockScroll?: boolean;
  /** Ref to the scrolling overlay (e.g. scroll-to-top on tab change). */
  overlayRef?: React.Ref<HTMLDivElement>;
  /** Extra classes for the overlay (e.g. padding overrides). */
  className?: string;
}

const BACKDROP: Record<NonNullable<ModalOverlayProps['backdrop']>, string> = {
  default: 'bg-black/40 backdrop-blur-[1px]',
  strong: 'bg-black/50 backdrop-blur-sm',
  light: 'bg-surface/60 backdrop-blur-md',
};

export function ModalOverlay({
  onClose,
  children,
  z = 'z-[100]',
  align = 'center',
  scroll = false,
  dismissable = true,
  backdrop = 'default',
  lockScroll = true,
  overlayRef,
  className = '',
}: ModalOverlayProps): React.ReactElement {
  const internalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, internalRef);

  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [lockScroll]);

  const setRef = (node: HTMLDivElement | null) => {
    internalRef.current = node;
    if (typeof overlayRef === 'function') overlayRef(node);
    else if (overlayRef) (overlayRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  const items = align === 'end-mobile' ? 'items-end sm:items-center' : align === 'start' ? 'items-start' : 'items-center';

  return (
    <div
      ref={setRef}
      className={`fixed inset-0 ${z} ${BACKDROP[backdrop]} flex ${items} justify-center p-4 ${scroll ? 'overflow-y-auto' : ''} ${className}`}
      role="presentation"
      onClick={dismissable ? onClose : undefined}
    >
      {children}
    </div>
  );
}
