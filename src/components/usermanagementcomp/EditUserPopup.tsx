import React, { useState } from 'react';
import { UnifiedButton, inputClassName, selectClassName } from '../ui';
import { updateUserRole } from '../../services/user.service';
import type { User } from './ViewUsers';

interface RoleOption {
 role_id: number;
 role_name: string;
}

const DEPARTMENTS = [
 { value: 'sales', label: 'Sales' },
 { value: 'rnd', label: 'R&D' },
 { value: 'quality_assurance', label: 'Quality Assurance' },
 { value: 'logistics', label: 'Logistics' },
 { value: 'marketing', label: 'Marketing' },
 { value: 'finance', label: 'Finance' },
] as const;

interface EditUserPopupProps {
 user: User;
 roles: RoleOption[];
 onClose: () => void;
 onSave: (updatedUser: User) => void;
}

const EditUserPopup: React.FC<EditUserPopupProps> = ({ user, roles, onClose, onSave }) => {
 const [editedUser, setEditedUser] = useState<User>({
  ...user,
  roleId: user.roleId ?? (roles.find(r => r.role_name === user.role)?.role_id),
 });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const statusOptions: ('active' | 'deactive' | 'suspended')[] = ['active', 'deactive', 'suspended'];

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  if (name === 'roleId') {
   const roleId = Number(value);
   const roleName = roles.find(r => r.role_id === roleId)?.role_name ?? '';
   setEditedUser(prev => ({ ...prev, roleId, role: roleName }));
   return;
  }
  setEditedUser(prev => ({ ...prev, [name]: value }));
 };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setSaving(true);
  const roleId = editedUser.roleId ?? roles.find(r => r.role_name === editedUser.role)?.role_id;
  if (roleId == null) {
   setError('Please select a role');
   setSaving(false);
   return;
  }
  try {
   const result = await updateUserRole(user.id, {
    roleId,
    department: editedUser.department || undefined,
   });
   if (!result.success) {
    setError((result.error as any)?.message ?? (typeof result.error === 'string' ? result.error : 'Failed to update user'));
    setSaving(false);
    return;
   }
   const updatedUser: User = {
    ...editedUser,
    roleId,
    role: roles.find(r => r.role_id === roleId)?.role_name ?? editedUser.role,
    lastUpdate: new Date().toISOString().slice(0, 19).replace('T', ' '),
   };
   onSave(updatedUser);
   onClose();
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Failed to update user');
  } finally {
   setSaving(false);
  }
 };

 return (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
   <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
    <div className="flex justify-between items-center p-5 border-b border-gray-100">
     <h3 className="text-xl font-semibold text-gray-800">Edit User</h3>
     <button
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    <form onSubmit={handleSubmit} className="p-5 space-y-5">
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* User Name */}
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        User Name
       </label>
       <input
        type="text"
        name="name"
        value={editedUser.name}
        onChange={handleInputChange}
        className={inputClassName}
        required
       />
      </div>

      {/* Email */}
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Email
       </label>
       <input
        type="email"
        name="email"
        value={editedUser.email}
        onChange={handleInputChange}
        className={inputClassName}
        required
       />
      </div>

      {/* Mobile */}
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Mobile
       </label>
       <input
        type="tel"
        name="mobile"
        value={editedUser.mobile}
        onChange={handleInputChange}
        className={inputClassName}
        required
       />
      </div>

      {/* Department */}
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Department
       </label>
       <select
        name="department"
        value={editedUser.department}
        onChange={handleInputChange}
        className={selectClassName}
       >
        <option value="">— Select —</option>
        {DEPARTMENTS.map((d) => (
         <option key={d.value} value={d.value}>
          {d.label}
         </option>
        ))}
       </select>
      </div>

      {/* Role */}
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Role
       </label>
       <select
        name="roleId"
        value={editedUser.roleId ?? ''}
        onChange={handleInputChange}
        className={selectClassName}
        required
       >
        <option value="">— Select —</option>
        {roles.map((r) => (
         <option key={r.role_id} value={r.role_id}>
          {r.role_name}
         </option>
        ))}
       </select>
      </div>

      {/* Status */}
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Status
       </label>
       <select
        name="status"
        value={editedUser.status}
        onChange={handleInputChange}
        className={selectClassName}
        required
       >
        {statusOptions.map((status) => (
         <option key={status} value={status}>
          {status}
         </option>
        ))}
       </select>
      </div>
     </div>

     {/* Read-only fields */}
     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-gray-100">
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Created At
       </label>
       <input
        type="text"
        value={editedUser.createdAt}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
        readOnly
       />
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Last Login
       </label>
       <input
        type="text"
        value={editedUser.lastLogin}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
        readOnly
       />
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-600 mb-2">
        Last Update
       </label>
       <input
        type="text"
        value={editedUser.lastUpdate}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
        readOnly
       />
      </div>
     </div>

     {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
     <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-5 border-t border-gray-100">
      <UnifiedButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
       Cancel
      </UnifiedButton>
      <UnifiedButton type="submit" variant="primary" disabled={saving}>
       {saving ? 'Saving…' : 'Save Changes'}
      </UnifiedButton>
     </div>
    </form>
   </div>
  </div>
 );
};

export default EditUserPopup;