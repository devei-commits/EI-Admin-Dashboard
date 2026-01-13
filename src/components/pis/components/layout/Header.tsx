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
import { Logo } from './Logo';

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
    <header className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] text-white px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 lg:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Logo />
          <p className="text-[11px] sm:text-xs text-gray-200 hidden sm:block">
            PIS Workflow Management System
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role Badge */}
        <Badge className={`${getRoleBadgeColor(currentRole)} text-white px-3 py-1 hidden md:flex items-center gap-1`}>
          <Shield className="h-3 w-3" />
          {getRoleLabel(currentRole)}
        </Badge>

        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
            3
          </Badge>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-white hover:bg-white/10 gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div className="text-left hidden md:block">
                <div className="text-sm font-medium">{currentUser?.name || 'User'}</div>
                <div className="text-xs text-gray-300">{currentUser?.email || 'Online'}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{currentUser?.name || 'User'}</span>
                <span className="text-xs text-gray-500 font-normal">{currentUser?.email}</span>
                <Badge className={`${getRoleBadgeColor(currentRole)} text-white text-xs w-fit mt-2`}>
                  {getRoleLabel(currentRole)}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem>Notifications</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Explicit logout button so every user clearly sees it */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 sm:hidden"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-xs">Logout</span>
        </Button>
      </div>
    </header>
  );
}
