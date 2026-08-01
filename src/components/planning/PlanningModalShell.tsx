import React from 'react';
import { ModalOverlay } from '../ui/ModalOverlay';

/**
 * PlanningModalShell — thin wrapper over the shared `ModalOverlay` (kept for the
 * existing Planning call sites). The caller supplies its own card as children
 * with `role="dialog"` on it.
 */
export interface PlanningModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  z?: string;
  align?: 'center' | 'end-mobile';
  scroll?: boolean;
  dismissable?: boolean;
  overlayRef?: React.Ref<HTMLDivElement>;
}

export function PlanningModalShell(props: PlanningModalShellProps): React.ReactElement {
  return <ModalOverlay {...props} />;
}
