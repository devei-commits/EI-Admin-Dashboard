import React, { useState, useMemo, useCallback } from 'react';
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

const ROLES = [
  'Super Admin',
  'Admin',
  'Manager',
  'Team Lead',
  'Senior Staff',
  'Staff',
  'Intern',
] as const;

// ==================== MOCK DATA ====================
const INITIAL_USERS: User[] = [
  { id: 'USR001', firstName: 'Rajesh', lastName: 'Kumar', email: 'rajesh.kumar@eisthetic.com', mobile: '+91 98765 43210', role: 'Super Admin', department: 'Administration', status: 'active', createdAt: '2024-01-15', lastLogin: '2026-01-25 09:30' },
  { id: 'USR002', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@eisthetic.com', mobile: '+91 98765 43211', role: 'Manager', department: 'Business Development', status: 'active', createdAt: '2024-02-20', lastLogin: '2026-01-25 08:15' },
  { id: 'USR003', firstName: 'Amit', lastName: 'Patel', email: 'amit.patel@eisthetic.com', mobile: '+91 98765 43212', role: 'Team Lead', department: 'Quality Assurance', status: 'active', createdAt: '2024-03-10', lastLogin: '2026-01-24 17:45' },
  { id: 'USR004', firstName: 'Neha', lastName: 'Singh', email: 'neha.singh@eisthetic.com', mobile: '+91 98765 43213', role: 'Staff', department: 'Research & Development', status: 'suspended', createdAt: '2024-04-05', lastLogin: '2026-01-20 14:20' },
  { id: 'USR005', firstName: 'Kavita', lastName: 'Desai', email: 'kavita.desai@eisthetic.com', mobile: '+91 98765 43214', role: 'Senior Staff', department: 'Design', status: 'active', createdAt: '2024-05-12', lastLogin: '2026-01-25 10:00' },
  { id: 'USR006', firstName: 'Ravi', lastName: 'Verma', email: 'ravi.verma@eisthetic.com', mobile: '+91 98765 43215', role: 'Staff', department: 'Manufacturing', status: 'inactive', createdAt: '2024-06-18', lastLogin: '2026-01-10 11:30' },
  { id: 'USR007', firstName: 'Sunita', lastName: 'Joshi', email: 'sunita.joshi@eisthetic.com', mobile: '+91 98765 43216', role: 'Manager', department: 'Procurement', status: 'active', createdAt: '2024-07-22', lastLogin: '2026-01-25 07:45' },
  { id: 'USR008', firstName: 'Anil', lastName: 'Mehta', email: 'anil.mehta@eisthetic.com', mobile: '+91 98765 43217', role: 'Team Lead', department: 'Logistics', status: 'active', createdAt: '2024-08-30', lastLogin: '2026-01-24 16:00' },
  { id: 'USR009', firstName: 'Deepa', lastName: 'Rao', email: 'deepa.rao@eisthetic.com', mobile: '+91 98765 43218', role: 'Staff', department: 'Sales', status: 'active', createdAt: '2024-09-15', lastLogin: '2026-01-25 09:00' },
  { id: 'USR010', firstName: 'Vijay', lastName: 'Iyer', email: 'vijay.iyer@eisthetic.com', mobile: '+91 98765 43219', role: 'Admin', department: 'Administration', status: 'inactive', createdAt: '2024-10-01', lastLogin: '2025-12-15 13:20' },
  { id: 'USR011', firstName: 'Meera', lastName: 'Nair', email: 'meera.nair@eisthetic.com', mobile: '+91 98765 43220', role: 'Senior Staff', department: 'Quality Assurance', status: 'active', createdAt: '2024-11-08', lastLogin: '2026-01-25 08:30' },
  { id: 'USR012', firstName: 'Kiran', lastName: 'Kulkarni', email: 'kiran.kulkarni@eisthetic.com', mobile: '+91 98765 43221', role: 'Intern', department: 'Research & Development', status: 'active', createdAt: '2025-01-05', lastLogin: '2026-01-24 15:00' },
];

// ==================== COMPONENT ====================
const UserManagement = () => {
  // State
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
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
  const [formData, setFormData] = useState<Partial<User>>({});
  const itemsPerPage = 8;

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
    setModalType(type);
    if (user) { setSelectedUser(user); setFormData({ ...user }); }
    else { setSelectedUser(null); setFormData({ status: 'active' }); }
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalType(null);
    setSelectedUser(null);
    setFormData({});
  }, []);

  const handleSaveUser = useCallback(() => {
    if (modalType === 'add') {
      const newUser: User = {
        id: `USR${String(users.length + 1).padStart(3, '0')}`,
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        email: formData.email || '',
        mobile: formData.mobile || '',
        role: formData.role || 'Staff',
        department: formData.department || 'Administration',
        status: formData.status as User['status'] || 'active',
        createdAt: new Date().toISOString().split('T')[0],
        lastLogin: 'Never',
      };
      setUsers(prev => [...prev, newUser]);
    } else if (modalType === 'edit' && selectedUser) {
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...formData } as User : u));
    }
    handleCloseModal();
  }, [modalType, formData, selectedUser, users.length, handleCloseModal]);

  const handleDeleteUser = useCallback(() => {
    if (selectedUser) {
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      handleCloseModal();
    }
  }, [selectedUser, handleCloseModal]);

  const handleToggleStatus = useCallback((user: User) => {
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u));
  }, []);

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
              { label: 'Role', value: roleFilter, setter: setRoleFilter, options: ['all', ...ROLES] },
            ].map(({ label, value, setter, options }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <select
                  value={value}
                  onChange={(e) => { setter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {options.map(o => <option key={o} value={o}>{o === 'all' ? `All ${label}s` : o}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users Table */}
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
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Department *</label><select value={formData.department || ''} onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))} className={selectClassName} required><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Role *</label><select value={formData.role || ''} onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))} className={selectClassName} required><option value="">Select</option>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={formData.status || 'active'} onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as User['status'] }))} className={selectClassName}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveUser} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {modalType === 'add' ? 'Add User' : 'Save'}</button>
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
        message={selectedUser ? (<>Are you sure you want to delete <span className="font-semibold">{selectedUser.firstName} {selectedUser.lastName}</span>? This action cannot be undone.</>) : ''}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default UserManagement;
