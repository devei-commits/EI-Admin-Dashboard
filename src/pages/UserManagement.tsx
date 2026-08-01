import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
 Filter,
 Plus,
 Users,
 UserCheck,
 UserX,
 UserMinus,
 Eye,
 Edit3,
 Trash2,
 X,
 Save,
 Building2,
 ChevronDown,
 ChevronUp,
 RefreshCw,
 Settings,
 Check,
} from 'lucide-react';
import { SearchInput, Pagination, ConfirmDialog, PageHeader, inputClassName, selectClassName } from '../components/ui';
import { ModalOverlay } from '../components/ui/ModalOverlay';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { SortableTableTh, type SortDirection } from '../components/ui/SortableTableTh';
import { fetchStaffUsers, updateUserRole, updateUserProfile, deleteUser as deleteUserApi, createStaffUser, type StaffUserFromApi } from '../services/user.service';
import { listStaffRoles } from '../services/role.service';
import {
 fetchDepartments,
 createDepartment as apiCreateDepartment,
 updateDepartment as apiUpdateDepartment,
 deleteDepartment as apiDeleteDepartment,
 type DepartmentRow,
} from '../services/department.service';

// ==================== TYPES ====================
interface User {
 id: string;
 firstName: string;
 lastName: string;
 email: string;
 mobile: string;
 role: string;
 department: string;
 status: 'active' | 'inactive' | 'suspended';
 createdAt: string;
 lastLogin: string;
 vendorClientCode?: string | null;
}

type UserSortColumn =
 | 'name'
 | 'email'
 | 'mobile'
 | 'masters'
 | 'department'
 | 'role'
 | 'status'
 | 'lastLogin';

function sortValueForUser(user: User, column: UserSortColumn): string | number {
 switch (column) {
  case 'name':
   return `${user.firstName} ${user.lastName}`.trim().toLowerCase();
  case 'email':
   return user.email.toLowerCase();
  case 'mobile':
   return user.mobile;
  case 'masters':
   return (user.vendorClientCode || '').toLowerCase();
  case 'department':
   return user.department.toLowerCase();
  case 'role':
   return user.role.toLowerCase();
  case 'status':
   return user.status;
  case 'lastLogin':
   return user.lastLogin ? new Date(user.lastLogin).getTime() || 0 : 0;
  default:
   return '';
 }
}

// ==================== CONSTANTS ====================
const FALLBACK_DEPARTMENTS = [
 'Business Development', 'Quality Assurance', 'Research & Development', 'Sales',
 'Packaging', 'Design', 'Procurement', 'Manufacturing', 'Logistics', 'Administration', 'Production',
];

/** Map API staff user to page User type */
function formatLastLogin(raw: string | null | undefined): string {
 if (!raw) return '';
 const d = new Date(raw);
 if (Number.isNaN(d.getTime())) return '';
 return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function mapStaffToUser(r: StaffUserFromApi): User {
 const name = (r.display_name || '').trim();
 const [firstName, ...rest] = name.split(/\s+/);
 const lastName = rest.length ? rest.join(' ') : '';
 const status = (r.status === 'active' ? 'active' : r.status === 'suspended' ? 'suspended' : 'inactive') as User['status'];
 return {
  id: String(r.userid ?? r.id),
  firstName: firstName || '—',
  lastName: lastName || '',
  email: r.email ?? '',
  mobile: r.mobile ?? '',
  role: r.role_name ?? '',
  department: r.department ?? '',
  status,
  createdAt: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
  lastLogin: formatLastLogin(r.last_login_at),
  vendorClientCode: r.vendor_client_code ?? null,
 };
}

// ==================== DEPARTMENT MANAGER ====================
function DepartmentManager({ departments, onRefresh }: { departments: DepartmentRow[]; onRefresh: () => void }) {
 const [open, setOpen] = useState(false);
 const [addName, setAddName] = useState('');
 const [addCode, setAddCode] = useState('');
 const [editId, setEditId] = useState<number | null>(null);
 const [editName, setEditName] = useState('');
 const [editCode, setEditCode] = useState('');
 const [saving, setSaving] = useState(false);

 const handleAdd = async () => {
  if (!addName.trim()) return;
  const code = addCode.trim() || addName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  setSaving(true);
  try {
   await apiCreateDepartment({ name: addName.trim(), code });
   setAddName(''); setAddCode('');
   onRefresh();
  } catch { /* handled by toast or inline error */ }
  finally { setSaving(false); }
 };

 const handleUpdate = async (id: number) => {
  if (!editName.trim()) return;
  setSaving(true);
  try {
   await apiUpdateDepartment(id, { name: editName.trim(), code: editCode.trim() || undefined });
   setEditId(null);
   onRefresh();
  } catch { /* */ }
  finally { setSaving(false); }
 };

 const handleDelete = async (dept: DepartmentRow) => {
  if (!confirm(`Delete department "${dept.name}"? This cannot be undone.`)) return;
  try {
   await apiDeleteDepartment(dept.id);
   onRefresh();
  } catch { /* */ }
 };

 const handleToggleActive = async (dept: DepartmentRow) => {
  try {
   await apiUpdateDepartment(dept.id, { is_active: !dept.is_active });
   onRefresh();
  } catch { /* */ }
 };

 const startEdit = (dept: DepartmentRow) => {
  setEditId(dept.id);
  setEditName(dept.name);
  setEditCode(dept.code);
 };

 return (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
   <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
    <div className="flex items-center gap-2">
     <Settings className="w-4 h-4 text-slate-500" />
     <span className="text-sm font-semibold text-slate-700">Manage Departments</span>
     <span className="text-xs text-slate-400 ml-1">({departments.length})</span>
    </div>
    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
   </button>
   {open && (
    <div className="border-t border-gray-100 p-4">
     {/* Add new department */}
     <div className="flex gap-2 mb-4">
      <input value={addName} onChange={e => { setAddName(e.target.value); setAddCode(e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); }}
       placeholder="Department name" aria-label="Department name" className={`${inputClassName} flex-1`} />
      <input value={addCode} onChange={e => setAddCode(e.target.value)}
       placeholder="Code (auto)" aria-label="Department code" className={`${inputClassName} w-40`} />
      <button onClick={handleAdd} disabled={saving || !addName.trim()}
       className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
       <Plus className="w-3.5 h-3.5" /> Add
      </button>
     </div>

     {/* Department list */}
     <div className="space-y-1.5">
      {departments.sort((a, b) => a.name.localeCompare(b.name)).map(dept => (
       <div key={dept.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${dept.is_active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
        {editId === dept.id ? (
         <>
          <input value={editName} onChange={e => setEditName(e.target.value)} aria-label="Department name" className={`${inputClassName} flex-1 py-1.5!`} autoFocus />
          <input value={editCode} onChange={e => setEditCode(e.target.value)} aria-label="Department code" className={`${inputClassName} w-36 py-1.5!`} />
          <button onClick={() => handleUpdate(dept.id)} disabled={saving} aria-label="Save department"
           className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
          <button onClick={() => setEditId(null)} aria-label="Cancel edit"
           className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
         </>
        ) : (
         <>
          <Building2 className={`w-4 h-4 ${dept.is_active ? 'text-slate-500' : 'text-slate-300'}`} />
          <span className="flex-1 text-sm font-medium text-slate-700">{dept.name}</span>
          <span className="text-xs text-slate-400 font-mono">{dept.code}</span>
          <button onClick={() => handleToggleActive(dept)} title={dept.is_active ? 'Deactivate' : 'Activate'}
           className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${dept.is_active ? 'text-green-600 bg-green-50 border-green-200' : 'text-slate-400 bg-slate-50 border-slate-200'}`}>
           {dept.is_active ? 'Active' : 'Inactive'}
          </button>
          <button onClick={() => startEdit(dept)} aria-label="Edit department"
           className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleDelete(dept)} aria-label="Delete department"
           className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
         </>
        )}
       </div>
      ))}
      {departments.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No departments yet. Add one above.</p>}
     </div>
    </div>
   )}
  </div>
 );
}

// ==================== COMPONENT ====================
const UserManagement = () => {
 const [users, setUsers] = useState<User[]>([]);
 const [roles, setRoles] = useState<Array<{ role_id: number; role_name: string; role_code: string }>>([]);
 const [departments, setDepartments] = useState<DepartmentRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [departmentFilter, setDepartmentFilter] = useState<string>('all');
 const [roleFilter, setRoleFilter] = useState<string>('all');
 const [sortColumn, setSortColumn] = useState<UserSortColumn | null>(null);
 const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
 const [showFilters, setShowFilters] = useState(false);
 const [currentPage, setCurrentPage] = useState(1);
 const [selectedUser, setSelectedUser] = useState<User | null>(null);
 const [modalType, setModalType] = useState<'view' | 'add' | 'edit' | 'delete' | null>(null);
 const [formData, setFormData] = useState<Partial<User> & { password?: string }>({});
 const itemsPerPage = 8;

 const departmentNames = useMemo(() => {
  if (departments.length > 0) return departments.filter(d => d.is_active).map(d => d.name).sort();
  return FALLBACK_DEPARTMENTS;
 }, [departments]);

 const loadDepartments = useCallback(async () => {
  try {
   const rows = await fetchDepartments();
   setDepartments(rows);
  } catch { /* fallback to hardcoded */ }
 }, []);

 const loadUsers = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const [usersRes, rolesList] = await Promise.all([
    fetchStaffUsers(),
    listStaffRoles(),
    loadDepartments(),
   ]);
   if (usersRes.success && usersRes.data) {
    setUsers(usersRes.data.map(mapStaffToUser));
   }
   if (rolesList?.length) {
    setRoles(rolesList.map((r) => ({ role_id: r.role_id, role_name: r.role_name, role_code: r.role_code })));
   }
  } catch {
   setError('Failed to load users');
   setUsers([]);
  } finally {
   setLoading(false);
  }
 }, [loadDepartments]);

 useEffect(() => {
  loadUsers();
 }, [loadUsers]);

 // When edit modal opens, sync form to selected user so the form always shows current user data
 useEffect(() => {
  if (modalType === 'edit' && selectedUser) {
   setFormData({
    id: selectedUser.id,
    firstName: selectedUser.firstName ?? '',
    lastName: selectedUser.lastName ?? '',
    email: selectedUser.email ?? '',
    mobile: selectedUser.mobile ?? '',
    role: selectedUser.role ?? '',
    department: selectedUser.department ?? '',
    status: selectedUser.status ?? 'active',
    createdAt: selectedUser.createdAt ?? '',
    lastLogin: selectedUser.lastLogin ?? '',
   });
  }
 }, [modalType, selectedUser?.id]);

 // Role options for filter: from API roles + any role names present in users
 const roleFilterOptions = useMemo(() => {
  const fromRoles = roles.map((r) => r.role_name);
  const fromUsers = [...new Set(users.map((u) => u.role).filter(Boolean))];
  return [...new Set([...fromRoles, ...fromUsers])].sort();
 }, [roles, users]);

 // Filter and sort users
 const filteredUsers = useMemo(() => {
  let result = [...users];
  if (searchTerm) {
   const term = searchTerm.toLowerCase();
   result = result.filter(u =>
    u.firstName.toLowerCase().includes(term) ||
    u.lastName.toLowerCase().includes(term) ||
    u.email.toLowerCase().includes(term) ||
    u.mobile.includes(term) ||
    u.id.toLowerCase().includes(term)
   );
  }
  if (statusFilter !== 'all') result = result.filter(u => u.status === statusFilter);
  if (departmentFilter !== 'all') result = result.filter(u => u.department === departmentFilter);
  if (roleFilter !== 'all') result = result.filter(u => u.role === roleFilter);

  if (sortColumn) {
   result.sort((a, b) => {
    const av = sortValueForUser(a, sortColumn);
    const bv = sortValueForUser(b, sortColumn);
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') {
     cmp = av - bv;
    } else {
     cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    }
    if (cmp === 0) cmp = a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? cmp : -cmp;
   });
  }
  return result;
 }, [users, searchTerm, statusFilter, departmentFilter, roleFilter, sortColumn, sortDirection]);

 const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
 const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

 const stats = useMemo(() => ({
  total: users.length,
  active: users.filter(u => u.status === 'active').length,
  inactive: users.filter(u => u.status === 'inactive').length,
  suspended: users.filter(u => u.status === 'suspended').length,
 }), [users]);

 const handleOpenModal = useCallback((type: 'view' | 'add' | 'edit' | 'delete', user?: User) => {
  setSaveError(null);
  setModalType(type);
  if (user) {
   setSelectedUser(user);
   setFormData({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    department: user.department,
    status: user.status,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
   });
  } else {
   setSelectedUser(null);
   setFormData({ status: 'active', password: '' });
  }
 }, []);

 const handleCloseModal = useCallback(() => {
  setModalType(null);
  setSelectedUser(null);
  setFormData({});
 }, []);

 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState<string | null>(null);

 const handleSaveUser = useCallback(async () => {
  if (modalType === 'add') {
   setSaving(true);
   setSaveError(null);
  const selectedRole = roles.find((r) => r.role_name === formData.role);
  const roleId = selectedRole?.role_id;
  const roleCode = selectedRole?.role_code;
   const password = formData.password?.trim();
   if (!password || password.length < 6) {
    setSaveError('Password is required (min 6 characters).');
    setSaving(false);
    return;
   }
   if (!formData.email?.trim()) {
    setSaveError('Email is required.');
    setSaving(false);
    return;
   }
   if (!roleId || !roleCode) {
    setSaveError('Role is required.');
    setSaving(false);
    return;
   }
   try {
    const res = await createStaffUser({
     firstName: formData.firstName?.trim() ?? '',
     lastName: formData.lastName?.trim() ?? '',
     email: formData.email.trim(),
     mobile: formData.mobile?.trim() ?? '',
     password,
     role: roleCode,
     roleId,
     status: formData.status || 'active',
    });
    if (res.success) {
     await loadUsers();
     handleCloseModal();
    } else {
     const errMsg = typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? (res.error as { message: string }).message : null) ?? 'Failed to create user';
     setSaveError(errMsg);
    }
   } catch (e) {
    setSaveError(e instanceof Error ? e.message : 'Failed to create user');
   } finally {
    setSaving(false);
   }
   return;
  }
  if (modalType === 'edit' && selectedUser) {
   setSaving(true);
   setSaveError(null);
   const roleId = roles.find((r) => r.role_name === formData.role)?.role_id;
   try {
    if (roleId != null) {
     const roleRes = await updateUserRole(selectedUser.id, {
      roleId,
      department: formData.department || undefined,
     });
     if (!roleRes.success) {
      const errMsg = typeof roleRes.error === 'string' ? roleRes.error : (roleRes.error && typeof roleRes.error === 'object' && 'message' in roleRes.error ? (roleRes.error as { message: string }).message : null) ?? 'Failed to update role';
      setSaveError(errMsg);
      setSaving(false);
      return;
     }
    }
    const profileRes = await updateUserProfile(selectedUser.id, {
     name: [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() || undefined,
     email: formData.email,
     mobile: formData.mobile,
     status: formData.status,
    });
    if (!profileRes.success) {
     const errMsg = typeof profileRes.error === 'string' ? profileRes.error : (profileRes.error && typeof profileRes.error === 'object' && 'message' in profileRes.error ? (profileRes.error as { message: string }).message : null) ?? 'Failed to update profile';
     setSaveError(errMsg);
     setSaving(false);
     return;
    }
    await loadUsers();
    handleCloseModal();
   } catch (e) {
    setSaveError(e instanceof Error ? e.message : 'Failed to save');
   } finally {
    setSaving(false);
   }
  }
 }, [modalType, formData, selectedUser, roles, loadUsers, handleCloseModal]);

 const handleDeleteUser = useCallback(async () => {
  if (!selectedUser) return;
  setSaving(true);
  setSaveError(null);
  try {
   const res = await deleteUserApi(selectedUser.id);
   if (res.success) {
    await loadUsers();
    handleCloseModal();
   } else {
    const errMsg = typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? (res.error as { message: string }).message : null);
    setSaveError(errMsg ?? 'Failed to delete user');
   }
  } catch (e) {
   setSaveError(e instanceof Error ? e.message : 'Failed to delete user');
  } finally {
   setSaving(false);
  }
 }, [selectedUser, loadUsers, handleCloseModal]);

 const handleToggleStatus = useCallback(async (user: User) => {
  const newStatus = user.status === 'active' ? 'inactive' : 'active';
  const res = await updateUserProfile(user.id, { status: newStatus });
  if (res.success) await loadUsers();
 }, [loadUsers]);

 const toggleUserSort = (column: UserSortColumn) => {
  if (sortColumn === column) {
   setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
   return;
  }
  setSortColumn(column);
  setSortDirection('asc');
  setCurrentPage(1);
 };

 const resetFilters = () => {
  setSearchTerm('');
  setStatusFilter('all');
  setDepartmentFilter('all');
  setRoleFilter('all');
  setCurrentPage(1);
  loadUsers();
 };

 const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
   active: 'bg-green-100 text-green-700 border-green-200',
   inactive: 'bg-gray-100 text-slate-400 border-gray-200',
   suspended: 'bg-red-100 text-red-600 border-red-200',
  };
  return colors[status] || colors.inactive;
 };

 const getStatusIcon = (status: string) => {
  const icons: Record<string, React.ReactNode> = {
   active: <UserCheck className="w-3 h-3" />,
   inactive: <UserMinus className="w-3 h-3" />,
   suspended: <UserX className="w-3 h-3" />,
  };
  return icons[status] || icons.inactive;
 };

 return (
  <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
   {/* Header */}
   <PageHeader
    title="User Management"
    subtitle="Internal team members — assign roles and edit staff details (customers and doctors are managed elsewhere)"
    icon={<Users className="w-8 h-8" />}
    className="rounded-2xl mb-6"
    actions={
     <>
      <button onClick={resetFilters} className="px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors flex items-center gap-2">
       <RefreshCw className="w-4 h-4" /> Reset
      </button>
      <button onClick={() => handleOpenModal('add')} className="px-4 py-2 bg-white text-slate-800 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
       <Plus className="w-4 h-4" /> Add User
      </button>
     </>
    }
   />

   {/* Stats */}
   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {[
     { label: 'Total Users', value: stats.total, icon: Users, color: 'blue' },
     { label: 'Active', value: stats.active, icon: UserCheck, color: 'green' },
     { label: 'Inactive', value: stats.inactive, icon: UserMinus, color: 'gray' },
     { label: 'Suspended', value: stats.suspended, icon: UserX, color: 'red' },
    ].map(({ label, value, icon: Icon, color }) => (
     <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
       <div className={`p-2.5 bg-${color}-100 rounded-lg`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
       </div>
       <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
       </div>
      </div>
     </div>
    ))}
   </div>

   {/* Department Management */}
   <DepartmentManager departments={departments} onRefresh={loadDepartments} />

   {/* Search & Filters */}
   <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
    <div className="flex flex-col md:flex-row gap-4">
     <SearchInput
      value={searchTerm}
      onChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
      placeholder="Search by name, email, phone, or ID..."
      widthClass="flex-1"
     />
     <button
      onClick={() => setShowFilters(!showFilters)}
      className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${showFilters ? 'bg-gray-100 text-slate-900' : 'bg-gray-100 text-slate-400 hover:bg-gray-200'}`}
     >
      <Filter className="w-4 h-4" /> Filters {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
     </button>
    </div>
    {showFilters && (
     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
      {[
       { label: 'Status', value: statusFilter, setter: setStatusFilter, options: ['all', 'active', 'inactive', 'suspended'] },
       { label: 'Department', value: departmentFilter, setter: setDepartmentFilter, options: ['all', ...departmentNames] },
       { label: 'Role', value: roleFilter, setter: setRoleFilter, options: ['all', ...roleFilterOptions] },
      ].map(({ label, value, setter, options }) => (
       <div key={label}>
        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
        <select
         aria-label={label}
         value={value}
         onChange={(e) => { setter(e.target.value); setCurrentPage(1); }}
         className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="all">All {label}s</option>
         {(label === 'Role' ? roleFilterOptions : options.filter((o) => o !== 'all')).map((o) => (
          <option key={o} value={o}>{o}</option>
         ))}
        </select>
       </div>
      ))}
     </div>
    )}
   </div>

   {loading && (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
     <TableSkeleton rows={8} cols={8} />
    </div>
   )}
   {error && (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
     <ErrorState message={error} onRetry={loadUsers} />
    </div>
   )}

   {/* Users Table */}
   {!loading && (
   <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="hidden md:block overflow-x-auto">
     <table className="w-full table-fixed min-w-212.5">
      <thead className="bg-slate-50 border-b border-gray-200">
       <tr>
        <SortableTableTh label="User" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <SortableTableTh label="Contact" column="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <SortableTableTh label="Masters" column="masters" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <SortableTableTh label="Department" column="department" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <SortableTableTh label="Role" column="role" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <SortableTableTh label="Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <SortableTableTh label="Last Login" column="lastLogin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleUserSort} />
        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
       {paginatedUsers.length === 0 ? (
        <tr><td colSpan={8} className="px-4 py-4">
         <EmptyState icon={<Users />} title="No users found" />
        </td></tr>
       ) : paginatedUsers.map(user => (
        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
         <td className="px-4 py-3">
          <div className="min-w-0">
           <p className="font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
           <p className="text-xs text-slate-500 font-mono truncate" title="User ID">
             ID {user.id}
           </p>
          </div>
         </td>
         <td className="px-4 py-3">
          <p className="text-sm text-slate-700 truncate">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wide mr-1.5">Email</span>
            {user.email || '—'}
          </p>
          <p className="text-sm text-slate-700 mt-0.5">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wide mr-1.5">Phone</span>
            {user.mobile || '—'}
          </p>
         </td>
         <td className="px-4 py-3">
          {user.vendorClientCode ? (
           <Link to="/vendor-client" className="text-xs font-mono text-blue-600 hover:underline" title="Open Masters → Vendor / Client">
            {user.vendorClientCode}
           </Link>
          ) : (
           <span className="text-xs text-slate-400">—</span>
          )}
         </td>
         <td className="px-4 py-3"><span className="text-sm text-slate-700">{user.department || '—'}</span></td>
         <td className="px-4 py-3"><span className="text-sm font-medium text-slate-800">{user.role || '—'}</span></td>
         <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}>
           {getStatusIcon(user.status)} {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
          </span>
         </td>
         <td className="px-4 py-3">
          <span className="text-sm text-slate-600">{user.lastLogin || '—'}</span>
         </td>
         <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1">
           <button onClick={() => handleOpenModal('view', user)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
           <button onClick={() => handleOpenModal('edit', user)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg" title="Edit"><Edit3 className="w-4 h-4" /></button>
           <button onClick={() => handleToggleStatus(user)} className={`p-1.5 rounded-lg ${user.status === 'active' ? 'text-slate-500 hover:text-slate-800 hover:bg-orange-50' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'}`} title={user.status === 'active' ? 'Deactivate' : 'Activate'}>
            {user.status === 'active' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
           </button>
           <button onClick={() => handleOpenModal('delete', user)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
          </div>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>

    {/* Mobile Cards */}
    <div className="md:hidden divide-y divide-gray-100">
     {paginatedUsers.length === 0 ? (
      <EmptyState icon={<Users />} title="No users found" />
     ) : paginatedUsers.map(user => (
      <div key={user.id} className="p-4 hover:bg-slate-50/50">
       <div className="flex items-start justify-between mb-3">
        <div>
         <p className="font-semibold text-gray-800">{user.firstName} {user.lastName}</p>
         <p className="text-xs text-slate-500 font-mono">ID {user.id} · {user.role}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}>{getStatusIcon(user.status)} {user.status}</span>
       </div>
       <div className="space-y-1.5 text-sm mb-3">
        <p className="text-slate-700"><span className="text-slate-500 text-xs font-medium uppercase mr-2">Email</span>{user.email || '—'}</p>
        <p className="text-slate-700"><span className="text-slate-500 text-xs font-medium uppercase mr-2">Phone</span>{user.mobile || '—'}</p>
        <p className="text-slate-700"><span className="text-slate-500 text-xs font-medium uppercase mr-2">Dept</span>{user.department || '—'}</p>
       </div>
       <div className="flex gap-2">
        <button onClick={() => handleOpenModal('view', user)} className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">View</button>
        <button onClick={() => handleOpenModal('edit', user)} className="flex-1 px-3 py-2 bg-gray-100 text-slate-300 rounded-lg text-sm font-medium">Edit</button>
        <button onClick={() => handleOpenModal('delete', user)} aria-label="Delete" className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium"><Trash2 className="w-4 h-4" /></button>
       </div>
      </div>
     ))}
    </div>

    {/* Pagination */}
    <div className="px-4 py-3 border-t border-gray-100 bg-slate-50">
     <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
      totalItems={filteredUsers.length}
      itemsPerPage={itemsPerPage}
     />
    </div>
   </div>
   )}

   {/* View Modal */}
   {modalType === 'view' && selectedUser && (
    <ModalOverlay onClose={handleCloseModal} z="z-50" dismissable={false} backdrop="light">
     <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="user-view-modal-title" onClick={(e) => e.stopPropagation()}>
      <div className="bg-slate-800 p-6 rounded-t-2xl">
       <div className="flex items-center justify-between">
        <div>
         <h2 id="user-view-modal-title" className="text-xl font-bold text-white">{selectedUser.firstName} {selectedUser.lastName}</h2>
         <p className="text-gray-100">{selectedUser.role} • {selectedUser.department}</p>
        </div>
        <button onClick={handleCloseModal} aria-label="Close" className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
       </div>
      </div>
      <div className="p-6 space-y-4">
       <div className="grid grid-cols-2 gap-4">
        {[
         { label: 'User ID', value: selectedUser.id },
         { label: 'Status', value: selectedUser.status, badge: true },
         { label: 'Email', value: selectedUser.email },
         { label: 'Mobile', value: selectedUser.mobile },
         {
          label: 'Client / vendor master',
          value: selectedUser.vendorClientCode ? selectedUser.vendorClientCode : '—',
          linkVendor: Boolean(selectedUser.vendorClientCode),
         },
         { label: 'Created On', value: selectedUser.createdAt },
         { label: 'Last Login', value: selectedUser.lastLogin },
        ].map(({ label, value, badge, linkVendor }) => (
         <div key={label} className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">{label}</p>
          {badge ? (
           <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${getStatusColor(String(value))}`}>{getStatusIcon(String(value))} {String(value)}</span>
          ) : linkVendor ? (
           <Link to="/vendor-client" className="font-medium text-sm text-blue-600 hover:underline mt-1 inline-block font-mono">{String(value)}</Link>
          ) : (
           <p className="font-medium text-gray-800 text-sm">{value}</p>
          )}
         </div>
        ))}
       </div>
       <div className="flex gap-3 pt-4">
        <button onClick={() => { handleCloseModal(); handleOpenModal('edit', selectedUser); }} className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 flex items-center justify-center gap-2"><Edit3 className="w-4 h-4" /> Edit</button>
        <button onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-gray-200 text-slate-400 rounded-lg font-medium hover:bg-slate-50">Close</button>
       </div>
      </div>
     </div>
    </ModalOverlay>
   )}

   {/* Add/Edit Modal */}
   {(modalType === 'add' || modalType === 'edit') && (
    <ModalOverlay onClose={handleCloseModal} z="z-50" dismissable={false} backdrop="light">
     <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="user-edit-modal-title" onClick={(e) => e.stopPropagation()}>
      <div className="bg-slate-800 p-5 rounded-t-2xl sticky top-0">
       <div className="flex items-center justify-between">
        <h2 id="user-edit-modal-title" className="text-lg font-bold text-white">{modalType === 'add' ? 'Add New User' : 'Edit User'}</h2>
        <button onClick={handleCloseModal} aria-label="Close" className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
       </div>
      </div>
      <div className="p-5 space-y-4">
       <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-300 mb-1">First Name *</label><input type="text" aria-label="First Name" value={formData.firstName || ''} onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))} className={inputClassName} required /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Last Name *</label><input type="text" aria-label="Last Name" value={formData.lastName || ''} onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))} className={inputClassName} required /></div>
       </div>
       <div><label className="block text-sm font-medium text-slate-300 mb-1">Email *</label><input type="email" aria-label="Email" value={formData.email || ''} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className={inputClassName} required /></div>
       <div><label className="block text-sm font-medium text-slate-300 mb-1">Mobile *</label><input type="tel" aria-label="Mobile" value={formData.mobile || ''} onChange={(e) => setFormData(p => ({ ...p, mobile: e.target.value }))} className={inputClassName} required /></div>
       {modalType === 'add' && (
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Password *</label><input type="password" aria-label="Password" value={formData.password ?? ''} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} className={inputClassName} placeholder="Min 6 characters" required minLength={6} /></div>
       )}
       <div><label className="block text-sm font-medium text-slate-300 mb-1">Role *</label><select aria-label="Role" value={formData.role || ''} onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))} className={selectClassName} required disabled={roles.length === 0}><option value="">Select</option>{roles.map(r => <option key={r.role_id} value={r.role_name}>{r.role_name}</option>)}</select></div>
       <div><label className="block text-sm font-medium text-slate-300 mb-1">Status</label><select aria-label="Status" value={formData.status || 'active'} onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as User['status'] }))} className={selectClassName}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
       {saveError && <p className="text-sm text-red-600">{saveError}</p>}
       <div className="flex gap-3 pt-4">
        <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-gray-200 text-slate-400 rounded-lg font-medium hover:bg-slate-50" disabled={saving}>Cancel</button>
        <button type="button" onClick={() => handleSaveUser()} className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : (modalType === 'add' ? 'Add User' : 'Save')} {modalType === 'edit' && <Save className="w-4 h-4" />}</button>
       </div>
      </div>
     </div>
    </ModalOverlay>
   )}

   {/* Delete Modal */}
   <ConfirmDialog
    isOpen={modalType === 'delete' && !!selectedUser}
    onClose={handleCloseModal}
    onConfirm={handleDeleteUser}
    title="Delete User?"
    message={selectedUser ? (<>Are you sure you want to delete <span className="font-semibold">{selectedUser.firstName} {selectedUser.lastName}</span>? This action cannot be undone.{saveError && <p className="text-red-600 mt-2">{saveError}</p>}</>) : ''}
    confirmText="Delete"
    variant="danger"
    isLoading={saving}
   />
  </div>
 );
};

export default UserManagement;
