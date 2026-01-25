import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  ListChecks,
  Settings,
  X
} from 'lucide-react';
import eilogofull from '../../../assets/logo/eilogofull.svg';

interface TaskSidebarProps {
  currentRole: string;
  activeView: string;
  onViewChange: (view: 'dashboard' | 'my-tasks' | 'team-tasks' | 'all-tasks' | 'settings') => void;
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: 'dashboard' | 'my-tasks' | 'team-tasks' | 'all-tasks' | 'settings';
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  badge?: number;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['super admin', 'admin', 'manager', 'team-lead', 'staff', 'viewer'],
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    icon: ClipboardList,
    roles: ['super admin', 'admin', 'manager', 'team-lead', 'staff'],
  },
  {
    id: 'team-tasks',
    label: 'Team Tasks',
    icon: Users,
    roles: ['super admin', 'admin', 'manager', 'team-lead'],
  },
  {
    id: 'all-tasks',
    label: 'All Tasks',
    icon: ListChecks,
    roles: ['super admin', 'admin'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['super admin', 'admin'],
  },
];

export function TaskSidebar({ currentRole, activeView, onViewChange, isOpen, onClose }: TaskSidebarProps) {
  const normalizedRole = currentRole.toLowerCase();
  const visibleItems = menuItems.filter(item => 
    item.roles.some(role => role.toLowerCase() === normalizedRole)
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-amber-200 shadow-xl z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-amber-100 lg:hidden"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* Logo Section */}
        <div className="p-4 border-b border-amber-200">
          <img src={eilogofull} alt="EI Logo" className="h-8" />
          <p className="text-xs text-amber-600 mt-1 font-medium">Task Management System</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-amber-200 bg-gradient-to-t from-amber-50 to-white">
          <div className="text-center">
            <p className="text-xs text-gray-500">Task Management v1.0</p>
            <p className="text-xs text-amber-600 font-medium">© Eisthetic Industries</p>
          </div>
        </div>
      </aside>
    </>
  );
}
