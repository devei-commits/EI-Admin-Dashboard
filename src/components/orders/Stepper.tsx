/**
 * Stepper Component
 * Displays a vertical stepper for tracking shipment progress
 */

import React from 'react';
import { Check } from 'lucide-react';
import type { StepperProps } from '../../types/orderFulfillment';

export const Stepper: React.FC<StepperProps> = ({ steps }) => {
  const firstActiveOrPendingIndex = steps.findIndex(e => e.status !== 'done');

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isDone = step.status === 'done';
        const isActive = step.status === 'active';
        const isPending = step.status === 'pending';

        return (
          <div key={index} className="flex gap-3 pb-3.5 relative">
            {/* Connecting line */}
            {!isLast && (
              <div className="absolute left-3.75 top-7.75 w-0.5 bottom-0 bg-gray-200" />
            )}

            {/* Step dot */}
            <div 
              className={`
                w-7.5 h-7.5 rounded-full flex items-center justify-center
                text-xs shrink-0 border-2 transition-all
                ${isDone 
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600' 
                  : isActive 
                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-600 animate-pulse' 
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }
              `}
            >
              {isDone ? <Check size={12} className="font-bold" /> : null}
            </div>

            {/* Step content */}
            <div className="flex-1 pt-1">
              <div 
                className={`
                  font-bold text-[12.5px] mb-0.5
                  ${isDone 
                    ? 'text-emerald-600' 
                    : isActive 
                      ? 'text-orange-600' 
                      : 'text-gray-500'
                  }
                `}
              >
                {step.label}
              </div>
              <div className="text-[10.5px] text-gray-600">
                {step.timestamp || step.details || ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
