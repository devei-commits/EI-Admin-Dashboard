/**
 * StatusBadge Component
 * Displays status badges for fulfillment and sale order statuses.
 * Thin wrapper over the shared ui/StatusBadge — folds the FF/SO icon+color config
 * onto it (colors via colorMap, mono/border chrome via className). Prop API unchanged.
 */

import React from 'react';
import { FF_STATUS_CONFIG, SO_STATUS_CONFIG } from '../../constants/orderFulfillment';
import type { StatusBadgeProps } from '../../types/orderFulfillment';
import { StatusBadge as UiStatusBadge } from '../ui/StatusBadge';

const ICON_SIZES = { sm: 8, md: 10, lg: 12 } as const;

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type,
  size = 'md',
}) => {
  // Shared badge exposes sm|md; map the legacy `lg` onto `md`.
  const uiSize = size === 'sm' ? 'sm' : 'md';
  const config = type === 'ff' ? FF_STATUS_CONFIG[status] : SO_STATUS_CONFIG[status];

  if (!config) {
    return (
      <UiStatusBadge
        status={status}
        colorMap={{ [status]: 'bg-surface-3 text-ink-3' }}
        size={uiSize}
        className="font-mono font-bold border border-border whitespace-nowrap"
      />
    );
  }

  const Icon = config.icon;

  return (
    <UiStatusBadge
      status={status}
      colorMap={{ [status]: `${config.color} ${config.bgColor} ${config.borderColor}` }}
      icon={<Icon size={ICON_SIZES[size]} className="shrink-0" />}
      label={config.label}
      size={uiSize}
      className="font-mono font-bold border whitespace-nowrap"
    />
  );
};
