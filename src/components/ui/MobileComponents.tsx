import React, { useState, useEffect } from 'react';

interface MobileBottomNavProps {
 items: {
  id: string;
  label: string;
  icon: React.ReactNode;
 }[];
 activeItem: string;
 onItemClick: (id: string) => void;
 className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
 items,
 activeItem,
 onItemClick,
 className = '',
}) => {
 const [isVisible, setIsVisible] = useState(true);
 const [lastScrollY, setLastScrollY] = useState(0);

 useEffect(() => {
  const handleScroll = () => {
   const currentScrollY = window.scrollY;
   
   // Hide nav when scrolling down, show when scrolling up
   if (currentScrollY > lastScrollY && currentScrollY > 100) {
    setIsVisible(false);
   } else {
    setIsVisible(true);
   }
   
   setLastScrollY(currentScrollY);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
 }, [lastScrollY]);

 return (
  <nav
   className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:hidden transition-transform duration-300 ${
    isVisible ? 'translate-y-0' : 'translate-y-full'
   } ${className}`}
  >
   <div className="flex items-center justify-around py-2 px-2 safe-area-pb">
    {items.slice(0, 5).map((item) => (
     <button
      key={item.id}
      onClick={() => onItemClick(item.id)}
      className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-all duration-150 min-w-0 ${
       activeItem === item.id
        ? 'text-slate-800'
        : 'text-gray-500 hover:text-gray-700'
      }`}
     >
      <div className={`w-6 h-6 ${activeItem === item.id ? 'scale-110' : ''} transition-transform`}>
       {item.icon}
      </div>
      <span className="text-xs mt-1 truncate max-w-full font-medium">
       {item.label}
      </span>
      {activeItem === item.id && (
       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-slate-800 rounded-full" />
      )}
     </button>
    ))}
   </div>
  </nav>
 );
};

interface ResponsiveTableProps {
 headers: string[];
 data: Record<string, unknown>[];
 onRowClick?: (row: Record<string, unknown>) => void;
 keyField: string;
 mobileLayout?: 'cards' | 'stacked';
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
 headers,
 data,
 onRowClick,
 keyField,
 mobileLayout = 'cards',
}) => {
 const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

 useEffect(() => {
  const handleResize = () => {
   setIsMobile(window.innerWidth < 768);
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
 }, []);

 if (isMobile && mobileLayout === 'cards') {
  return (
   <div className="space-y-3">
    {data.map((row) => (
     <div
      key={String(row[keyField])}
      className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 ${
       onRowClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
      }`}
      onClick={() => onRowClick?.(row)}
     >
      {headers.map((header, index) => (
       <div key={header} className={index > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{header}</span>
        <p className="text-sm text-gray-800 font-medium mt-0.5">{String(row[header] ?? '-')}</p>
       </div>
      ))}
     </div>
    ))}
   </div>
  );
 }

 return (
  <div className="overflow-x-auto">
   <table className="w-full min-w-[600px]">
    <thead className="bg-gray-50">
     <tr>
      {headers.map((header) => (
       <th
        key={header}
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
       >
        {header}
       </th>
      ))}
     </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
     {data.map((row) => (
      <tr
       key={String(row[keyField])}
       className={`hover:bg-gray-50 transition-colors ${
        onRowClick ? 'cursor-pointer' : ''
       }`}
       onClick={() => onRowClick?.(row)}
      >
       {headers.map((header) => (
        <td key={header} className="px-4 py-3 text-sm text-gray-700">
         {String(row[header] ?? '-')}
        </td>
       ))}
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
};

export default MobileBottomNav;
