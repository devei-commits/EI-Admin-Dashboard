import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { createLogisticsSchedule, fetchLogisticsSchedules, type CreateLogisticsSchedulePayload, type LogisticsScheduleRow } from '../../services/logisticsSchedule.service';

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
    <div className="flex-1 overflow-auto bg-white relative p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Logistics Schedule</h1>
          <p className="text-sm text-slate-600">
            Create a vehicle schedule once, then use it while initiating multiple outbound transfers on the same vehicle.
          </p>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Create schedule</h2>
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Status: Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tracking / LR no.</label>
              <input value={form.trackingNo} onChange={(e) => setForm((f) => ({ ...f, trackingNo: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Transporter / courier</label>
              <input value={form.transporter} onChange={(e) => setForm((f) => ({ ...f, transporter: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Dispatch date</label>
              <input type="date" value={form.dispatchDate} onChange={(e) => setForm((f) => ({ ...f, dispatchDate: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ETA</label>
              <input type="date" value={form.etaDate} onChange={(e) => setForm((f) => ({ ...f, etaDate: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle no.</label>
              <input value={form.vehicleNo} onChange={(e) => setForm((f) => ({ ...f, vehicleNo: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setForm({ ...EMPTY_FORM })}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm font-semibold"
              disabled={creating}
            >
              Reset
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || creating}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating…' : 'Create schedule'}
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Active schedules</h2>
            <span className="text-xs text-slate-600">{loading ? 'Loading…' : `${schedules.length} schedules`}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Tracking</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Transporter</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Vehicle</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Dispatch</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading…</td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No active schedules yet.</td>
                  </tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-800">{s.trackingNo}</td>
                      <td className="px-3 py-2 text-slate-700">{s.transporter}</td>
                      <td className="px-3 py-2 text-slate-700">{s.vehicleNo}</td>
                      <td className="px-3 py-2 text-slate-700">{s.dispatchDate}</td>
                      <td className="px-3 py-2 text-slate-700">{s.etaDate}</td>
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

