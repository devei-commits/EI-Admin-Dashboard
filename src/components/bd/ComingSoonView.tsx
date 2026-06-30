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
  <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
      <Icon size={26} className="text-slate-400" />
    </div>
    <h3 className="mt-3 text-lg font-bold text-slate-800">{title}</h3>
    <span className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
      Arriving in {phase}
    </span>
    <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-slate-500">
      {bullets.map((b) => (
        <li key={b} className="flex items-start gap-2">
          <span className="mt-1 text-slate-300">•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);
