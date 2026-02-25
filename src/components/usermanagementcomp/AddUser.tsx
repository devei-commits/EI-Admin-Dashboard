import React, { useState } from 'react';
import { UnifiedButton, inputClassName, selectClassName } from '../ui';

const AddUser: React.FC = () => {
 const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  department: '',
  userRole: '',
  password: '',
  status: 'default active'
 });

 const departments = [
  'BD', 'QA', 'R&D', 'Sales', 'Packaging', 'Design', 'Procurement', 
  'Manufacturing and production', 'logistic', 'admin', 'client'
 ];

 const userRoles = [
  'BD Manager', 'BD Staff', 'QA Staff', 'QA Manager', 'R&D Lead', 'R&D Staff',
  'Sales', 'Design', 'Procurement', 'Manufacturing and Production', 'Logistics',
  'Admin', 'Super Admin', 'Doctor', 'Customer'
 ];

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // User data submission logic here
  // Reset form
  setFormData({
   firstName: '',
   lastName: '',
   email: '',
   mobile: '',
   department: '',
   userRole: '',
   password: '',
   status: 'default active'
  });
 };

 return (
  <div className="w-full max-w-2xl">
   <h2 className="text-2xl font-semibold text-gray-800 mb-6 tracking-tight">Add New User</h2>
   <form onSubmit={handleSubmit} className="space-y-8">
    <div className="grid grid-cols-1 gap-8">
     {/* First Name */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       First Name
      </label>
      <input
       type="text"
       name="firstName"
       value={formData.firstName}
       onChange={handleInputChange}
       className={inputClassName}
       required
      />
     </div>

     {/* Last Name */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Last Name
      </label>
      <input
       type="text"
       name="lastName"
       value={formData.lastName}
       onChange={handleInputChange}
       className={inputClassName}
       required
      />
     </div>

     {/* Email */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Email
      </label>
      <input
       type="email"
       name="email"
       value={formData.email}
       onChange={handleInputChange}
       className={inputClassName}
       required
      />
     </div>

     {/* Mobile */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Mobile
      </label>
      <input
       type="tel"
       name="mobile"
       value={formData.mobile}
       onChange={handleInputChange}
       className={inputClassName}
       required
      />
     </div>

     {/* Department */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Department
      </label>
      <select
       name="department"
       value={formData.department}
       onChange={handleInputChange}
       className={selectClassName}
       required
      >
       <option value="">Select Department</option>
       {departments.map((dept) => (
        <option key={dept} value={dept}>
         {dept}
        </option>
       ))}
      </select>
     </div>

     {/* User Role */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Select User Role
      </label>
      <select
       name="userRole"
       value={formData.userRole}
       onChange={handleInputChange}
       className={selectClassName}
       required
      >
       <option value="">Select User Role</option>
       {userRoles.map((role) => (
        <option key={role} value={role}>
         {role}
        </option>
       ))}
      </select>
     </div>

     {/* Password */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Password
      </label>
      <input
       type="password"
       name="password"
       value={formData.password}
       onChange={handleInputChange}
       className={inputClassName}
       required
      />
     </div>

     {/* Status */}
     <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
       Status
      </label>
      <input
       type="text"
       name="status"
       value={formData.status}
       onChange={handleInputChange}
       className="w-full px-5 py-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed leading-normal"
       readOnly
      />
     </div>
    </div>

    <div className="mt-8 pt-6">
     <UnifiedButton type="submit" variant="primary">
      Add User
     </UnifiedButton>
    </div>
   </form>
  </div>
 );
};

export default AddUser;