import React, { useState } from 'react';
import eilogofull from '../assets/logo/eilogofull.svg';

interface WarehouseSidebarProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

const WarehouseSidebar: React.FC<WarehouseSidebarProps> = ({
  activeSection,
  onSectionChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'locations', label: 'Locations', icon: '📍' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'inbound', label: 'Inbound', icon: '📥' },
    { id: 'outbound', label: 'Outbound', icon: '📤' },
  ];

  const handleSectionClick = (sectionId: string) => {
    onSectionChange(sectionId);
    setIsOpen(false); // Close mobile menu after selection
  };

  const linkClass = (id: string) => `
    flex items-center px-4 py-3 rounded-lg transition-all duration-200 w-full text-left 
    border-l-4
    ${activeSection === id 
      ? 'bg-amber-50 text-amber-900 font-semibold border-l-amber-500' 
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-transparent hover:border-l-amber-500'
    }
  `;

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-slate-200 z-50 flex items-center px-4 shadow-sm">
        <button
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg
            className="w-6 h-6 text-slate-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
        <img src={eilogofull} alt="Logo" className="h-8 ml-3 object-contain" />
      </div>

      {/* Overlay - Mobile Only */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-white/60 backdrop-blur-md z-30 mt-14"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Warehouse Sidebar */}
      <div
        className={`fixed md:sticky md:top-0 h-screen md:h-screen flex flex-col bg-background border-r border-slate-200 z-40 transition-transform duration-300 ease-in-out w-64 shadow-sm
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          mt-14 md:mt-0`}
      >
        {/* Logo Section */}
        <div className="hidden md:flex p-5 items-center justify-center border-b border-slate-100 bg-transparent">
          <img src={eilogofull} alt="Logo" className="max-h-10 max-w-full object-contain" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-3">
            Warehouse
          </p>
          <ul className="space-y-1">
            {navItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => handleSectionClick(item.id)}
                  className={linkClass(item.id)}
                >
                  <span className="text-lg mr-3">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Section */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400 text-center">© 2025 Esthetic Insights</p>
        </div>
      </div>
    </>
  );
};

export default WarehouseSidebar;
