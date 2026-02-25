import { useState, useEffect } from 'react';
import { UserRole } from '../../types/pis';
import { getRoleLabel } from '../../utils/permissions';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { rolesApi } from '../../utils/api';
import { 
 User, 
 Users, 
 FlaskConical, 
 ShieldCheck, 
 Package
} from 'lucide-react';
import { Logo } from '../layout/Logo';

interface RoleSelectorProps {
 onRoleSelect: (role: UserRole) => void;
 currentUserRole: UserRole | null;
}

// Map role levels to icons and colors
const roleConfig: Record<string, { icon: typeof User; color: string; defaultDescription: string }> = {
 'SUPER_ADMIN': { icon: ShieldCheck, color: 'bg-purple-700', defaultDescription: 'Super Admin console' },
 'ADMIN': { icon: User, color: 'bg-purple-500', defaultDescription: 'Full system access' },
 'BD_MANAGER': { icon: Users, color: 'bg-blue-500', defaultDescription: 'Manage BD operations' },
 'BD_STAFF': { icon: User, color: 'bg-blue-400', defaultDescription: 'Business development tasks' },
 'RND_LEAD': { icon: FlaskConical, color: 'bg-green-500', defaultDescription: 'Lead R&D projects' },
 'RND_STAFF': { icon: FlaskConical, color: 'bg-green-400', defaultDescription: 'R&D development tasks' },
 'QA_MANAGER': { icon: ShieldCheck, color: 'bg-orange-500', defaultDescription: 'Quality management' },
 'QA_STAFF': { icon: ShieldCheck, color: 'bg-orange-400', defaultDescription: 'Quality assurance tasks' },
 'PKG_STAFF': { icon: Package, color: 'bg-pink-500', defaultDescription: 'Packaging design' },
 'CLIENT': { icon: User, color: 'bg-gray-500', defaultDescription: 'View your PIS' },
};

export function RoleSelector({ onRoleSelect, currentUserRole: _currentUserRole }: RoleSelectorProps) {
 const [roles, setRoles] = useState<Array<{ role: UserRole; icon: typeof User; color: string; description: string; roleLevel: string }>>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  const fetchRoles = async () => {
   try {
    const response = await rolesApi.getAll();
    if (response.success && response.data) {
     // Filter only active roles
     const activeRoles = response.data
      .filter((r: any) => r.roleStatus === 1 && r.roleLevel)
      .map((r: any) => {
       const config = roleConfig[r.roleLevel] || { icon: User, color: 'bg-gray-500', defaultDescription: 'Access dashboard' };
       return {
        role: r.roleLevel as UserRole,
        icon: config.icon,
        color: config.color,
        description: r.description || config.defaultDescription,
        roleLevel: r.roleLevel,
       };
      })
      .sort((a, b) => {
       // Sort: SUPER_ADMIN first, then alphabetical
       if (a.role === 'SUPER_ADMIN') return -1;
       if (b.role === 'SUPER_ADMIN') return 1;
       return a.role.localeCompare(b.role);
      });
     setRoles(activeRoles);
    }
   } catch (error) {
    console.error('Error fetching roles:', error);
    // Fallback to default roles if API fails
    setRoles([
     { role: 'SUPER_ADMIN', icon: ShieldCheck, color: 'bg-purple-700', description: 'Super Admin console', roleLevel: 'SUPER_ADMIN' },
     { role: 'ADMIN', icon: User, color: 'bg-purple-500', description: 'Full system access', roleLevel: 'ADMIN' },
     { role: 'BD_MANAGER', icon: Users, color: 'bg-blue-500', description: 'Manage BD operations', roleLevel: 'BD_MANAGER' },
     { role: 'BD_STAFF', icon: User, color: 'bg-blue-400', description: 'Business development tasks', roleLevel: 'BD_STAFF' },
     { role: 'RND_LEAD', icon: FlaskConical, color: 'bg-green-500', description: 'Lead R&D projects', roleLevel: 'RND_LEAD' },
     { role: 'RND_STAFF', icon: FlaskConical, color: 'bg-green-400', description: 'R&D development tasks', roleLevel: 'RND_STAFF' },
     { role: 'QA_MANAGER', icon: ShieldCheck, color: 'bg-orange-500', description: 'Quality management', roleLevel: 'QA_MANAGER' },
     { role: 'QA_STAFF', icon: ShieldCheck, color: 'bg-orange-400', description: 'Quality assurance tasks', roleLevel: 'QA_STAFF' },
     { role: 'PKG_STAFF', icon: Package, color: 'bg-pink-500', description: 'Packaging design', roleLevel: 'PKG_STAFF' },
     { role: 'CLIENT', icon: User, color: 'bg-gray-500', description: 'View your PIS', roleLevel: 'CLIENT' },
    ]);
   } finally {
    setLoading(false);
   }
  };

  fetchRoles();
 }, []);
 return (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
   <Card className="max-w-5xl w-full p-8 md:p-12 shadow-2xl border-0 animate-fade-in">
    <div className="text-center mb-10">
     <div className="flex justify-center mb-2">
      <Logo className="h-16 md:h-20 w-auto object-contain" />
     </div>
     <h1 className="text-4xl mb-3 text-black font-bold">
      PIS Workflow Management System
     </h1>
     <p className="text-gray-600 text-lg">Select your role to access the dashboard</p>
    </div>

    {loading ? (
     <div className="text-center py-12">
      <p className="text-gray-600">Loading roles...</p>
     </div>
    ) : roles.length === 0 ? (
     <div className="text-center py-12">
      <p className="text-gray-600">No roles available</p>
     </div>
    ) : (
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map(({ role, icon: Icon, color, description }) => (
       <Button
        key={role}
        onClick={() => onRoleSelect(role)}
        variant="outline"
        className="h-auto p-6 flex flex-col items-center gap-3 hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 hover:border-blue-400 group"
       >
        <div className={`${color} text-white p-4 rounded-xl shadow-md group-hover:shadow-lg transition-shadow`}>
         <Icon className="h-8 w-8" />
        </div>
        <div className="text-center">
         <span className="text-base font-medium block">{getRoleLabel(role)}</span>
         <span className="text-xs text-gray-500 mt-1 block">{description}</span>
        </div>
       </Button>
      ))}
     </div>
    )}

    <div className="mt-10 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
     <div className="flex items-start gap-3">
      <div className="bg-blue-600 text-white p-2 rounded-lg mt-1">
       <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="flex-1">
       <p className="font-medium text-gray-900 mb-1">Role-Based Access Control</p>
       <p className="text-sm text-gray-700">
        Each role has specific permissions and access levels according to the PIS workflow requirements. 
        Your dashboard will display only the features and data relevant to your role.
       </p>
      </div>
     </div>
    </div>
   </Card>
  </div>
 );
}
