import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { createLogisticsSchedule, fetchLogisticsSchedules, type CreateLogisticsSchedulePayload, type LogisticsScheduleRow } from '../../services/logisticsSchedule.service';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const EMPTY_FORM: CreateLogisticsSchedulePayload = {
  trackingNo: '',
  transporter: '',
  dispatchDate: '',
  etaDate: '',
  vehicleNo: '',
  status: 'Active',
};

export default function LogisticsSchedule() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [schedules, setSchedules] = useState<LogisticsScheduleRow[]>([]);

  const [form, setForm] = useState<CreateLogisticsSchedulePayload>({ ...EMPTY_FORM });

  const canCreate = useMemo(() => {
    return (
      form.trackingNo.trim() &&
      form.transporter.trim() &&
      form.dispatchDate.trim() &&
      form.etaDate.trim() &&
      form.vehicleNo.trim()
    );
  }, [form]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchLogisticsSchedules({ status: 'Active' });
        if (!cancelled) setSchedules(list);
      } catch {
        if (!cancelled) setSchedules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    if (creating) return;
    if (!canCreate) {
      addToast('error', 'Fill all logistics schedule fields first.');
      return;
    }
    try {
      setCreating(true);
      await createLogisticsSchedule({
        trackingNo: form.trackingNo.trim(),
        transporter: form.transporter.trim(),
        dispatchDate: form.dispatchDate,
        etaDate: form.etaDate,
        vehicleNo: form.vehicleNo.trim(),
        status: 'Active',
      });
      addToast('success', 'Logistics schedule created.');
      setForm({ ...EMPTY_FORM });
      const list = await fetchLogisticsSchedules({ status: 'Active' });
      setSchedules(list);
    } catch (e) {
      addToast('error', (e as any)?.message || 'Failed to create schedule.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-surface relative p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">Logistics Schedule</h1>
          <p className="text-sm text-ink-2">
            Create a vehicle schedule once, then use it while initiating multiple outbound transfers on the same vehicle.
          </p>
        </div>

        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-ink-2">Create schedule</h2>
            <span className="text-[10px] px-2 py-1 rounded-full bg-warn-soft text-warn border border-warn/40 font-semibold">
              Status: Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Tracking / LR no.</label>
              <input aria-label="Tracking / LR no." value={form.trackingNo} onChange={(e) => setForm((f) => ({ ...f, trackingNo: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Transporter / courier</label>
              <input aria-label="Transporter / courier" value={form.transporter} onChange={(e) => setForm((f) => ({ ...f, transporter: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Dispatch date</label>
              <input aria-label="Dispatch date" type="date" value={form.dispatchDate} onChange={(e) => setForm((f) => ({ ...f, dispatchDate: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">ETA</label>
              <input aria-label="ETA" type="date" value={form.etaDate} onChange={(e) => setForm((f) => ({ ...f, etaDate: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink-2 mb-1">Vehicle no.</label>
              <input aria-label="Vehicle no." value={form.vehicleNo} onChange={(e) => setForm((f) => ({ ...f, vehicleNo: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setForm({ ...EMPTY_FORM })}
              className="px-4 py-2 rounded-lg border border-border bg-surface-2 text-ink-2 text-sm font-semibold"
              disabled={creating}
            >
              Reset
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || creating}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating…' : 'Create schedule'}
            </button>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-ink-2">Active schedules</h2>
            <span className="text-xs text-ink-2">{loading ? 'Loading…' : `${schedules.length} schedules`}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-3">Tracking</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-3">Transporter</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-3">Vehicle</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-3">Dispatch</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-3">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6">
                      <TableSkeleton rows={5} cols={5} />
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No active schedules yet." />
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-2/60">
                      <td className="px-3 py-2 font-medium text-ink-2">{s.trackingNo}</td>
                      <td className="px-3 py-2 text-ink-2">{s.transporter}</td>
                      <td className="px-3 py-2 text-ink-2">{s.vehicleNo}</td>
                      <td className="px-3 py-2 text-ink-2">{s.dispatchDate}</td>
                      <td className="px-3 py-2 text-ink-2">{s.etaDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

