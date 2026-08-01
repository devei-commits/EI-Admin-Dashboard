/**
 * Quotations section sub-navigation — a cohesive tab bar across the
 * section's surfaces (Quotes / Dashboard / Settings / Guide), replacing
 * the scattered header buttons.
 */
import { NavLink } from 'react-router-dom';
import { FileText, BarChart3, Settings, BookOpen } from 'lucide-react';

const NAV = [
  { to: '/quotations', label: 'Quotes', icon: FileText, end: true },
  { to: '/quotations/dashboard', label: 'Dashboard', icon: BarChart3, end: false },
  { to: '/quotations/settings', label: 'Settings', icon: Settings, end: false },
  { to: '/quotations/guide', label: 'Guide', icon: BookOpen, end: false },
];

export default function QuotationsNav() {
  return (
    <div className="flex items-center gap-1 bg-surface rounded-xl border border-hairline shadow-sm p-1.5 overflow-x-auto">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              isActive ? 'bg-ink text-white shadow-sm' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
            }`
          }
        >
          <n.icon className="w-4 h-4" /> {n.label}
        </NavLink>
      ))}
    </div>
  );
}
