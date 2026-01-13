import { PISProvider, ImprovedPISManagement } from '../components/pis';
import { Toaster } from '../components/pis/ui/sonner';
import type { UserRole } from '../components/pis/types/pis';

interface PISProps {
  role?: UserRole;
}

const PIS: React.FC<PISProps> = ({ role = 'SUPER_ADMIN' }) => {
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
