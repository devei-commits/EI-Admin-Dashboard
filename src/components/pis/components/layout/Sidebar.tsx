import { 
 LayoutDashboard, 
 FileText, 
 Users, 
 Package, 
 BarChart3, 
 Settings,
 ClipboardList,
 FlaskConical,
 ShieldCheck,
 BoxIcon,
 X
} from 'lucide-react';
import { UserRole } from '../../types/pis';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { usePIS } from '../../context/PISContext';
import eilogofull from '../../../../assets/logo/eilogofull.svg';

interface SidebarProps {
 currentRole: UserRole;
 activeView: string;
 onViewChange: (view: string) => void;
 isOpen: boolean;
 onClose?: () => void;
}

interface MenuItem {
 id: string;
 label: string;
 icon: typeof LayoutDashboard;
 roles: UserRole[];
}

const menuItems: MenuItem[] = [
 {
  id: 'dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  roles: ['SUPER_ADMIN', 'ADMIN', 'BD_MANAGER', 'BD_STAFF', 'RND_LEAD', 'RND_STAFF', 'QA_MANAGER', 'QA_STAFF', 'PKG_STAFF', 'CLIENT'],
 },
 {
  id: 'pis',
  label: 'PIS Management',
  icon: FileText,
  roles: ['SUPER_ADMIN', 'ADMIN', 'BD_MANAGER', 'BD_STAFF', 'RND_LEAD', 'RND_STAFF', 'QA_MANAGER', 'QA_STAFF', 'CLIENT'],
 },
 {
  id: 'new-pis',
  label: 'New PIS',
  icon: FileText,
  roles: ['SUPER_ADMIN', 'ADMIN', 'BD_MANAGER', 'CLIENT'],
 },
 {
  id: 'bd-tasks',
  label: 'BD Tasks',
  icon: ClipboardList,
  roles: ['SUPER_ADMIN', 'ADMIN', 'BD_MANAGER', 'BD_STAFF'],
 },
 {
  id: 'rnd-tasks',
  label: 'R&D Tasks',
  icon: FlaskConical,
  roles: ['SUPER_ADMIN', 'ADMIN', 'RND_LEAD', 'RND_STAFF'],
 },
 {
  id: 'qa-tasks',
  label: 'QA Tasks',
  icon: ShieldCheck,
  roles: ['SUPER_ADMIN', 'ADMIN', 'QA_MANAGER', 'QA_STAFF'],
 },
 {
  id: 'packaging-tasks',
  label: 'Packaging Tasks',
  icon: BoxIcon,
  roles: ['SUPER_ADMIN', 'ADMIN', 'PKG_STAFF'],
 },
 {
  id: 'customers',
  label: 'Customers',
  icon: Users,
  roles: ['SUPER_ADMIN', 'ADMIN'],
 },
 {
  id: 'products',
  label: 'Products',
  icon: Package,
  roles: ['SUPER_ADMIN', 'ADMIN', 'RND_LEAD', 'RND_STAFF'],
 },
 {
  id: 'analytics',
  label: 'Analytics',
  icon: BarChart3,
  roles: ['SUPER_ADMIN', 'ADMIN', 'BD_MANAGER', 'RND_LEAD', 'QA_MANAGER'],
 },
 {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  roles: ['SUPER_ADMIN', 'ADMIN'],
 },
];

export function Sidebar({ currentRole, activeView, onViewChange, isOpen, onClose }: SidebarProps) {
 const { pisRecords, currentUser } = usePIS();
 const visibleItems = menuItems.filter(item => item.roles.includes(currentRole));

 const getTaskCountsForMenu = (itemId: string): number => {
  if (!currentUser) return 0;

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  const filterByTaskType = (taskType: 'BD' | 'RND' | 'QA' | 'PKG') => {
   return pisRecords.filter((pis) => {
    switch (taskType) {
     case 'BD':
      if (isAdmin) {
       return (
        (pis.stage === 'BD_INTAKE' ||
         pis.stage === 'ALIGNMENT' ||
         pis.stage === 'CLIENT_FEEDBACK') &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      if (currentRole === 'BD_MANAGER') {
       return (
        (pis.stage === 'BD_INTAKE' ||
         pis.stage === 'ALIGNMENT' ||
         pis.stage === 'CLIENT_FEEDBACK') &&
        pis.assignedBdRole !== 'BD_STAFF' &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      if (currentRole === 'BD_STAFF') {
       return (
        (pis.stage === 'BD_INTAKE' ||
         pis.stage === 'ALIGNMENT' ||
         pis.stage === 'CLIENT_FEEDBACK') &&
        pis.assignedBdRole === 'BD_STAFF' &&
        pis.assignedBdStaffId === currentUser.id &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      return false;
     case 'RND':
      if (isAdmin) {
       return (
        (pis.stage === 'RND_LEAD_REVIEW' ||
         pis.stage === 'QUALITY_REVIEW' ||
         pis.stage === ('RND_DEVELOPMENT' as any) ||
         pis.stage === ('RND_DEVELOPMENT' as any)) &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      if (currentRole === 'RND_LEAD') {
       return (
        (pis.stage === 'RND_LEAD_REVIEW' ||
         pis.stage === 'QUALITY_REVIEW' ||
         pis.stage === ('RND_DEVELOPMENT' as any)) &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      if (currentRole === 'RND_STAFF') {
       const identities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
       const isAssignedToMe = !!pis.rndStaffAssignment && identities.includes(pis.rndStaffAssignment);
       return (
        isAssignedToMe &&
        (pis.stage === ('RND_DEVELOPMENT' as any) || pis.stage === ('RND_DEVELOPMENT' as any)) &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      return false;
     case 'QA':
      if (isAdmin || currentRole === 'QA_MANAGER' || currentRole === 'QA_STAFF') {
       return (
        pis.stage === 'QUALITY_REVIEW' &&
        (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
       );
      }
      return false;
     case 'PKG': {
      if (!(isAdmin || currentRole === 'PKG_STAFF')) return false;
      return (
       (pis.stage === 'PACKAGING' || pis.stage === 'SAMPLE_DISPATCH') &&
       (pis.status === 'PENDING' || pis.status === 'IN_PROGRESS')
      );
     }
     default:
      return false;
    }
   }).length;
  };

  switch (itemId) {
   case 'bd-tasks':
    return filterByTaskType('BD');
   case 'rnd-tasks':
    return filterByTaskType('RND');
   case 'qa-tasks':
    return filterByTaskType('QA');
   case 'packaging-tasks':
    return filterByTaskType('PKG');
   default:
    return 0;
  }
 };

 return (
  <>
   {/* Mobile overlay */}
   {isOpen && (
    <div 
     className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
     onClick={onClose}
    />
   )}
   
   {/* Sidebar */}
   <aside 
    className={cn(
     "fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-100 text-gray-700 w-72 transition-transform duration-300 ease-in-out z-50 shadow-xl flex flex-col",
     !isOpen && "-translate-x-full lg:translate-x-0"
    )}
   >
    {/* Close button for mobile */}
    <div className="lg:hidden p-4 flex justify-end border-b border-gray-100">
     <Button
      variant="ghost"
      size="icon"
      onClick={onClose}
      className="text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-xl"
     >
      <X className="h-5 w-5" />
     </Button>
    </div>

    {/* Logo Section */}
    <div className="hidden lg:flex p-6 items-center justify-center border-b border-gray-100 bg-gray-50">
     <img src={eilogofull} alt="Esthetic Insights" className="h-10 max-w-full object-contain" />
    </div>

    <nav className="flex-1 py-4 px-3 overflow-y-auto">
     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-4">Navigation</p>
     <div className="space-y-1">
     {visibleItems.map((item) => {
      const Icon = item.icon;
      const badgeCount = ['bd-tasks', 'rnd-tasks', 'qa-tasks', 'packaging-tasks'].includes(
       item.id
      )
       ? getTaskCountsForMenu(item.id)
       : 0;
      return (
       <button
        key={item.id}
        onClick={() => {
         onViewChange(item.id);
         onClose?.();
        }}
        className={cn(
         "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 rounded-xl",
         "hover:bg-gray-50 hover:text-slate-900",
         activeView === item.id 
          ? "bg-gray-50 text-slate-900 font-semibold border-l-4 border-slate-800 shadow-sm" 
          : "text-gray-600 border-l-4 border-transparent"
        )}
       >
        <div className="relative flex items-center gap-3 flex-1">
         <div className={cn(
          "p-2 rounded-lg transition-colors",
          activeView === item.id ? "bg-gray-100" : "bg-gray-100"
         )}>
          <Icon className="h-4 w-4 shrink-0" />
         </div>
         <span className="flex-1 text-left text-sm">{item.label}</span>
         {badgeCount > 0 && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium min-w-6 h-6 px-2 shadow-sm">
           {badgeCount}
          </span>
         )}
        </div>
       </button>
      );
     })}
     </div>
    </nav>

    {/* Footer */}
    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
     <p className="text-xs text-gray-400 text-center">
      © 2024 Esthetic Insights
     </p>
    </div>
   </aside>
  </>
 );
}
