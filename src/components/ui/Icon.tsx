import React from 'react';
import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps, IconWeight } from '@phosphor-icons/react';

export type { IconWeight };

export interface IconProps extends Omit<PhosphorIconProps, 'ref'> {
 /** A Phosphor icon component, e.g. `import { House } from '@phosphor-icons/react'`. */
 icon: PhosphorIcon;
 /** px size — default 18 for a dense operations UI. */
 size?: number | string;
 /** Stroke weight — default 'regular'; use 'bold'/'fill' for active/emphasis. */
 weight?: IconWeight;
}

/**
 * Thin, consistent wrapper around Phosphor icons (design language: Phosphor only, zero emoji).
 * Standardizes default size + weight and gives one place to tune icon rendering app-wide.
 * Renders in `currentColor`, so it inherits `text-ink*` / `text-brand` from the parent.
 *
 *   import { House } from '@phosphor-icons/react';
 *   <Icon icon={House} />
 *   <Icon icon={House} weight="fill" size={20} className="text-brand" />
 */
export const Icon: React.FC<IconProps> = ({ icon: Cmp, size = 18, weight = 'regular', ...rest }) => (
 <Cmp size={size} weight={weight} {...rest} />
);

export default Icon;
