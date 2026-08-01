import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { fetchConversionRates, upsertConversionRate } from '../../../services/quotations.service';
import type { ConversionRate } from '../../../services/quotations.service';

// ── Types ──────────────────────────────────────────────────────
type RateMap = Record<string, Record<string, Record<string, string>>>;

const PKG_TYPES = ['Bottle & Jar', 'Tube', 'Serum with Dropper'] as const;

const VOL_KEYS: Record<typeof PKG_TYPES[number], string[]> = {
  'Bottle & Jar':        ['<=50', '<=100', '<=200'],
  'Tube':                ['<=50', '<=100'],
  'Serum with Dropper':  ['<=30'],
};

const MOQ_BANDS = ['1-1000', '1000-5000', '5000-10000', '10000+'] as const;

function buildMap(rows: ConversionRate[]): RateMap {
  const m: RateMap = {};
  for (const r of rows) {
    if (!m[r.packaging_type]) m[r.packaging_type] = {};
    if (!m[r.packaging_type][r.moq_band]) m[r.packaging_type][r.moq_band] = {};
    m[r.packaging_type][r.moq_band][r.volume_key] = String(r.rate);
  }
  return m;
}

function getMonoDiscount(rows: ConversionRate[]): string {
  const row = rows.find(r => r.packaging_type === 'CONFIG' && r.moq_band === 'mono_discount');
  return row ? String(row.rate) : '1.5';
}

export default function ConversionRateManager() {
  const [rows, setRows]           = useState<ConversionRate[]>([]);
  const [map, setMap]             = useState<RateMap>({});
  const [monoDisc, setMonoDisc]   = useState('1.5');
  const [saving, setSaving]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchConversionRates();
    if (res.success) {
      setRows(res.data);
      setMap(buildMap(res.data));
      setMonoDisc(getMonoDiscount(res.data));
    } else {
      toast.error(res.error ?? 'Failed to load rates');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setCell = (pkg: string, band: string, vol: string, val: string) => {
    setMap(prev => ({
      ...prev,
      [pkg]: { ...(prev[pkg] ?? {}), [band]: { ...(prev[pkg]?.[band] ?? {}), [vol]: val } },
    }));
  };

  const saveCell = async (pkg: string, band: string, vol: string) => {
    const val = map[pkg]?.[band]?.[vol] ?? '';
    const rate = parseFloat(val);
    if (isNaN(rate)) { toast.error('Invalid rate value'); return; }
    const key = `${pkg}|${band}|${vol}`;
    setSaving(key);
    const res = await upsertConversionRate({ packaging_type: pkg, moq_band: band, volume_key: vol, rate });
    setSaving(null);
    if (res.success) toast.success('Rate saved');
    else toast.error(res.error ?? 'Save failed');
  };

  const saveMonoDiscount = async () => {
    const rate = parseFloat(monoDisc);
    if (isNaN(rate)) { toast.error('Invalid discount value'); return; }
    setSaving('mono');
    const res = await upsertConversionRate({ packaging_type: 'CONFIG', moq_band: 'mono_discount', volume_key: 'value', rate });
    setSaving(null);
    if (res.success) toast.success('Mono discount saved');
    else toast.error(res.error ?? 'Save failed');
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading conversion rates…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Filling Conversion Rates (₹ / unit)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Rates used by the pricing engine per packaging type, MOQ band, and volume range.
          Click a cell and press Enter or click Save to update.
        </p>
      </div>

      {PKG_TYPES.map(pkg => {
        const vols = VOL_KEYS[pkg];
        return (
          <div key={pkg} className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <span className="font-medium text-sm text-gray-800">{pkg}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">MOQ Band</th>
                    {vols.map(v => (
                      <th scope="col" key={v} className="px-4 py-2 text-center font-medium text-gray-600">{v} mL</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOQ_BANDS.map((band, bi) => (
                    <tr key={band} className={bi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium text-gray-700">{band}</td>
                      {vols.map(vol => {
                        const cellKey = `${pkg}|${band}|${vol}`;
                        const isSaving = saving === cellKey;
                        return (
                          <td key={vol} className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-xs">₹</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                aria-label={`Rate for ${pkg}, ${band}, ${vol} mL`}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={map[pkg]?.[band]?.[vol] ?? ''}
                                onChange={e => setCell(pkg, band, vol, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveCell(pkg, band, vol); }}
                              />
                              <button
                                onClick={() => saveCell(pkg, band, vol)}
                                disabled={isSaving}
                                className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-40"
                                title="Save"
                                aria-label="Save"
                              >
                                <Save className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="rounded-lg border border-gray-200 p-4 max-w-xs">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          No-Monocarton Discount (₹ deducted from base rate)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">₹</span>
          <input
            type="number"
            step="0.1"
            min="0"
            className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={monoDisc}
            onChange={e => setMonoDisc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveMonoDiscount(); }}
          />
          <button
            onClick={saveMonoDiscount}
            disabled={saving === 'mono'}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Applied when monocarton = No</p>
      </div>
    </div>
  );
}
