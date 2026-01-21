/**
 * Unified Theme System for Eisthetic Admin Panel
 * Single source of truth for all colors and UI styling
 */

// Primary Color Palette - Amber/Orange Theme
export const COLORS = {
  // Primary Brand Colors
  primary: {
    50: 'bg-amber-50',
    100: 'bg-amber-100',
    500: 'bg-amber-500',
    600: 'bg-amber-600',
    700: 'bg-amber-700',
  },
  primaryText: {
    50: 'text-amber-50',
    100: 'text-amber-100',
    500: 'text-amber-500',
    600: 'text-amber-600',
    700: 'text-amber-700',
  },
  primaryBorder: {
    100: 'border-amber-100',
    500: 'border-amber-500',
  },

  // Status Colors
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-100',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    badge: 'bg-amber-100 text-amber-700 border border-amber-100',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-100',
    badge: 'bg-red-100 text-red-700 border border-red-100',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-100',
    badge: 'bg-blue-100 text-blue-700 border border-blue-100',
  },

  // Role Level Colors
  admin: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-100',
    badge: 'bg-violet-50 text-violet-700 border border-violet-100',
  },
  manager: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    badge: 'bg-amber-50 text-amber-700 border border-amber-100',
  },
  staff: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-100',
    badge: 'bg-sky-50 text-sky-700 border border-sky-100',
  },
  client: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    badge: 'bg-gray-50 text-gray-600 border border-gray-200',
  },

  // Neutral Colors
  gray: {
    50: 'bg-gray-50',
    100: 'bg-gray-100',
    200: 'bg-gray-200',
    300: 'bg-gray-300',
    400: 'bg-gray-400',
    600: 'bg-gray-600',
  },
  grayText: {
    400: 'text-gray-400',
    500: 'text-gray-500',
    600: 'text-gray-600',
    700: 'text-gray-700',
    800: 'text-gray-800',
  },
  grayBorder: {
    100: 'border-gray-100',
    200: 'border-gray-200',
  },
};

// Spacing Constants
export const SPACING = {
  xs: 'px-3 py-1.5',
  sm: 'px-4 py-2',
  md: 'px-5 py-3',
  lg: 'px-6 py-3',
  xl: 'px-7 py-4',
};

// Typography Constants
export const TYPOGRAPHY = {
  uppercase: 'uppercase',
  tracking: {
    tight: 'tracking-tight',
    wide: 'tracking-wide',
    wider: 'tracking-wider',
    widest: 'tracking-widest',
  },
  leading: {
    relaxed: 'leading-relaxed',
    normal: 'leading-normal',
  },
  fontWeight: {
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  },
};

// Button Variants
export const BUTTON_VARIANTS = {
  primary: 'px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all font-semibold tracking-wider',
  secondary: 'px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all font-medium tracking-wide',
  ghost: 'px-6 py-3 bg-transparent text-gray-700 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all font-medium',
  danger: 'px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all font-medium tracking-wide',
};

// Badge Variants
export const BADGE_VARIANTS = {
  primary: 'px-3 py-1.5 bg-amber-500 text-white rounded-full text-xs font-semibold uppercase tracking-wider',
  success: 'px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100 uppercase tracking-wider',
  warning: 'px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold border border-amber-100 uppercase tracking-wider',
  error: 'px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-100 uppercase tracking-wider',
  info: 'px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold border border-blue-100 uppercase tracking-wider',
  outline: 'px-3 py-1.5 bg-transparent border border-gray-200 text-gray-700 rounded-full text-xs font-semibold uppercase tracking-wider',
};

// Card Variants
export const CARD_VARIANTS = {
  default: 'bg-white rounded-lg shadow-sm border border-gray-100 p-6',
  elevated: 'bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow',
  outlined: 'bg-white rounded-lg border-2 border-gray-200 p-6',
};

// Table Variants
export const TABLE_VARIANTS = {
  header: 'py-4 px-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed border-b-2 border-gray-200',
  cell: 'py-4 px-5 text-gray-700 leading-relaxed border-b border-gray-100',
  cellDivider: 'divide-y divide-gray-100',
};

// Modal Variants
export const MODAL_VARIANTS = {
  backdrop: 'fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4',
  content: 'bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto',
  header: 'flex justify-between items-center p-6 border-b-2 border-gray-200',
  body: 'p-6 space-y-8',
  footer: 'p-6 border-t-2 border-gray-200 flex justify-end',
};

// Input Variants
export const INPUT_VARIANTS = {
  default: 'w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all leading-normal tracking-wide',
  error: 'w-full px-5 py-3 border-2 border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-red-50 transition-all',
};

// Selector/Status Color Functions
export const getStatusBadgeColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    // Active/Inactive
    'active': COLORS.success.badge,
    'inactive': COLORS.gray[100] + ' text-gray-600 border border-gray-200',
    'deactive': COLORS.gray[100] + ' text-gray-600 border border-gray-200',
    
    // Suspended/On Hold
    'suspended': COLORS.warning.badge,
    'on_hold': COLORS.warning.badge,
    
    // Processing
    'pending': COLORS.info.badge,
    'processing': COLORS.info.badge,
    'in_progress': COLORS.info.badge,
    
    // Completion
    'completed': COLORS.success.badge,
    'approved': COLORS.success.badge,
    'shipped': COLORS.success.badge,
    
    // Error
    'rejected': COLORS.error.badge,
    'failed': COLORS.error.badge,
    'terminated': COLORS.error.badge,
  };
  
  return statusMap[status.toLowerCase()] || COLORS.gray[100] + ' text-gray-600 border border-gray-200';
};

export const getRoleLevelBadgeColor = (level: string): string => {
  const levelMap: Record<string, string> = {
    'admin': COLORS.admin.badge,
    'manager': COLORS.manager.badge,
    'staff': COLORS.staff.badge,
    'client': COLORS.client.badge,
  };
  
  return levelMap[level.toLowerCase()] || COLORS.client.badge;
};

export const getPermissionBadgeColor = (hasPermission: boolean): string => {
  return hasPermission 
    ? 'w-5 h-5 bg-green-500 rounded-full shadow-sm' 
    : 'w-5 h-5 bg-gray-300 rounded-full shadow-sm';
};
