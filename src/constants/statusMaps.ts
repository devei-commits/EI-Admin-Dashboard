export const BMR_STATUS_COLORS: Record<string, string> = {
  'Pending':        'bg-gray-100 text-gray-700 border border-gray-200',
  'Scheduled':      'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'In Production':  'bg-blue-100 text-blue-700 border border-blue-200',
  'QC Review':      'bg-orange-100 text-orange-700 border border-orange-200',
  'Completed':      'bg-green-100 text-green-700 border border-green-200',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  'Draft':          'bg-gray-100 text-gray-600',
  'Pending':        'bg-yellow-100 text-yellow-700',
  'Confirmed':      'bg-blue-100 text-blue-700',
  'In Progress':    'bg-indigo-100 text-indigo-700',
  'Completed':      'bg-green-100 text-green-700',
  'Cancelled':      'bg-red-100 text-red-700',
  'On Hold':        'bg-orange-100 text-orange-700',
};

export const GENERAL_STATUS_COLORS: Record<string, string> = {
  'Active':         'bg-green-100 text-green-700',
  'Inactive':       'bg-gray-100 text-gray-600',
  'Approved':       'bg-green-100 text-green-700',
  'Rejected':       'bg-red-100 text-red-700',
  'Under Review':   'bg-yellow-100 text-yellow-700',
  'Pass':           'bg-green-100 text-green-700',
  'Fail':           'bg-red-100 text-red-700',
};

export const ALL_STATUS_COLORS: Record<string, string> = {
  ...BMR_STATUS_COLORS,
  ...ORDER_STATUS_COLORS,
  ...GENERAL_STATUS_COLORS,
};
