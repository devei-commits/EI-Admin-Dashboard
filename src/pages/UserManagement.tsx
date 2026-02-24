import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Mail,
  Phone,
  Building2,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { SearchInput, Pagination, ConfirmDialog, PageHeader, inputClassName, selectClassName } from '../components/ui';
import { fetchStaffUsers, updateUserRole, updateUserProfile, deleteUser as deleteUserApi, createStaffUser, type StaffUserFromApi } from '../services/user.service';
import { listRoles } from '../services/role.service';

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
}

// ==================== CONSTANTS ====================
const DEPARTMENTS = [
  'Business Development',
  'Quality Assurance',
  'Research & Development',
  'Sales',
  'Packaging',
  'Design',
  'Procurement',
  'Manufacturing',
  'Logistics',
  'Administration',
] as const;

/** Map API staff user to page User type */
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
    lastLogin: '',
  };
}

// ==================== COMPONENT ====================
const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Array<{ role_id: number; role_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'department' | 'status' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<'view' | 'add' | 'edit' | 'delete' | null>(null);
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({});
  const itemsPerPage = 8;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesList] = await Promise.all([
        fetchStaffUsers(),
        listRoles(),
      ]);
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data.map(mapStaffToUser));
      }
      if (rolesList?.length) {
        setRoles(rolesList.map((r) => ({ role_id: r.role_id, role_name: r.role_name })));
      }
    } catch {
      setError('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`); break;
        case 'role': cmp = a.role.localeCompare(b.role); break;
        case 'department': cmp = a.department.localeCompare(b.department); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [users, searchTerm, statusFilter, departmentFilter, roleFilter, sortBy, sortOrder]);

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
      const roleId = roles.find((r) => r.role_name === formData.role)?.role_id;
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
      if (!roleId) {
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
          roleId,
          department: formData.department || undefined,
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

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
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
      inactive: 'bg-gray-100 text-gray-600 border-gray-200',
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

  const getInitials = (first: string, last: string) => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <PageHeader
        title="User Management"
        subtitle="Manage users, roles, and access permissions"
        icon={<Users className="w-8 h-8" />}
        className="rounded-2xl mb-6"
        actions={
          <>
            <button onClick={resetFilters} className="px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
            <button onClick={() => handleOpenModal('add')} className="px-4 py-2 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition-colors flex items-center gap-2">
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
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 bg-${color}-100 rounded-lg`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <SearchInput
            value={searchTerm}
            onChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
            placeholder="Search by name, email, phone, or ID..."
            widthClass="flex-1"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${showFilters ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Filter className="w-4 h-4" /> Filters {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
            {[
              { label: 'Status', value: statusFilter, setter: setStatusFilter, options: ['all', 'active', 'inactive', 'suspended'] },
              { label: 'Department', value: departmentFilter, setter: setDepartmentFilter, options: ['all', ...DEPARTMENTS] },
              { label: 'Role', value: roleFilter, setter: setRoleFilter, options: ['all', ...roleFilterOptions] },
            ].map(({ label, value, setter, options }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <select
                  value={value}
                  onChange={(e) => { setter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
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
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-8 text-center">
          <p className="text-gray-500">Loading users…</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Users Table */}
      {!loading && (
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-amber-50 to-orange-50">
              <tr>
                {[
                  { key: 'name', label: 'User' },
                  { key: null, label: 'Contact' },
                  { key: 'department', label: 'Department' },
                  { key: 'role', label: 'Role' },
                  { key: 'status', label: 'Status' },
                  { key: null, label: 'Last Login' },
                  { key: null, label: 'Actions' },
                ].map(({ key, label }) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    {key ? (
                      <button onClick={() => toggleSort(key as typeof sortBy)} className="flex items-center gap-1 hover:text-amber-600">
                        {label} {sortBy === key && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500">No users found</p>
                </td></tr>
              ) : paginatedUsers.map(user => (
                <tr key={user.id} className="hover:bg-amber-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500">{user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{user.email}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{user.mobile}</p>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-700 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" />{user.department}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Shield className="w-4 h-4 text-amber-500" />{user.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}>
                      {getStatusIcon(user.status)} {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{user.lastLogin}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleOpenModal('view', user)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleOpenModal('edit', user)} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleToggleStatus(user)} className={`p-1.5 rounded-lg ${user.status === 'active' ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`} title={user.status === 'active' ? 'Deactivate' : 'Activate'}>
                        {user.status === 'active' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleOpenModal('delete', user)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
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
            <div className="px-4 py-12 text-center"><Users className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="font-medium text-gray-500">No users found</p></div>
          ) : paginatedUsers.map(user => (
            <div key={user.id} className="p-4 hover:bg-amber-50/50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold">{getInitials(user.firstName, user.lastName)}</div>
                  <div>
                    <p className="font-semibold text-gray-800">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">{user.id} • {user.role}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}>{getStatusIcon(user.status)} {user.status}</span>
              </div>
              <div className="space-y-1.5 text-sm mb-3">
                <p className="text-gray-600 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{user.email}</p>
                <p className="text-gray-600 flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{user.mobile}</p>
                <p className="text-gray-600 flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" />{user.department}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal('view', user)} className="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">View</button>
                <button onClick={() => handleOpenModal('edit', user)} className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Edit</button>
                <button onClick={() => handleOpenModal('delete', user)} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">{getInitials(selectedUser.firstName, selectedUser.lastName)}</div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedUser.firstName} {selectedUser.lastName}</h2>
                    <p className="text-amber-100">{selectedUser.role} • {selectedUser.department}</p>
                  </div>
                </div>
                <button onClick={handleCloseModal} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'User ID', value: selectedUser.id },
                  { label: 'Status', value: selectedUser.status, badge: true },
                  { label: 'Email', value: selectedUser.email },
                  { label: 'Mobile', value: selectedUser.mobile },
                  { label: 'Created On', value: selectedUser.createdAt },
                  { label: 'Last Login', value: selectedUser.lastLogin },
                ].map(({ label, value, badge }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    {badge ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${getStatusColor(value)}`}>{getStatusIcon(value)} {value}</span> : <p className="font-medium text-gray-800 text-sm">{value}</p>}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => { handleCloseModal(); handleOpenModal('edit', selectedUser); }} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-2"><Edit3 className="w-4 h-4" /> Edit</button>
                <button onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 rounded-t-2xl sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{modalType === 'add' ? 'Add New User' : 'Edit User'}</h2>
                <button onClick={handleCloseModal} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label><input type="text" value={formData.firstName || ''} onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))} className={inputClassName} required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label><input type="text" value={formData.lastName || ''} onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))} className={inputClassName} required /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" value={formData.email || ''} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className={inputClassName} required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label><input type="tel" value={formData.mobile || ''} onChange={(e) => setFormData(p => ({ ...p, mobile: e.target.value }))} className={inputClassName} required /></div>
              {modalType === 'add' && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><input type="password" value={formData.password ?? ''} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} className={inputClassName} placeholder="Min 6 characters" required minLength={6} /></div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Department *</label><select value={formData.department || ''} onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))} className={selectClassName} required><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Role *</label><select value={formData.role || ''} onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))} className={selectClassName} required disabled={roles.length === 0}><option value="">Select</option>{roles.map(r => <option key={r.role_id} value={r.role_name}>{r.role_name}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={formData.status || 'active'} onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as User['status'] }))} className={selectClassName}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50" disabled={saving}>Cancel</button>
                <button type="button" onClick={() => handleSaveUser()} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-2 disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : (modalType === 'add' ? 'Add User' : 'Save')} {modalType === 'edit' && <Save className="w-4 h-4" />}</button>
              </div>
            </div>
          </div>
        </div>
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
