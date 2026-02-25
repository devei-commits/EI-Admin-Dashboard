import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../pis/components/ui/sonner';
import { GlobalTaskOverview } from './components/GlobalTaskOverview.tsx';
import { ArrowUp, Layers, Bell, User, LogOut, Settings } from 'lucide-react';
import eilogofull from '../../assets/logo/eilogofull.svg';

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
 const [showScrollTop, setShowScrollTop] = useState(false);
 const [showUserMenu, setShowUserMenu] = useState(false);
 const currentUser = getCurrentUser();

 // Show toast notification when Tasks opens
 useEffect(() => {
  toast.success('Task Management opened', {
   description: 'Global task overview loaded successfully',
   duration: 3000,
  });
 }, []);

 // Scroll to top button visibility
 useEffect(() => {
  const handleScroll = () => {
   setShowScrollTop(window.scrollY > 300);
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
 }, []);

 const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
 };

 return (
  <div className="min-h-screen bg-gray-50">
   <Toaster position="top-right" />
   
   {/* Header */}
   <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 shadow-sm z-40">
    <div className="h-full px-4 md:px-6 flex items-center justify-between">
     {/* Left side - Logo and Title */}
     <div className="flex items-center gap-4">
      <img src={eilogofull} alt="EI Logo" className="h-8 w-auto" />
      <div className="hidden md:block h-8 w-px bg-gray-200" />
      <div className="hidden md:flex items-center gap-2">
       <Layers className="w-5 h-5 text-slate-800" />
       <span className="font-semibold text-gray-800">Task Management</span>
      </div>
     </div>

     {/* Right side - User menu */}
     <div className="flex items-center gap-3">
      {/* Notifications */}
      <button className="relative p-2 text-gray-500 hover:text-slate-800 hover:bg-gray-50 rounded-lg transition-colors">
       <Bell className="w-5 h-5" />
       <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* User Menu */}
      <div className="relative">
       <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
       >
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-medium text-sm">
         {currentUser?.name?.charAt(0) || 'U'}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700">
         {currentUser?.name || 'User'}
        </span>
       </button>

       {showUserMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
         <div className="px-4 py-2 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">{currentUser?.name || 'User'}</p>
          <p className="text-xs text-gray-500">{currentUser?.email || 'user@example.com'}</p>
         </div>
         <button className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
          <User className="w-4 h-4" />
          Profile
         </button>
         <button className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Settings
         </button>
         <div className="border-t border-gray-100 mt-1 pt-1">
          <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
           <LogOut className="w-4 h-4" />
           Sign Out
          </button>
         </div>
        </div>
       )}
      </div>
     </div>
    </div>
   </header>

   {/* Close user menu on outside click */}
   {showUserMenu && (
    <div 
     className="fixed inset-0 z-30" 
     onClick={() => setShowUserMenu(false)}
    />
   )}

   {/* Main Content - Full width, no sidebar */}
   <main className="pt-16">
    <div className="p-4 md:p-6 lg:p-8">
     <GlobalTaskOverview />
    </div>
   </main>

   {/* Scroll to Top Button */}
   {showScrollTop && (
    <button
     onClick={scrollToTop}
     className="fixed bottom-6 right-6 p-3 bg-slate-800 text-white rounded-full shadow-lg hover:bg-slate-900 transition-all z-50"
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
