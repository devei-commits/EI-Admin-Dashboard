import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PISProvider } from './context/PISContext';
import { UserRole } from './types/pis';

// Layout components
import { Header, Sidebar, ScrollToTopButton } from './components/layout';

// Dashboard & PIS management
import { ImprovedDashboard } from './components/dashboard';
import { ImprovedPISManagement, type PISManagementPreset } from './components/pis';

// Views
import { TasksView, CustomersView, ProductsView, AnalyticsView, SettingsView, NewPISView } from './components/views';

// UI
import { Toaster } from './components/ui/sonner';

// Hooks
import { scrollToTop } from './hooks/useScrollToTop';

// Map admin panel roles to PIS roles
const mapAdminRoleToPISRole = (adminRole: string): UserRole => {
  const roleMapping: Record<string, UserRole> = {
    // Admin roles
    'super admin': 'SUPER_ADMIN',
    'superadmin': 'SUPER_ADMIN',
    'super_admin': 'SUPER_ADMIN',
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'admin': 'ADMIN',
    'ADMIN': 'ADMIN',
    
    // BD roles
    'bd manager': 'BD_MANAGER',
    'bd_manager': 'BD_MANAGER',
    'BD_MANAGER': 'BD_MANAGER',
    'bd staff': 'BD_STAFF',
    'bd_staff': 'BD_STAFF',
    'BD_STAFF': 'BD_STAFF',
    
    // R&D roles
    'r&d lead': 'RND_LEAD',
    'rnd lead': 'RND_LEAD',
    'rnd_lead': 'RND_LEAD',
    'RND_LEAD': 'RND_LEAD',
    'r&d staff': 'RND_STAFF',
    'rnd staff': 'RND_STAFF',
    'rnd_staff': 'RND_STAFF',
    'RND_STAFF': 'RND_STAFF',
    
    // QA roles
    'qa manager': 'QA_MANAGER',
    'qa_manager': 'QA_MANAGER',
    'QA_MANAGER': 'QA_MANAGER',
    'qa staff': 'QA_STAFF',
    'qa_staff': 'QA_STAFF',
    'QA_STAFF': 'QA_STAFF',
    
    // Other roles
    'procurement': 'BD_STAFF',
    'manufacturing and production': 'PKG_STAFF',
    'sales': 'BD_STAFF',
    'logistics': 'PKG_STAFF',
    'design': 'PKG_STAFF',
    'packaging': 'PKG_STAFF',
    'pkg_staff': 'PKG_STAFF',
    'PKG_STAFF': 'PKG_STAFF',
    
    // Client roles
    'doctor': 'CLIENT',
    'customer': 'CLIENT',
    'client': 'CLIENT',
    'CLIENT': 'CLIENT',
  };

  const normalizedRole = adminRole.toLowerCase().trim();
  return roleMapping[normalizedRole] || roleMapping[adminRole] || 'SUPER_ADMIN';
};

// Get initial role from URL or localStorage
const getInitialRole = (): UserRole => {
  const urlParams = new URLSearchParams(window.location.search);
  const roleFromUrl = urlParams.get('role');
  
  if (roleFromUrl) {
    const mappedRole = mapAdminRoleToPISRole(roleFromUrl);
    localStorage.setItem('pisCurrentRole', mappedRole);
    return mappedRole;
  }
  
  // Check pisCurrentRole first, then adminUserRole for compatibility with admin panel
  const storedRole = localStorage.getItem('pisCurrentRole');
  if (storedRole) {
    return storedRole as UserRole;
  }
  
  // Fallback to admin panel role
  const adminRole = localStorage.getItem('adminUserRole');
  if (adminRole) {
    return mapAdminRoleToPISRole(adminRole);
  }
  
  return 'SUPER_ADMIN';
};

// Get initial view from URL parameter
const getInitialView = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  const viewFromUrl = urlParams.get('view');
  
  const validViews = ['dashboard', 'pis', 'bd-tasks', 'rnd-tasks', 'qa-tasks', 'new-pis', 'customers', 'products', 'analytics', 'settings'];
  if (viewFromUrl && validViews.includes(viewFromUrl)) {
    return viewFromUrl;
  }
  
  return 'dashboard';
};

function AppContent() {
  const [activeView, setActiveView] = useState(getInitialView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pisPreset, setPisPreset] = useState<PISManagementPreset | undefined>(undefined);
  const [currentRole] = useState<UserRole>(getInitialRole);

  // Show toast notification when PIS opens
  useEffect(() => {
    toast.success('PIS Tool opened successfully', {
      description: `Logged in as ${currentRole.replace(/_/g, ' ')}`,
      duration: 4000,
    });
  }, [currentRole]);

  // Close sidebar on mobile by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleViewChange = (view: string, preset?: Omit<PISManagementPreset, 'key'>) => {
    setActiveView(view);

    if (view === 'pis') {
      setPisPreset(preset ? { ...preset, key: Date.now() } : undefined);
    }

    scrollToTop();
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Logout function (available for future use via props)
  const _handleLogout = () => {
    localStorage.removeItem('pisCurrentRole');
    toast.info('Returning to Admin Panel...');
    setTimeout(() => {
      window.close();
      window.location.href = '/';
    }, 1000);
  };

  // Suppress unused variable warning (keeping for future functionality)
  void _handleLogout;

  // Render main content based on active view
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <ImprovedDashboard currentRole={currentRole} onNavigate={handleViewChange} />;
      case 'pis':
        return <ImprovedPISManagement currentRole={currentRole} preset={pisPreset} />;
      case 'bd-tasks':
        return (
          <TasksView
            currentRole={currentRole}
            taskType="BD"
            onOpenInPIS={(pisId) =>
              handleViewChange('pis', {
                tab: 'active',
                initialPISId: pisId,
              })
            }
          />
        );
      case 'rnd-tasks':
        return (
          <TasksView
            currentRole={currentRole}
            taskType="RND"
            onOpenInPIS={(pisId) =>
              handleViewChange('pis', {
                tab: 'active',
                initialPISId: pisId,
              })
            }
          />
        );
      case 'new-pis':
        return <NewPISView />;
      case 'qa-tasks':
        return (
          <TasksView
            currentRole={currentRole}
            taskType="QA"
            onOpenInPIS={(pisId) =>
              handleViewChange('pis', {
                tab: 'active',
                initialPISId: pisId,
              })
            }
          />
        );
      case 'packaging-tasks':
        return (
          <TasksView
            currentRole={currentRole}
            taskType="PKG"
            onOpenInPIS={(pisId) =>
              handleViewChange('pis', {
                tab: 'active',
                initialPISId: pisId,
              })
            }
          />
        );
      case 'customers':
        return <CustomersView currentRole={currentRole} />;
      case 'products':
        return <ProductsView currentRole={currentRole} />;
      case 'analytics':
        return <AnalyticsView currentRole={currentRole} />;
      case 'settings':
        return <SettingsView currentRole={currentRole} />;
      default:
        return <ImprovedDashboard currentRole={currentRole} onNavigate={handleViewChange} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar
        currentRole={currentRole}
        activeView={activeView}
        onViewChange={handleViewChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <Header
          currentRole={currentRole}
          onRoleChange={() => {}}
          onMenuToggle={handleMenuToggle}
        />
        
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
          <div className="max-w-[1920px] mx-auto">
            {renderContent()}
          </div>
        </main>

        <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-100 py-5 px-4 sm:px-6 md:px-8 text-center shadow-sm">
          <p className="text-xs sm:text-sm text-gray-500">
            Copyright © <span className="font-semibold text-gray-700">ESTHETIC INSIGHTS</span> 2024 | PIS Workflow Management System v1.0
          </p>
        </footer>
      </div>

      <Toaster position="top-right" richColors />
      <ScrollToTopButton />
    </div>
  );
}

export default function App() {
  return (
    <PISProvider>
      <AppContent />
    </PISProvider>
  );
}