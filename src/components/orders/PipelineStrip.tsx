/**
 * PipelineStrip Component
 * Visual pipeline showing order stages with counts
 */

import React from 'react';
import type { PipelineStripProps } from '../../types/orderFulfillment';

export const PipelineStrip: React.FC<PipelineStripProps> = ({ stages, onStageClick }) => {
  return (
    <div className="flex items-center bg-surface-3 rounded-lg p-1 flex-wrap gap-1">
      {stages.map((stage) => {
        const hasCount = stage.count > 0;

        return (
          <button
            key={stage.key}
            onClick={() => onStageClick(stage.key)}
            className={`
              px-3 py-1.5 text-xs font-semibold flex items-center gap-2 rounded-md transition-all
              whitespace-nowrap
              ${hasCount
                ? 'text-ink-2 hover:bg-white/60'
                : 'text-ink-4'
              }
            `}
            title={`${stage.count || 0} SOs`}
          >
            <span>{stage.label}</span>
            {hasCount && (
              <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-surface-3 text-ink-3">
                {stage.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
