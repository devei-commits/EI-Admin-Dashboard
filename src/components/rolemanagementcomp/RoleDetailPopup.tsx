import React from 'react';
import RolePermissionsDisplay from './RolePermissionsDisplay';
import { UnifiedBadge, UnifiedButton, getStatusBadgeColor, getRoleLevelBadgeColor } from '../ui';
import { ModalOverlay } from '../ui/ModalOverlay';

interface Role {
 id: string;
 roleName: string;
 roleLevel: string;
 roleStatus: 'active' | 'inactive';
 roleCreatedAt: string;
 roleUpdatedAt: string;
 description: string;
}

interface RoleDetailPopupProps {
 role: Role;
 onClose: () => void;
}

const RoleDetailPopup: React.FC<RoleDetailPopupProps> = ({ role, onClose }) => {
 return (
  <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="light">
   <div
    className="bg-surface rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto"
    role="dialog"
    aria-modal="true"
    aria-labelledby="role-detail-popup-title"
    onClick={(e) => e.stopPropagation()}
   >
    <div className="flex justify-between items-center p-6 border-b-2 border-border">
     <h3 id="role-detail-popup-title" className="text-2xl font-semibold text-ink tracking-tight">Role Details</h3>
     <button
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-4 hover:text-ink-2 hover:bg-surface-3 transition-colors"
      aria-label="Close"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    <div className="p-6 space-y-8">
     {/* Basic Role Information */}
     <div>
      <h4 className="text-lg font-semibold text-ink mb-5 uppercase tracking-wider">Basic Information</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-surface-2 p-6 rounded-lg border border-border">
       <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest letter-spacing">Role Name</p>
        <p className="text-ink font-medium leading-relaxed">{role.roleName}</p>
       </div>
       <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Role Level</p>
        <UnifiedBadge variant={getRoleLevelBadgeColor(role.roleLevel)}>
         {role.roleLevel}
        </UnifiedBadge>
       </div>
       <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Status</p>
        <UnifiedBadge variant={getStatusBadgeColor(role.roleStatus)}>
         {role.roleStatus}
        </UnifiedBadge>
       </div>
       <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Role ID</p>
        <p className="text-ink-2 text-sm font-mono leading-relaxed">{role.id}</p>
       </div>
       <div className="space-y-2 sm:col-span-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Description</p>
        <p className="text-ink-2 leading-relaxed tracking-wide">{role.description || 'No description available'}</p>
       </div>
       <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Created At</p>
        <p className="text-ink-2 text-sm leading-relaxed">{role.roleCreatedAt}</p>
       </div>
       <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Updated At</p>
        <p className="text-ink-2 text-sm leading-relaxed">{role.roleUpdatedAt}</p>
       </div>
      </div>
     </div>

     {/* Role Permissions */}
     <div>
      <h4 className="text-lg font-semibold text-ink mb-5 uppercase tracking-wider">Permissions</h4>
      <RolePermissionsDisplay roleId={role.id} roleName={role.roleName} />
     </div>
    </div>

    <div className="p-6 border-t-2 border-border flex justify-end">
     <UnifiedButton variant="secondary" onClick={onClose}>
      Close
     </UnifiedButton>
    </div>
   </div>
  </ModalOverlay>
 );
};

export default RoleDetailPopup;