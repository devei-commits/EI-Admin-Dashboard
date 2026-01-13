import { useEffect } from 'react';
import { toast } from 'sonner';
import { PISProvider, ImprovedPISManagement } from '../components/pis';
import { Toaster } from '../components/pis/ui/sonner';
import type { UserRole } from '../components/pis/types/pis';

interface PISProps {
  role?: UserRole;
}

const PIS: React.FC<PISProps> = ({ role = 'SUPER_ADMIN' }) => {
  useEffect(() => {
    // Show toast notification when PIS page loads
    toast.success('PIS Tool opened in new page', {
      description: 'You are now using the Product Information System',
      duration: 4000,
    });
  }, []);

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
