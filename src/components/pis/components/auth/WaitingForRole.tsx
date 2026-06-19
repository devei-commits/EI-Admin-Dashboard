import { useEffect, useState } from 'react';
import { Clock, LogOut, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { usePIS } from '../../context/PISContext';
import { getRoleLabel } from '../../utils/permissions';

interface WaitingForRoleProps {
 onLogout: () => void;
}

export function WaitingForRole({ onLogout }: WaitingForRoleProps) {
 const { currentUser, systemUsers, setCurrentRole } = usePIS();
 const [isChecking, setIsChecking] = useState(false);
 const [roleAssigned, setRoleAssigned] = useState(false);
 const [assignedRole, setAssignedRole] = useState<string | null>(null);

 // Real-time polling to check if role was assigned
 useEffect(() => {
  const checkRoleStatus = () => {
   if (!currentUser) return;
   
   // Find the current user in the system users list
   const updatedUser = systemUsers.find(u => u.id === currentUser.id);
   
   if (updatedUser && updatedUser.role && updatedUser.status === 'ACTIVE') {
    setRoleAssigned(true);
    setAssignedRole(updatedUser.role);
    // Auto-redirect after showing success message
    setTimeout(() => {
     setCurrentRole(updatedUser.role);
    }, 2000);
   }
  };

  // Check immediately
  checkRoleStatus();

  // Poll every 3 seconds for real-time updates
  // Polling disabled intentionally to reduce background traffic.

  // Listen for localStorage changes (cross-tab sync)
  const handleStorageChange = (e: StorageEvent) => {
   if (e.key === 'pis_system_users') {
    checkRoleStatus();
   }
  };
  window.addEventListener('storage', handleStorageChange);

  return () => {
   window.removeEventListener('storage', handleStorageChange);
  };
 }, [currentUser, systemUsers, setCurrentRole]);

 const handleManualCheck = () => {
  setIsChecking(true);
  // Force re-read from localStorage
  window.location.reload();
 };

 // Show success state when role is assigned
 if (roleAssigned && assignedRole) {
  return (
   <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="max-w-lg w-full p-8 md:p-12 shadow-2xl border-0 text-center">
     <div className="flex justify-center mb-6">
      <div className="relative">
       <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20" />
       <div className="relative w-24 h-24 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
        <CheckCircle className="h-12 w-12 text-white" />
       </div>
      </div>
     </div>

     <h1 className="text-3xl font-bold text-gray-900 mb-3">
      Role Assigned!
     </h1>

     <p className="text-gray-600 mb-4">
      You have been assigned the role of:
     </p>

     <div className="bg-green-100 text-green-800 px-6 py-3 rounded-full inline-block font-semibold text-lg mb-6">
      {getRoleLabel(assignedRole as any)}
     </div>

     <p className="text-sm text-gray-500">
      Redirecting you to the dashboard...
     </p>

     <div className="mt-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
     </div>
    </Card>
   </div>
  );
 }

 return (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
   <Card className="max-w-lg w-full p-8 md:p-12 shadow-2xl border-0 text-center">
    {/* Animated Clock Icon */}
    <div className="flex justify-center mb-6">
     <div className="relative">
      <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20" />
      <div className="relative w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center shadow-lg">
       <Clock className="h-12 w-12 text-white" />
      </div>
     </div>
    </div>

    {/* Title */}
    <h1 className="text-3xl font-bold text-gray-900 mb-3">
     Waiting for Role Assignment
    </h1>

    {/* User Info */}
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
     <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
      <Mail className="h-4 w-4" />
      <span className="font-medium">{currentUser?.email}</span>
     </div>
     <p className="text-sm text-gray-500">
      Welcome, <span className="font-semibold text-gray-700">{currentUser?.name}</span>
     </p>
    </div>

    {/* Message */}
    <div className="space-y-4 mb-8">
     <p className="text-gray-600 leading-relaxed">
      Your account has been created successfully! A <strong>Super Admin</strong> will review your request and assign an appropriate role to your account.
     </p>
     
     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
      <ul className="text-sm text-blue-800 text-left space-y-2">
       <li className="flex items-start gap-2">
        <span className="text-blue-500 font-bold">1.</span>
        <span>Your account is being reviewed by the administration team</span>
       </li>
       <li className="flex items-start gap-2">
        <span className="text-blue-500 font-bold">2.</span>
        <span>A Super Admin will assign you a role based on your department</span>
       </li>
       <li className="flex items-start gap-2">
        <span className="text-blue-500 font-bold">3.</span>
        <span>Once assigned, you'll have access to the PIS system</span>
       </li>
      </ul>
     </div>

     <p className="text-sm text-gray-500">
      Please check back later or contact your administrator if you have any questions.
     </p>
    </div>

    {/* Status Indicator */}
    <div className="flex items-center justify-center gap-2 mb-8">
     <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-amber-800 rounded-full text-sm font-medium">
      <span className="relative flex h-2 w-2">
       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
       <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-800"></span>
      </span>
      Status: Pending Approval
     </div>
    </div>

    {/* Actions */}
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
     <Button
      onClick={handleManualCheck}
      variant="outline"
      className="flex items-center gap-2"
      disabled={isChecking}
     >
      <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
      {isChecking ? 'Checking...' : 'Check Status'}
     </Button>
     <Button
      onClick={onLogout}
      variant="ghost"
      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
     >
      <LogOut className="h-4 w-4" />
      Logout
     </Button>
    </div>

    {/* Auto-check indicator */}
    <div className="mt-4 text-xs text-gray-400">
     Auto-checking every 3 seconds...
    </div>

    {/* Contact Info */}
    <div className="mt-8 pt-6 border-t">
     <p className="text-xs text-gray-500">
      Need immediate access? Contact your administrator at{' '}
      <a href="mailto:admin@eisthetic.com" className="text-blue-600 hover:underline">
       admin@eisthetic.com
      </a>
     </p>
    </div>
   </Card>
  </div>
 );
}
