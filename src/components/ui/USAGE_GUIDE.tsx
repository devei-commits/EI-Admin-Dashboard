/**
 * UNIFIED UI COMPONENT SYSTEM - USAGE GUIDE
 * 
 * This system provides a single source of truth for all UI styling across the admin panel.
 * All colors, buttons, badges, tables, and other components should use these unified utilities.
 */

import {
  UnifiedButton,
  UnifiedBadge,
  UnifiedCard,
  UnifiedModal,
  UnifiedTableHeaderCell,
  UnifiedTableCell,
  UnifiedInput,
  UnifiedSelect,
  UnifiedLabel,
} from './UnifiedComponents';
import {
  getStatusBadgeColor,
  getRoleLevelBadgeColor,
  getPermissionBadgeColor,
} from './theme';

/**
 * IMPORT PATTERN
 * ===============
 * import {
 *   UnifiedButton,
 *   UnifiedBadge,
 *   getStatusBadgeColor,
 *   getRoleLevelBadgeColor,
 * } from '@/components/ui';
 */

/**
 * BUTTON USAGE EXAMPLES
 * =====================
 */
export const ButtonExamples = () => {
  return (
    <div className="space-y-4">
      {/* Primary Button (Amber) - Use for main actions */}
      <UnifiedButton variant="primary">Create New Item</UnifiedButton>

      {/* Secondary Button (Gray) - Use for secondary actions */}
      <UnifiedButton variant="secondary">Edit</UnifiedButton>

      {/* Ghost Button (Transparent) - Use for tertiary actions */}
      <UnifiedButton variant="ghost">Cancel</UnifiedButton>

      {/* Danger Button (Red) - Use for destructive actions */}
      <UnifiedButton variant="danger">Delete</UnifiedButton>

      {/* Button Sizes */}
      <UnifiedButton variant="primary" size="sm">Small</UnifiedButton>
      <UnifiedButton variant="primary" size="md">Medium (Default)</UnifiedButton>
      <UnifiedButton variant="primary" size="lg">Large</UnifiedButton>

      {/* Button with Icon */}
      <UnifiedButton variant="primary" icon={<span>📁</span>}>
        Upload File
      </UnifiedButton>

      {/* Loading State */}
      <UnifiedButton variant="primary" isLoading>
        Saving...
      </UnifiedButton>
    </div>
  );
};

/**
 * BADGE USAGE EXAMPLES
 * ====================
 */
export const BadgeExamples = () => {
  return (
    <div className="space-y-4">
      {/* Status Badges - Use getStatusBadgeColor() function */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Status Badges:</p>
        <UnifiedBadge variant="success">Active</UnifiedBadge>
        <UnifiedBadge variant="warning">Pending</UnifiedBadge>
        <UnifiedBadge variant="error">Rejected</UnifiedBadge>
        <UnifiedBadge variant="info">Processing</UnifiedBadge>
      </div>

      {/* Custom Status Color Function */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Dynamic Status:</p>
        <span className={getStatusBadgeColor('active')}>Active Status</span>
        <span className={getStatusBadgeColor('pending')}>Pending Status</span>
      </div>

      {/* Role Level Badges */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Role Levels:</p>
        <span className={getRoleLevelBadgeColor('admin')}>Admin</span>
        <span className={getRoleLevelBadgeColor('manager')}>Manager</span>
        <span className={getRoleLevelBadgeColor('staff')}>Staff</span>
      </div>
    </div>
  );
};

/**
 * CARD USAGE EXAMPLES
 * ===================
 */
export const CardExamples = () => {
  return (
    <div className="space-y-4">
      {/* Default Card */}
      <UnifiedCard>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Default Card</h3>
        <p className="text-gray-600">Card content goes here with shadow-sm and border</p>
      </UnifiedCard>

      {/* Elevated Card (with hover effect) */}
      <UnifiedCard variant="elevated">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Elevated Card</h3>
        <p className="text-gray-600">This card has shadow-md and hover effects</p>
      </UnifiedCard>

      {/* Outlined Card */}
      <UnifiedCard variant="outlined">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Outlined Card</h3>
        <p className="text-gray-600">This card has border-2 for more emphasis</p>
      </UnifiedCard>
    </div>
  );
};

/**
 * TABLE USAGE EXAMPLES
 * ====================
 */
export const TableExample = () => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <UnifiedTableHeaderCell>Name</UnifiedTableHeaderCell>
            <UnifiedTableHeaderCell>Email</UnifiedTableHeaderCell>
            <UnifiedTableHeaderCell>Status</UnifiedTableHeaderCell>
            <UnifiedTableHeaderCell>Actions</UnifiedTableHeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr className="hover:bg-gray-50/50 transition-colors">
            <UnifiedTableCell>John Doe</UnifiedTableCell>
            <UnifiedTableCell>john@example.com</UnifiedTableCell>
            <UnifiedTableCell>
              <span className={getStatusBadgeColor('active')}>Active</span>
            </UnifiedTableCell>
            <UnifiedTableCell>
              <UnifiedButton variant="secondary" size="sm">Edit</UnifiedButton>
            </UnifiedTableCell>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/**
 * INPUT USAGE EXAMPLES
 * ====================
 */
export const InputExample = () => {
  return (
    <div className="space-y-4">
      {/* Standard Input */}
      <UnifiedInput
        label="First Name"
        type="text"
        placeholder="Enter first name"
      />

      {/* Input with Error */}
      <UnifiedInput
        label="Email"
        type="email"
        placeholder="Enter email"
        error="Invalid email address"
      />

      {/* Select Dropdown */}
      <UnifiedSelect
        label="Department"
        options={[
          { value: 'bd', label: 'BD' },
          { value: 'qa', label: 'QA' },
          { value: 'rd', label: 'R&D' },
        ]}
      />
    </div>
  );
};

/**
 * COLOR SYSTEM
 * ============
 * 
 * Primary Brand Color: Amber
 * - Primary action buttons: bg-amber-500 hover:bg-amber-600
 * - Active states: Use amber
 * 
 * Status Colors (Consistent across app):
 * - Success: Emerald (bg-emerald-50, text-emerald-700)
 * - Warning: Amber (bg-amber-50, text-amber-700)
 * - Error: Red (bg-red-50, text-red-700)
 * - Info: Blue (bg-blue-50, text-blue-700)
 * 
 * Role Level Colors (Consistent mapping):
 * - Admin: Violet (bg-violet-50, text-violet-700)
 * - Manager: Amber (bg-amber-50, text-amber-700)
 * - Staff: Sky (bg-sky-50, text-sky-700)
 * - Client: Gray (bg-gray-50, text-gray-600)
 * 
 * Neutral Colors: Gray scale for all other elements
 * - Borders: border-gray-100, border-gray-200
 * - Text: text-gray-600, text-gray-700, text-gray-800
 * - Backgrounds: bg-gray-50, bg-gray-100
 */

/**
 * SPACING CONSISTENCY
 * ===================
 * 
 * Use these spacing patterns:
 * - Tables: py-4 px-5 (headers), py-4 px-5 (cells)
 * - Buttons: px-6 py-3 (medium), px-4 py-2 (small), px-8 py-4 (large)
 * - Form Inputs: px-5 py-3 with mb-3 for labels
 * - Cards: p-6
 * - Modals: p-6 for header/footer, p-6 for body
 * - Gaps: gap-5 or gap-6 for grid/flex layouts
 */

/**
 * TYPOGRAPHY CONSISTENCY
 * ======================
 * 
 * Headings:
 * - Page Title: text-2xl font-semibold tracking-tight
 * - Section Title: text-lg font-semibold uppercase tracking-wider
 * - Subsection: text-md font-semibold uppercase tracking-wider
 * 
 * Labels:
 * - Form Label: text-sm font-semibold uppercase tracking-wide
 * - Table Header: text-sm font-semibold uppercase tracking-wider
 * 
 * Body Text:
 * - Default: text-gray-700 leading-relaxed
 * - Secondary: text-gray-600
 * - Table Cell: text-gray-700 leading-relaxed
 * 
 * Letter Spacing:
 * - tracking-tight: For headings (0.5px)
 * - tracking-wide: For labels and regular text (0.4px)
 * - tracking-wider: For all caps headers and badges (0.6px)
 */

/**
 * MIGRATION CHECKLIST
 * ====================
 * 
 * When updating a component to use unified system:
 * 
 * [ ] Replace all custom button styles with <UnifiedButton>
 * [ ] Replace all custom badge styles with <UnifiedBadge> or getStatusBadgeColor()
 * [ ] Replace all custom card divs with <UnifiedCard>
 * [ ] Replace all table elements with <UnifiedTableHeaderCell> and <UnifiedTableCell>
 * [ ] Replace all form inputs with <UnifiedInput>
 * [ ] Replace all select dropdowns with <UnifiedSelect>
 * [ ] Use getStatusBadgeColor() for all status displays
 * [ ] Use getRoleLevelBadgeColor() for all role displays
 * [ ] Update color variables to use theme.ts exports
 * [ ] Test responsiveness on mobile, tablet, desktop
 * [ ] Verify consistent spacing throughout
 * [ ] Check typography hierarchy
 */

export default {};
