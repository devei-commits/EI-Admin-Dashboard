import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../pis/components/ui/sonner';
import { TaskHeader } from './components/TaskHeader';
import { TaskSidebar } from './components/TaskSidebar';
import { TaskDashboard } from './components/TaskDashboard';
import { TaskList } from './components/TaskList';
import { TaskSettings } from './components/TaskSettings';
import { ArrowUp } from 'lucide-react';

type TaskView = 'dashboard' | 'my-tasks' | 'team-tasks' | 'all-tasks' | 'settings';

// Get current user role from localStorage
const getCurrentUserRole = (): string => {
  try {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const parsed = JSON.parse(user);
      return parsed.role || 'staff';
    }
  } catch {
    return 'staff';
  }
  return 'staff';
};

// Get current user from localStorage
const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('currentUser');
    if (user) {
      return JSON.parse(user);
    }
  } catch {
    return null;
  }
  return null;
};

function TaskAppContent() {
  const [activeView, setActiveView] = useState<TaskView>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const currentRole = getCurrentUserRole();
  const currentUser = getCurrentUser();

  // Show toast notification when Tasks opens
  useEffect(() => {
    toast.success('Tasks Tool opened successfully', {
      description: `Logged in as ${currentUser?.name || 'User'} (${currentRole})`,
      duration: 4000,
    });
  }, [currentRole, currentUser?.name]);

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

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleViewChange = (view: TaskView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render main content based on active view
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <TaskDashboard currentRole={currentRole} currentUser={currentUser} onNavigate={handleViewChange} />;
      case 'my-tasks':
        return <TaskList currentRole={currentRole} currentUser={currentUser} filter="my" />;
      case 'team-tasks':
        return <TaskList currentRole={currentRole} currentUser={currentUser} filter="team" />;
      case 'all-tasks':
        return <TaskList currentRole={currentRole} currentUser={currentUser} filter="all" />;
      case 'settings':
        return <TaskSettings />;
      default:
        return <TaskDashboard currentRole={currentRole} currentUser={currentUser} onNavigate={handleViewChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <TaskHeader 
        onMenuToggle={handleMenuToggle} 
        isSidebarOpen={isSidebarOpen}
        currentUser={currentUser}
      />

      <div className="flex">
        {/* Sidebar */}
        <TaskSidebar
          currentRole={currentRole}
          activeView={activeView}
          onViewChange={handleViewChange}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 ${
            isSidebarOpen ? 'lg:ml-64' : 'ml-0'
          }`}
        >
          <div className="p-4 md:p-6 lg:p-8 mt-16">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 bg-amber-600 text-white rounded-full shadow-lg hover:bg-amber-700 transition-all z-50"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default function TaskApp() {
  return <TaskAppContent />;
}
