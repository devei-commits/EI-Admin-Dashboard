import { Menu, User, LogOut, Bell, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { UserRole } from '../../types/pis';
import { getRoleLabel } from '../../utils/permissions';
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

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: () => void;
  onMenuToggle: () => void;
}

export function Header({ currentRole, onRoleChange, onMenuToggle }: HeaderProps) {
  const { currentUser, logout } = usePIS();

  const handleLogout = () => {
    logout();
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
          <h1 className="text-lg sm:text-xl font-semibold text-gray-800" style={{ fontFamily: '"Red Hat Mono", monospace' }}>
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

        <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-100 relative rounded-xl">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium shadow-sm">
            3
          </span>
        </Button>

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

        {/* Explicit logout button so every user clearly sees it */}
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-600 hover:bg-gray-100 sm:hidden rounded-xl"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 rounded-xl shadow-sm"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-xs font-medium">Logout</span>
        </Button>
      </div>
    </header>
  );
}
