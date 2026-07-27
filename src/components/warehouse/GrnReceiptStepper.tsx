/**
 * Progress header for the GRN inbound flow. Shows all 7 steps for context; only the
 * "Confirm Receipt" step is interactive today (the rest of the flow lives further down
 * the same modal / in later screens), so steps are display-only markers.
 */

import React from 'react';
import { Check } from 'lucide-react';

export const GRN_FLOW_STEPS = [
  'Confirm Receipt',
  'Confirm Details',
  'Batch Details',
  'Packaging List',
  'Generate Labels',
  'Quarantine → QC',
  'Complete GRN',
] as const;

export interface GrnReceiptStepperProps {
  /** 1-based index of the active step. */
  currentStep: number;
}

export const GrnReceiptStepper: React.FC<GrnReceiptStepperProps> = ({ currentStep }) => {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="GRN steps">
      {GRN_FLOW_STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                done
                  ? 'bg-emerald-600 text-white'
                  : active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400',
              ].join(' ')}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : step}
            </span>
            <span
              className={[
                'text-xs whitespace-nowrap',
                active ? 'font-semibold text-slate-900' : done ? 'text-slate-600' : 'text-slate-400',
              ].join(' ')}
            >
              {label}
            </span>
            {step < GRN_FLOW_STEPS.length ? (
              <span className="mx-0.5 hidden h-px w-4 bg-slate-200 sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};
