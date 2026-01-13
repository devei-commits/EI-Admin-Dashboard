import { useState, useMemo } from 'react';
import { Menu, User, LogOut, Bell, Shield, FileText, Clock, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { UserRole, PISRecord } from '../../types/pis';
import { getRoleLabel, getStageLabel } from '../../utils/permissions';
import { usePIS } from '../../context/PISContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';

interface Notification {
  id: string;
  type: 'pending' | 'progress' | 'completed' | 'alert';
  title: string;
  description: string;
  time: string;
  pisId?: string;
}

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: () => void;
  onMenuToggle: () => void;
}

export function Header({ currentRole, onRoleChange, onMenuToggle }: HeaderProps) {
  const { currentUser, logout, pisRecords } = usePIS();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
  };

  // Generate real notifications from PIS records
  const notifications = useMemo((): Notification[] => {
    const notifs: Notification[] = [];
    const now = new Date();
    
    // Get pending tasks for current role
    const pendingPIS = pisRecords.filter(pis => pis.status === 'PENDING');
    const inProgressPIS = pisRecords.filter(pis => pis.status === 'IN_PROGRESS');
    const recentlyCompleted = pisRecords.filter(pis => {
      if (pis.status !== 'COMPLETED') return false;
      const updated = new Date(pis.updatedAt);
      const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    // Add pending notifications
    pendingPIS.slice(0, 3).forEach((pis, idx) => {
      notifs.push({
        id: `pending-${pis.id}`,
        type: 'pending',
        title: 'Pending Review',
        description: `${pis.pisCode} - ${pis.customerName || 'Unknown Customer'} awaits action`,
        time: formatTimeAgo(pis.updatedAt),
        pisId: pis.id,
      });
    });

    // Add in-progress notifications
    inProgressPIS.slice(0, 2).forEach((pis, idx) => {
      notifs.push({
        id: `progress-${pis.id}`,
        type: 'progress',
        title: 'In Progress',
        description: `${pis.pisCode} at ${getStageLabel(pis.stage)}`,
        time: formatTimeAgo(pis.updatedAt),
        pisId: pis.id,
      });
    });

    // Add completed notifications
    recentlyCompleted.slice(0, 2).forEach((pis, idx) => {
      notifs.push({
        id: `completed-${pis.id}`,
        type: 'completed',
        title: 'Completed',
        description: `${pis.pisCode} has been completed`,
        time: formatTimeAgo(pis.updatedAt),
        pisId: pis.id,
      });
    });

    return notifs.slice(0, 6);
  }, [pisRecords]);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'progress': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'alert': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-500';
      case 'ADMIN':
        return 'bg-indigo-500';
      case 'BD_MANAGER':
      case 'BD_STAFF':
        return 'bg-blue-500';
      case 'RND_LEAD':
      case 'RND_STAFF':
        return 'bg-green-500';
      case 'QA_MANAGER':
      case 'QA_STAFF':
        return 'bg-orange-500';
      case 'PKG_STAFF':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const unreadCount = notifications.length;

  return (
    <header className="bg-white border-b border-gray-100 text-gray-800 px-4 sm:px-6 md:px-8 py-4 flex items-center justify-between gap-4 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-600 hover:bg-gray-100 hover:text-gray-800 lg:hidden rounded-xl"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-800" style={{ fontFamily: '"Archivo", sans-serif' }}>
            PIS Management System
          </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Role Badge */}
        <Badge className={`${getRoleBadgeColor(currentRole)} text-white px-3 py-1.5 hidden md:flex items-center gap-1.5 rounded-full shadow-md`}>
          <Shield className="h-3.5 w-3.5" />
          {getRoleLabel(currentRole)}
        </Badge>

        {/* Notifications Dropdown */}
        <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-100 relative rounded-xl">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 sm:w-96 rounded-xl shadow-xl border-gray-100 p-0 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              <Badge className="bg-amber-100 text-amber-700 rounded-full text-xs">
                {unreadCount} new
              </Badge>
            </div>
            <div className="overflow-y-auto max-h-[50vh]">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 truncate">{notif.title}</p>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{notif.time}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <Button variant="ghost" className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-sm rounded-lg">
                  View all notifications
                </Button>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-gray-600 hover:bg-gray-100 gap-2 rounded-xl px-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="text-left hidden md:block">
                <div className="text-sm font-medium text-gray-800">{currentUser?.name || 'User'}</div>
                <div className="text-xs text-gray-500">{currentUser?.email || 'Online'}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-xl border-gray-100 p-2">
            <DropdownMenuLabel className="px-3 py-3">
              <div className="flex flex-col">
                <span className="font-semibold text-gray-800">{currentUser?.name || 'User'}</span>
                <span className="text-xs text-gray-500 font-normal mt-0.5">{currentUser?.email}</span>
                <Badge className={`${getRoleBadgeColor(currentRole)} text-white text-xs w-fit mt-3 rounded-full`}>
                  {getRoleLabel(currentRole)}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem className="rounded-lg px-3 py-2.5 cursor-pointer">Profile Settings</DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg px-3 py-2.5 cursor-pointer">Notifications</DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg px-3 py-2.5 cursor-pointer">Preferences</DropdownMenuItem>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
