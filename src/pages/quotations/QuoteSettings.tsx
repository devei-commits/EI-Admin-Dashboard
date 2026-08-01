/**
 * Quotation Settings — tabbed hub for Grade Manager, Overhead Management,
 * Timeline Configuration, Conversion Rates, Category Wastage, and Audit Log.
 * All CRUD against /api/v1/quotes/* (super_admin).
 */
import { useState } from 'react';
import { Settings, Layers, Wallet, Clock, History } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import GradeManager from './settings/GradeManager';
import OverheadManager from './settings/OverheadManager';
import TimelineConfig from './settings/TimelineConfig';
import AuditLog from './settings/AuditLog';
import ConversionRateManager from './settings/ConversionRateManager';
import CategoryRateManager from './settings/CategoryRateManager';
import QuotationsNav from './QuotationsNav';

type Tab = 'grades' | 'overheads' | 'timeline' | 'conversion' | 'categories' | 'audit';
const TABS: { key: Tab; label: string; icon: typeof Layers }[] = [
  { key: 'grades', label: 'Grade Manager', icon: Layers },
  { key: 'overheads', label: 'Overhead Management', icon: Wallet },
  { key: 'timeline', label: 'Timeline Configuration', icon: Clock },
  { key: 'conversion', label: 'Conversion Rates', icon: Settings },
  { key: 'categories', label: 'Category Wastage', icon: Layers },
  { key: 'audit', label: 'Audit Log', icon: History },
];

export default function QuoteSettings() {
  const [tab, setTab] = useState<Tab>('grades');

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title="Quotation Settings"
        subtitle="Manage grades, overheads, and timeline configuration"
        icon={<Settings className="w-6 h-6" />}
      />

      <QuotationsNav />

      <div className="bg-surface rounded-lg shadow-sm border border-hairline">
        <div className="flex border-b border-hairline overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                tab === t.key ? 'border-slate-800 text-ink' : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'grades' && <GradeManager />}
          {tab === 'overheads' && <OverheadManager />}
          {tab === 'timeline' && <TimelineConfig />}
          {tab === 'conversion' && <ConversionRateManager />}
          {tab === 'categories' && <CategoryRateManager />}
          {tab === 'audit' && <AuditLog />}
        </div>
      </div>
    </div>
  );
}
