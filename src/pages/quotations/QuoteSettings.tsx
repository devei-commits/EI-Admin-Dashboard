/**
 * Quotation Settings — tabbed hub for Grade Manager, Overhead Management,
 * and Timeline Configuration. All CRUD against /api/v1/quotes/* (super_admin).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowLeft, Layers, Wallet, Clock } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import GradeManager from './settings/GradeManager';
import OverheadManager from './settings/OverheadManager';
import TimelineConfig from './settings/TimelineConfig';

type Tab = 'grades' | 'overheads' | 'timeline';
const TABS: { key: Tab; label: string; icon: typeof Layers }[] = [
  { key: 'grades', label: 'Grade Manager', icon: Layers },
  { key: 'overheads', label: 'Overhead Management', icon: Wallet },
  { key: 'timeline', label: 'Timeline Configuration', icon: Clock },
];

export default function QuoteSettings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('grades');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Settings"
        subtitle="Manage grades, overheads, and timeline configuration"
        icon={<Settings className="w-6 h-6" />}
        actions={
          <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                tab === t.key ? 'border-slate-800 text-slate-900' : 'border-transparent text-gray-500 hover:text-gray-800'
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
        </div>
      </div>
    </div>
  );
}
