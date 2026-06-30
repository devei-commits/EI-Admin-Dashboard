/**
 * BD Management sidebar — controlled 5-tab navigator (§2). Mirrors the
 * procurement sidebar's controlled pattern (all switching via onNavigate),
 * tool-native light styling. Counts shown as badges where > 0.
 */
import React, { useState } from 'react';
import { Menu, X, Handshake } from 'lucide-react';
import { BD_NAV, type BdTab } from '../../lib/bdNav';

export interface BDSidebarProps {
  activeTab: BdTab;
  counts?: Partial<Record<BdTab, number>>;
  onNavigate: (tab: BdTab) => void;
}

function itemClass(active: boolean): string {
  return [
    'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
    active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-slate-600 hover:bg-slate-100',
  ].join(' ');
}

export const BDSidebar: React.FC<BDSidebarProps> = ({ activeTab, counts = {}, onNavigate }) => {
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="space-y-1">
      {BD_NAV.map((item) => {
        const active = item.key === activeTab;
        const count = counts[item.key] ?? 0;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => { onNavigate(item.key); setOpen(false); }}
            className={itemClass(active)}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">{item.key}</span>
                {count > 0 && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-slate-400 truncate">{item.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden fixed bottom-4 right-4 z-[60] rounded-full bg-blue-600 p-3 text-white shadow-lg"
        aria-label="Toggle BD navigation"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Desktop rail */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 py-4 border-b border-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Module</p>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><Handshake size={18} className="text-blue-600" /> BD Management</h2>
        </div>
        <div className="p-3">{nav}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="w-72 max-w-[80%] bg-white p-3 shadow-xl overflow-y-auto">
            <div className="px-1 py-2 mb-2 border-b border-slate-100">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><Handshake size={18} className="text-blue-600" /> BD Management</h2>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
};
