/**
 * Placeholder for BD tabs delivered in later phases (Queries/Grievances/Meetings
 * → Phase 2; Analytics → Phase 3). Keeps the 5-tab nav fully navigable now.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ComingSoonViewProps {
  title: string;
  phase: string;
  icon: LucideIcon;
  bullets: string[];
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({ title, phase, icon: Icon, bullets }) => (
  <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 ring-1 ring-border">
      <Icon size={26} className="text-ink-4" />
    </div>
    <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>
    <span className="mt-2 inline-block rounded-full bg-warn-soft px-3 py-1 text-[11px] font-semibold text-warn ring-1 ring-amber-200">
      Arriving in {phase}
    </span>
    <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-ink-3">
      {bullets.map((b) => (
        <li key={b} className="flex items-start gap-2">
          <span className="mt-1 text-ink-4">•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);
