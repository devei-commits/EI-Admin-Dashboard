import { Menu, Bell, Search, X } from 'lucide-react';
import eilogofull from '../../../assets/logo/eilogofull.svg';

interface TaskHeaderProps {
 onMenuToggle: () => void;
 isSidebarOpen: boolean;
 currentUser: { name?: string; role?: string } | null;
}

export function TaskHeader({ onMenuToggle, isSidebarOpen, currentUser }: TaskHeaderProps) {
 return (
  <header className="fixed top-0 left-0 right-0 h-16 bg-slate-800 shadow-lg z-50">
   <div className="flex items-center justify-between h-full px-4">
    {/* Left section */}
    <div className="flex items-center gap-4">
     <button
      onClick={onMenuToggle}
      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
     >
      {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
     </button>
     
     <div className="flex items-center gap-3">
      <img src={eilogofull} alt="EI Logo" className="h-8" />
      <div className="hidden md:block">
       <h1 className="text-lg font-bold text-white">Task Management</h1>
       <p className="text-xs text-gray-100">EI Staff Portal</p>
      </div>
     </div>
    </div>

    {/* Center - Search */}
    <div className="hidden md:flex flex-1 max-w-md mx-8">
     <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-200" />
      <input
       type="text"
       placeholder="Search tasks..."
       className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-amber-200 focus:outline-none focus:ring-2 focus:ring-white/30"
      />
     </div>
    </div>

    {/* Right section */}
    <div className="flex items-center gap-3">
     <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white">
      <Bell className="w-5 h-5" />
      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
     </button>
     
     <div className="flex items-center gap-3 pl-3 border-l border-white/20">
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">
       {currentUser?.name?.charAt(0) || 'U'}
      </div>
      <div className="hidden md:block text-right">
       <p className="text-sm font-medium text-white">{currentUser?.name || 'User'}</p>
       <p className="text-xs text-gray-100 capitalize">{currentUser?.role || 'Staff'}</p>
      </div>
     </div>
    </div>
   </div>
  </header>
 );
}
