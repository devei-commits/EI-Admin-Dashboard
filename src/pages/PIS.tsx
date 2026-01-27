import { PISProvider } from '../components/pis/context/PISContext';
import { ImprovedPISManagement } from '../components/pis/components/pis';
import { Toaster } from '../components/pis/components/ui/sonner';
import type { UserRole } from '../components/pis/types/pis';

// Map admin panel roles to PIS roles
const mapAdminRoleToPISRole = (adminRole: string): UserRole => {
  const roleMapping: Record<string, UserRole> = {
    'super admin': 'SUPER_ADMIN',
    'superadmin': 'SUPER_ADMIN',
    'super_admin': 'SUPER_ADMIN',
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'admin': 'ADMIN',
    'ADMIN': 'ADMIN',
    'bd manager': 'BD_MANAGER',
    'bd_manager': 'BD_MANAGER',
    'BD_MANAGER': 'BD_MANAGER',
    'bd staff': 'BD_STAFF',
    'bd_staff': 'BD_STAFF',
    'BD_STAFF': 'BD_STAFF',
    'r&d lead': 'RND_LEAD',
    'rnd lead': 'RND_LEAD',
    'rnd_lead': 'RND_LEAD',
    'RND_LEAD': 'RND_LEAD',
    'r&d staff': 'RND_STAFF',
    'rnd staff': 'RND_STAFF',
    'rnd_staff': 'RND_STAFF',
    'RND_STAFF': 'RND_STAFF',
    'qa manager': 'QA_MANAGER',
    'qa_manager': 'QA_MANAGER',
    'QA_MANAGER': 'QA_MANAGER',
    'qa staff': 'QA_STAFF',
    'qa_staff': 'QA_STAFF',
    'QA_STAFF': 'QA_STAFF',
  };

  const normalizedRole = adminRole.toLowerCase().trim();
  return roleMapping[normalizedRole] || roleMapping[adminRole] || 'SUPER_ADMIN';
};

const PIS: React.FC = () => {
  // Get role from localStorage or default to SUPER_ADMIN
  const storedRole = localStorage.getItem('adminUserRole') || 'SUPER_ADMIN';
  const role = mapAdminRoleToPISRole(storedRole);

  return (
    <PISProvider>
      <div className="w-full min-h-screen bg-gray-50/50">
        <ImprovedPISManagement currentRole={role} />
        <Toaster position="top-right" richColors />
      </div>
    </PISProvider>
  );
};

export default PIS;
