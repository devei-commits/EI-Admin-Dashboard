/**
 * Audit Log — config-change history (grades, overheads, timeline rules,
 * material leads). Append-only; recorded server-side on each mutation.
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { selectClassName } from '../../../components/ui';
import * as api from '../../../services/quotations.service';
import type { AuditEntry } from '../../../services/quotations.service';

const ENTITY_LABELS: Record<string, string> = {
  grade: 'Grade', overhead: 'Overhead', procurement_rule: 'Procurement',
  manufacturing_rule: 'Manufacturing', qc_rule: 'QC', dispatch_rule: 'Dispatch', material_lead: 'Material Lead',
};
const ACTION_CLS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700', update: 'bg-blue-100 text-blue-700', delete: 'bg-red-100 text-red-700',
};
const PAGE = 25;

export default function AuditLog() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.fetchAudit(filter, PAGE, page * PAGE).then((r) => { setLoading(false); if (r.success && r.data) { setEntries(r.data.entries); setTotal(r.data.total); } });
  }, [filter, page]);
  useEffect(() => { setPage(0); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500 flex-1">Every change to grades, overheads, and timeline configuration is logged here.</p>
        <select aria-label="Filter by config type" className={`${selectClassName} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All config</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading ? <Loader2 className="w-5 h-5 mx-auto text-slate-400 animate-spin my-6" /> : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 whitespace-nowrap">
              <th scope="col" className="py-2.5 px-3">When</th><th scope="col" className="py-2.5 px-3">Action</th><th scope="col" className="py-2.5 px-3">Type</th><th scope="col" className="py-2.5 px-3">Summary</th><th scope="col" className="py-2.5 px-3">By</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {entries.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No audit entries.</td></tr>}
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 px-3 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="py-1.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_CLS[e.action] || 'bg-gray-100 text-gray-600'}`}>{e.action}</span></td>
                  <td className="py-1.5 px-3 text-gray-700">{ENTITY_LABELS[e.entity_type] || e.entity_type}</td>
                  <td className="py-1.5 px-3 text-gray-600">{e.summary}</td>
                  <td className="py-1.5 px-3 text-gray-500">{e.changed_by_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{total} entries · page {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
