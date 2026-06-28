import React, { useState } from 'react';
import eilogofull from '../assets/logo/eilogofull.svg';
import AdminMainMenuButton from './AdminMainMenuButton';

interface QualitySidebarProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

const NAV_ITEMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'order-management', label: 'Order Management' },
  { id: 'inbound-qc', label: 'Inbound QC' },
  { id: 'qc-history', label: 'QC History' },
];

const QualitySidebar: React.FC<QualitySidebarProps> = ({ activeSection, onSectionChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const linkClass = (id: string): string =>
    `flex items-center px-4 py-3 rounded-lg transition-all duration-200 w-full text-left border-l-4 ${
      activeSection === id
        ? 'bg-teal-50 text-teal-900 font-semibold border-l-teal-500'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-transparent hover:border-l-teal-500'
    }`;

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-slate-200 z-50 flex items-center px-4 shadow-sm">
        <AdminMainMenuButton />
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close quality menu' : 'Open quality menu'}
        >
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <img src={eilogofull} alt="Esthetic Insights" className="h-8 ml-3 object-contain" />
      </div>

      {isOpen ? (
        <div
          className="md:hidden fixed inset-0 bg-white/60 backdrop-blur-md z-30 mt-14"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:mt-0 mt-14`}
      >
        <div className="hidden md:flex items-center px-5 py-4 border-b border-slate-200">
          <AdminMainMenuButton />
          <div className="ml-3">
            <p className="text-xs text-slate-500">Order Management</p>
            <p className="text-sm font-bold text-slate-900">Quality</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={linkClass(item.id)}
              onClick={() => {
                onSectionChange(item.id);
                setIsOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default QualitySidebar;
