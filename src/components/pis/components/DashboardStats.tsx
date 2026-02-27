import { Card } from './ui/card';
import { 
 FileText, 
 Clock, 
 CheckCircle, 
 XCircle,
 AlertCircle,
 TrendingUp
} from 'lucide-react';
import { PISRecord, UserRole } from '../types/pis';
import { usePIS } from '../context/PISContext';
import type { PISManagementPreset } from './ImprovedPISManagement';

interface DashboardStatsProps {
 data: PISRecord[];
 currentRole: UserRole;
 onNavigate?: (view: string, preset?: Omit<PISManagementPreset, 'key'>) => void;
 onPendingClick?: () => void;
}

const isManagerRole = (role: UserRole): boolean => {
 return (
  role === 'SUPER_ADMIN' ||
  role === 'ADMIN' ||
  role === 'BD_MANAGER' ||
  role === 'RND_LEAD' ||
  role === 'QA_MANAGER'
 );
};

const isStaffRole = (role: UserRole): boolean => {
 return (
  role === 'BD_STAFF' ||
  role === 'RND_STAFF' ||
  role === 'QA_STAFF' ||
  role === 'PKG_STAFF'
 );
};

const getTasksViewForRole = (role: UserRole): string | null => {
 switch (role) {
  case 'BD_MANAGER':
  case 'BD_STAFF':
   return 'bd-tasks';
  case 'RND_LEAD':
  case 'RND_STAFF':
   return 'rnd-tasks';
  case 'QA_MANAGER':
  case 'QA_STAFF':
   return 'qa-tasks';
  case 'PKG_STAFF':
   return 'packaging-tasks';
  default:
   return null;
 }
};

export function DashboardStats({ data, currentRole, onPendingClick, onNavigate }: DashboardStatsProps) {
 const { currentUser } = usePIS();

 // Log for debugging CLIENT dashboard
 if (currentRole === 'CLIENT' && import.meta.env.NODE_ENV === 'development') {
 }

 // SUPER_ADMIN and ADMIN see all PIS records (no filtering)
 const isAdminView = (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN');
 
 const isStaffView = isStaffRole(currentRole) && !!currentUser;
 const isClientView = currentRole === 'CLIENT' && !!currentUser;

 // For CLIENT users: data is already filtered by backend via ClientPIS table
 // No additional frontend filtering needed - use data directly
 // For admin roles, use all data; for staff, apply role-based filtering
 const roleScopedData = isAdminView
  ? data // Admins see all
  : isClientView
  ? data // CLIENT: Backend already filtered, use data as-is
  : (isStaffView
   ? data.filter((p) => {
     if (!currentUser) return false;
     switch (currentRole) {
      case 'BD_STAFF':
       return (
        p.assignedBdRole === 'BD_STAFF' &&
        p.assignedBdStaffId === currentUser.id
       );
      case 'RND_STAFF': {
       if (!p.rndStaffAssignment) return false;
       const identities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
       return identities.includes(p.rndStaffAssignment);
      }
      case 'QA_STAFF': {
       if (!p.qaAssignment) return false;
       const identities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
       return identities.includes(p.qaAssignment);
      }
      case 'PKG_STAFF': {
       const identities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
       return (
        (p.pkgDesignAssignment && identities.includes(p.pkgDesignAssignment)) ||
        (p.pkgProductSubmission && identities.includes(p.pkgProductSubmission)) ||
        (p.pkgLabelSubmission && identities.includes(p.pkgLabelSubmission)) ||
        (p.sampleDispatchPreparation && identities.includes(p.sampleDispatchPreparation))
       );
      }
      default:
       return false;
     }
    })
   : data);

 // Calculate stats from the role-scoped data (already filtered correctly)
 const totalPIS = roleScopedData.length;
 const inProgress = roleScopedData.filter(p => p.status === 'IN_PROGRESS').length;
 const completed = roleScopedData.filter(p => p.status === 'COMPLETED').length;

 // For Super Admin and Admin, "My PIS" shows all active PIS (they see all records)
 // For other roles, "My PIS" shows their scoped active PIS
 const myPISData = roleScopedData;

 const pending = roleScopedData.filter(p => p.status === 'PENDING').length;
 const rejected = roleScopedData.filter(p => p.status === 'REJECTED' || p.status === 'TERMINATED').length;
 const myPISPending = myPISData.filter(p => p.status === 'PENDING').length;
 const myPISInProgress = myPISData.filter(p => p.status === 'IN_PROGRESS').length;
 const myPISTotalActive = myPISPending + myPISInProgress;
 const myOrders = myPISData.filter(p => p.convertedToOrder && !!p.orderReference).length;
 
 // Role-specific stats - "My Queries" shows PIS in relevant stages for each role
 const myTasks = roleScopedData.filter(p => {
  switch (currentRole) {
   case 'SUPER_ADMIN':
   case 'ADMIN':
    // Admins see all PIS in any stage (they have access to all)
    return true;
   case 'BD_MANAGER':
   case 'BD_STAFF':
    return p.stage === 'BD_INTAKE' || p.stage === 'ALIGNMENT' || p.stage === 'AGREEMENT' || p.stage === 'WAY_FORWARD';
   case 'RND_LEAD':
    return p.stage === 'ALIGNMENT' || p.stage === 'AGREEMENT' || p.stage === 'RND_LEAD_REVIEW' || p.stage === 'RND_DEVELOPMENT' || p.stage === 'QUALITY_REVIEW';
   case 'RND_STAFF':
    return p.stage === 'RND_DEVELOPMENT' || p.stage === 'QUALITY_REVIEW';
   case 'QA_MANAGER':
   case 'QA_STAFF':
    return p.stage === 'QUALITY_REVIEW' || p.stage === 'WAY_FORWARD';
   case 'PKG_STAFF':
    return p.stage === 'PACKAGING' || p.stage === 'QUALITY_REVIEW';
   case 'CLIENT':
    // Clients see PIS that need their action
    return p.stage === 'WAY_FORWARD' || p.stage === 'ON_HOLD';
   default:
    return false;
  }
 }).length;

 const stats = [
  {
   title: 'My PIS',
   value: myPISTotalActive,
   icon: FileText,
   color: 'bg-indigo-500',
   textColor: 'text-indigo-600',
   action:
    onNavigate && getTasksViewForRole(currentRole)
     ? () => onNavigate(getTasksViewForRole(currentRole) as string)
     : undefined,
  },
  {
   title: 'My Orders',
   value: myOrders,
   icon: CheckCircle,
   color: 'bg-emerald-500',
   textColor: 'text-emerald-600',
   action: onNavigate
    ? () =>
      onNavigate('pis', {
       tab: 'completed',
       filters: {
        status: 'all',
        showCompleted: true,
       },
      })
    : undefined,
  },
  {
   title: 'My Queries',
   value: myTasks,
   icon: AlertCircle,
   color: 'bg-rose-500',
   textColor: 'text-rose-600',
   action:
    onNavigate && getTasksViewForRole(currentRole)
     ? () => onNavigate(getTasksViewForRole(currentRole) as string)
     : undefined,
  },
  {
   title: 'Total PIS',
   value: totalPIS,
   icon: FileText,
   color: 'bg-blue-500',
   textColor: 'text-blue-600',
   action: onNavigate
    ? () =>
      onNavigate('pis', {
       tab: 'all',
       filters: {
        status: 'all',
        stage: 'all',
        customer: 'all',
        bdTeam: 'all',
        rndTeam: 'all',
        searchTerm: '',
        dateFrom: '',
        dateTo: '',
        showCompleted: true,
       },
      })
    : undefined,
  },
  {
   title: 'In Progress',
   value: inProgress,
   icon: Clock,
   color: 'bg-yellow-500',
   textColor: 'text-yellow-600',
   action: onNavigate
    ? () =>
      onNavigate('pis', {
       tab: 'active',
       filters: {
        status: 'IN_PROGRESS',
        showCompleted: false,
       },
      })
    : undefined,
  },
  {
   title: 'Completed',
   value: completed,
   icon: CheckCircle,
   color: 'bg-green-500',
   textColor: 'text-green-600',
   action: onNavigate
    ? () =>
      onNavigate('pis', {
       tab: 'completed',
       filters: {
        status: 'all',
        showCompleted: true,
       },
      })
    : undefined,
  },
  {
   title: 'Rejected',
   value: rejected,
   icon: XCircle,
   color: 'bg-red-500',
   textColor: 'text-red-600',
   action: onNavigate
    ? () =>
      onNavigate('pis', {
       tab: 'all',
       filters: {
        status: 'all',
        showCompleted: true,
       },
       mode: 'rejected',
      })
    : undefined,
  },
  {
   title: 'My Tasks',
   value: myTasks,
   icon: TrendingUp,
   color: 'bg-purple-500',
   textColor: 'text-purple-600',
   action:
    onNavigate && getTasksViewForRole(currentRole)
     ? () => onNavigate(getTasksViewForRole(currentRole) as string)
     : undefined,
  },
  {
   title: 'Pending',
   value: pending,
   icon: AlertCircle,
   color: 'bg-orange-500',
   textColor: 'text-slate-800',
   action: onPendingClick ?? (onNavigate && getTasksViewForRole(currentRole)
    ? () => onNavigate(getTasksViewForRole(currentRole) as string)
    : undefined),
  },
 ];

 return (
  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
   {(isManagerRole(currentRole)
    ? stats
    : stats.filter((stat) =>
      stat.title === 'My PIS' ||
      stat.title === 'My Orders' ||
      stat.title === 'My Queries' ||
      stat.title === 'My Tasks' ||
      stat.title === 'Rejected' ||
      stat.title === 'Pending'
     )
   ).map((stat) => {
    const Icon = stat.icon;
    const clickable = typeof stat.action === 'function';
    return (
     <Card
      key={stat.title}
      className={`p-3 sm:p-4 md:p-6 hover:shadow-lg transition-shadow ${clickable ? 'cursor-pointer' : ''}`}
      onClick={clickable ? stat.action : undefined}
     >
      <div className="flex items-center justify-between gap-2">
       <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1 truncate">{stat.title}</p>
        <p className={`text-xl sm:text-2xl md:text-3xl font-semibold ${stat.textColor}`}>{stat.value}</p>
       </div>
       <div className={`${stat.color} p-2 sm:p-2.5 md:p-3 rounded-lg shrink-0`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
       </div>
      </div>
     </Card>
    );
   })}
  </div>
 );
}
