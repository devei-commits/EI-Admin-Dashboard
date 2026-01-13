import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PISProvider, usePIS } from './context/PISContext';

// Auth components
import { Login, WaitingForRole } from './components/auth';

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

function AppContent() {
  const { currentRole, setCurrentRole, isAuthenticated, login, signup, logout, currentUser, hasInitializedSession } = usePIS();
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pisPreset, setPisPreset] = useState<PISManagementPreset | undefined>(undefined);

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

  // Show toast notification when PIS opens
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      toast.success('PIS Tool opened in new page', {
        description: 'Welcome to the Product Information System',
        duration: 4000,
      });
    }
  }, [isAuthenticated, currentUser]);

  // Automatically set role based on user's assigned role (no role selector)
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.role) return;
    // Always use the user's assigned role - no role switching
    if (currentRole !== currentUser.role) {
      setCurrentRole(currentUser.role);
      // Reset to dashboard when role is set
      setActiveView('dashboard');
      scrollToTop();
    }
  }, [isAuthenticated, currentUser?.role, currentRole, setCurrentRole]);

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleViewChange = (view: string, preset?: Omit<PISManagementPreset, 'key'>) => {
    setActiveView(view);

    if (view === 'pis') {
      // Set preset with key if provided, otherwise clear preset
      setPisPreset(preset ? { ...preset, key: Date.now() } : undefined);
    }

    scrollToTop();
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Show loading screen while checking authentication
  if (!hasInitializedSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication flow
  if (!isAuthenticated) {
    return <Login onLogin={login} onSignup={signup} />;
  }

  // User signed up but waiting for role assignment
  if (currentUser && currentUser.status === 'PENDING') {
    return <WaitingForRole onLogout={logout} />;
  }

  // Safety: authenticated but role not yet set - wait for role to be set
  if (!currentRole || !currentUser?.role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

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
        return <ImprovedDashboard currentRole={currentRole} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
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
        
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-[1920px] mx-auto">
            {renderContent()}
          </div>
        </main>

        <footer className="bg-white border-t py-4 px-3 sm:px-4 md:px-6 text-center text-xs sm:text-sm text-gray-600">
          Copyright © ESTHETICINSIGHTS 2024 | PIS Workflow Management System v1.0
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