/**
 * Quote Builder — BOM-driven or adhoc (manual RM/PM) price + timeline
 * calculator. Live 7-band pricing & timeline, blended-SG auto-compute with
 * manual fallback, full config panel, and save.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calculator, ArrowLeft, Save, AlertTriangle, Loader2, FlaskConical, Package, X, Search, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, FormField, inputClassName, selectClassName } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { QuoteGrade, QuoteResult, CalculatePayload } from '../../services/quotations.service';
import { fetchBOMs, type BOMRecord } from '../../services/bom.service';

const PACKAGING_TYPES = ['Bottle & Jar', 'Tube', 'Serum with Dropper'] as const;
const VOLUME_KEYS: Record<string, string[]> = {
  'Bottle & Jar': ['<=50', '<=100', '<=200'],
  'Tube': ['<=50', '<=100'],
  'Serum with Dropper': ['<=30'],
};
const RM_CATEGORIES = ['Bulk Raw Materials', 'Pre-mixed Bases', 'CLUB Items', 'Solvents & Carriers', 'Raw Materials'];
const PM_MATERIALS = ['Packaging - Primary', 'Packaging - Secondary', 'Shrink Sleeves', 'Monocartons', 'Labels', 'Other Components', 'Packing Material', 'Stickers & Kits'];

const f2 = (n: number | null | undefined) => (n == null ? '—' : Number(n).toFixed(2));
const pct1 = (n: number | null | undefined) => (n == null ? '—' : (Number(n) * 100).toFixed(1) + '%');

type Mode = 'bom' | 'adhoc';
type RmRow = { rm_code: string; inci_name: string; pct_w_w: string; price_per_kg: string; specific_gravity: string; category: string };
type PmRow = { pm_code: string; description: string; qty_per_unit: string; price_per_pc: string; material: string };
const emptyRm = (): RmRow => ({ rm_code: '', inci_name: '', pct_w_w: '', price_per_kg: '', specific_gravity: '', category: 'Bulk Raw Materials' });
const emptyPm = (): PmRow => ({ pm_code: '', description: '', qty_per_unit: '1', price_per_pc: '', material: 'Packaging - Primary' });

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [mode, setMode] = useState<Mode>('bom');
  const [grades, setGrades] = useState<QuoteGrade[]>([]);
  const [gradeId, setGradeId] = useState<number | null>(null);

  // BOM picker
  const [bomSearch, setBomSearch] = useState('');
  const [bomResults, setBomResults] = useState<BOMRecord[]>([]);
  const [bomOpen, setBomOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState<BOMRecord | null>(null);

  // Adhoc
  const [adhocName, setAdhocName] = useState('Adhoc Quote');
  const [adhocRm, setAdhocRm] = useState<RmRow[]>([emptyRm()]);
  const [adhocPm, setAdhocPm] = useState<PmRow[]>([emptyPm()]);

  // config (percentages in UI → fractions for API)
  const [packagingType, setPackagingType] = useState<string>('Bottle & Jar');
  const [volumeKey, setVolumeKey] = useState<string>('<=100');
  const [monocarton, setMonocarton] = useState(true);
  const [useBatchLead, setUseBatchLead] = useState(false);
  const [volumeMl, setVolumeMl] = useState('');
  const [sgManual, setSgManual] = useState('');
  const [rmWastagePct, setRmWastagePct] = useState('3');
  const [pmWastagePct, setPmWastagePct] = useState('2');
  const [rmLogistics, setRmLogistics] = useState('5');
  const [pmLogistics, setPmLogistics] = useState('2');
  const [freightPct, setFreightPct] = useState('3');
  const [insurancePct, setInsurancePct] = useState('1');
  const [handlingPct, setHandlingPct] = useState('1');
  const [creditDays, setCreditDays] = useState('30');
  const [annualRatePct, setAnnualRatePct] = useState('14');
  const [targetPrice, setTargetPrice] = useState('');
  const [sgOverrides, setSgOverrides] = useState<Record<string, string>>({});

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingSg, setSavingSg] = useState(false);

  useEffect(() => {
    quotesApi.fetchGrades().then((r) => {
      if (r.success && r.data.length) { setGrades(r.data); setGradeId((p) => p ?? r.data.find((g) => g.grade_ref === 'system_1')?.id ?? r.data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    quotesApi.fetchSavedQuote(Number(id)).then((r) => {
      if (r.success && r.data) {
        const p = (r.data.payload || {}) as CalculatePayload;
        if (p.grade) setGradeId(p.grade);
        if (p.packagingType) setPackagingType(p.packagingType);
        if (p.volumeKey) setVolumeKey(p.volumeKey);
        if (p.monocarton != null) setMonocarton(!!p.monocarton);
        if (p.bom_id && r.data.bom_code) { setMode('bom'); setSelectedBom({ id: String(p.bom_id), bomCode: r.data.bom_code, name: r.data.quote_name } as BOMRecord); }
        setResult(r.data.result);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!bomOpen) return;
    const t = setTimeout(() => { fetchBOMs(bomSearch).then((r) => { if (r.success) setBomResults(r.data.slice(0, 30)); }); }, 300);
    return () => clearTimeout(t);
  }, [bomSearch, bomOpen]);

  const buildPayload = useCallback((): CalculatePayload | null => {
    if (gradeId == null) return null;
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const sgOv: Record<string, number> = {};
    for (const [k, v] of Object.entries(sgOverrides)) if (v.trim() !== '') sgOv[k] = Number(v);
    const base: CalculatePayload = {
      grade: gradeId, packagingType, volumeKey, monocarton, useBatchLead,
      rmWastage: Number(rmWastagePct) / 100, pmWastage: Number(pmWastagePct) / 100,
      rmLogistics: Number(rmLogistics), pmLogistics: Number(pmLogistics),
      freightPct: Number(freightPct) / 100, insurancePct: Number(insurancePct) / 100, handlingPct: Number(handlingPct) / 100,
      creditDays: Number(creditDays), annualRate: Number(annualRatePct) / 100,
      targetPrice: num(targetPrice) ?? 0, sgOverrides: sgOv,
      volumeMl: num(volumeMl), sg: num(sgManual),
    };
    if (mode === 'bom') return selectedBom ? { ...base, bom_id: Number(selectedBom.id) } : null;
    // adhoc
    const rm = adhocRm.filter((r) => r.inci_name.trim() || r.pct_w_w.trim());
    if (rm.length === 0) return null;
    return {
      ...base, name: adhocName || 'Adhoc Quote',
      rmLines: rm.map((r) => ({ rm_code: r.rm_code, inci_name: r.inci_name, pct_w_w: Number(r.pct_w_w) || 0, price_per_kg: Number(r.price_per_kg) || 0, specific_gravity: r.specific_gravity.trim() === '' ? null : Number(r.specific_gravity), category: r.category || null })),
      pmLines: adhocPm.filter((p) => p.description.trim()).map((p) => ({ pm_code: p.pm_code, description: p.description, qty_per_unit: Number(p.qty_per_unit) || 0, price_per_pc: Number(p.price_per_pc) || 0, material: p.material || null })),
    };
  }, [mode, gradeId, packagingType, volumeKey, monocarton, useBatchLead, rmWastagePct, pmWastagePct, rmLogistics, pmLogistics, freightPct, insurancePct, handlingPct, creditDays, annualRatePct, targetPrice, sgOverrides, volumeMl, sgManual, selectedBom, adhocName, adhocRm, adhocPm]);

  const reqIdRef = useRef(0);
  useEffect(() => {
    const payload = buildPayload();
    if (!payload) { setResult(null); return; }
    const myReq = ++reqIdRef.current;
    setCalcLoading(true);
    const t = setTimeout(async () => {
      const r = await quotesApi.calculateQuote(payload);
      if (myReq !== reqIdRef.current) return;
      setCalcLoading(false);
      if (r.success && r.data) { setResult(r.data); setCalcError(null); } else setCalcError(r.error ? String(r.error) : 'Calculation failed');
    }, 400);
    return () => clearTimeout(t);
  }, [buildPayload]);

  const volKeyOptions = VOLUME_KEYS[packagingType] || ['<=100'];
  useEffect(() => { if (!volKeyOptions.includes(volumeKey)) setVolumeKey(volKeyOptions[0]); }, [packagingType]); // eslint-disable-line

  const sg = result?.sg_info;
  const hasInput = mode === 'bom' ? !!selectedBom : adhocRm.some((r) => r.inci_name.trim() || r.pct_w_w.trim());
  const setRm = (i: number, k: keyof RmRow, v: string) => setAdhocRm((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const setPm = (i: number, k: keyof PmRow, v: string) => setAdhocPm((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const saveSgToMaster = async () => {
    if (!sg) return;
    const updates = sg.missing_sg_lines
      .filter((l) => l.raw_material_id != null && (sgOverrides[l.rm_code] ?? '').trim() !== '')
      .map((l) => ({ raw_material_id: l.raw_material_id as number, specific_gravity: Number(sgOverrides[l.rm_code]) }));
    if (!updates.length) { toast.error('Enter SG values first'); return; }
    setSavingSg(true);
    const r = await quotesApi.saveRmSg(updates);
    setSavingSg(false);
    if (r.success && r.data) toast.success(`Saved ${r.data.updated} SG value(s) to RM master`);
    else toast.error(r.error ? String(r.error) : 'Failed to save SG');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title={id ? 'Edit Quote' : 'New Quote'}
        subtitle="Pick a BOM or enter materials, then compute pricing & timeline"
        icon={<Calculator className="w-6 h-6" />}
        actions={
          <>
            <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button disabled={!result || (result?.bands?.length ?? 0) === 0} onClick={() => setSaveOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-gray-100 transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"><Save className="w-4 h-4" /> Save Quote</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {(['bom', 'adhoc'] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setResult(null); }} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'}`}>
                  {m === 'bom' ? 'From BOM' : 'Adhoc'}
                </button>
              ))}
            </div>

            {mode === 'bom' ? (
              <div className="relative">
                <FormField label="BOM" required>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className={`${inputClassName} pl-9`} placeholder={selectedBom ? `${selectedBom.bomCode} — ${selectedBom.name}` : 'Search BOM…'} value={bomSearch} onChange={(e) => { setBomSearch(e.target.value); setBomOpen(true); }} onFocus={() => setBomOpen(true)} />
                  </div>
                </FormField>
                {bomOpen && bomResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                    {bomResults.map((b) => (
                      <button key={b.id} onClick={() => { setSelectedBom(b); setBomOpen(false); setBomSearch(''); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm border-b border-gray-50 last:border-0">
                        <span className="font-medium text-slate-900">{b.bomCode}</span><span className="text-gray-500"> — {b.name}</span>{b.packSize && <span className="text-gray-400 text-xs ml-1">({b.packSize})</span>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedBom && (
                  <div className="mt-2 flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <Package className="w-4 h-4 text-slate-500" /><span className="font-medium text-slate-900">{selectedBom.bomCode}</span><span className="text-gray-500 truncate">{selectedBom.name}</span>
                    <button onClick={() => { setSelectedBom(null); setResult(null); }} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ) : (
              <FormField label="Quote Name"><input className={inputClassName} value={adhocName} onChange={(e) => setAdhocName(e.target.value)} /></FormField>
            )}

            <FormField label="Grade" required>
              <select className={selectClassName} value={gradeId ?? ''} onChange={(e) => setGradeId(Number(e.target.value))}>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}{g.zero_pm ? ' (no PM)' : ''}</option>)}
              </select>
            </FormField>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Packaging</h3>
            <FormField label="Packaging Type"><select className={selectClassName} value={packagingType} onChange={(e) => setPackagingType(e.target.value)}>{PACKAGING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Volume Bracket"><select className={selectClassName} value={volumeKey} onChange={(e) => setVolumeKey(e.target.value)}>{volKeyOptions.map((v) => <option key={v} value={v}>{v} ML</option>)}</select></FormField>
              <FormField label="Fill Volume (ML)"><input className={inputClassName} type="number" placeholder={result ? String(result.volume_ml) : 'auto'} value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)} /></FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={monocarton} onChange={(e) => setMonocarton(e.target.checked)} className="rounded border-gray-300 text-slate-800 focus:ring-slate-800" /> Includes monocarton</label>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Commercials</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="RM Wastage %"><input className={inputClassName} type="number" value={rmWastagePct} onChange={(e) => setRmWastagePct(e.target.value)} /></FormField>
              <FormField label="PM Wastage %"><input className={inputClassName} type="number" value={pmWastagePct} onChange={(e) => setPmWastagePct(e.target.value)} /></FormField>
              <FormField label="RM Logistics ₹/kg"><input className={inputClassName} type="number" value={rmLogistics} onChange={(e) => setRmLogistics(e.target.value)} /></FormField>
              <FormField label="PM Logistics ₹/unit"><input className={inputClassName} type="number" value={pmLogistics} onChange={(e) => setPmLogistics(e.target.value)} /></FormField>
              <FormField label="Freight %"><input className={inputClassName} type="number" value={freightPct} onChange={(e) => setFreightPct(e.target.value)} /></FormField>
              <FormField label="Insurance %"><input className={inputClassName} type="number" value={insurancePct} onChange={(e) => setInsurancePct(e.target.value)} /></FormField>
              <FormField label="Handling %"><input className={inputClassName} type="number" value={handlingPct} onChange={(e) => setHandlingPct(e.target.value)} /></FormField>
              <FormField label="Credit Days"><input className={inputClassName} type="number" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} /></FormField>
              <FormField label="Annual Rate %"><input className={inputClassName} type="number" value={annualRatePct} onChange={(e) => setAnnualRatePct(e.target.value)} /></FormField>
              <FormField label="Target Price ₹"><input className={inputClassName} type="number" placeholder="optional" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} /></FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={useBatchLead} onChange={(e) => setUseBatchLead(e.target.checked)} className="rounded border-gray-300 text-slate-800 focus:ring-slate-800" /> Use batch procurement lead times</label>
          </div>
        </div>

        {/* RIGHT: adhoc editors + results */}
        <div className="lg:col-span-2 space-y-6">
          {mode === 'adhoc' && (
            <>
              <LineEditor title="Raw Materials" cols={['Code', 'Ingredient', '% w/w', '₹/kg', 'SG', 'Category']}>
                {adhocRm.map((r, i) => (
                  <tr key={i}>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-20`} value={r.rm_code} onChange={(e) => setRm(i, 'rm_code', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2`} value={r.inci_name} onChange={(e) => setRm(i, 'inci_name', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-16 text-right`} type="number" value={r.pct_w_w} onChange={(e) => setRm(i, 'pct_w_w', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" value={r.price_per_kg} onChange={(e) => setRm(i, 'price_per_kg', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-16 text-right`} type="number" step="0.001" placeholder="opt" value={r.specific_gravity} onChange={(e) => setRm(i, 'specific_gravity', e.target.value)} /></td>
                    <td className="p-1"><select className={`${selectClassName} py-1 px-2`} value={r.category} onChange={(e) => setRm(i, 'category', e.target.value)}>{RM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="p-1 text-right"><button onClick={() => setAdhocRm((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
                <AddRow onClick={() => setAdhocRm((p) => [...p, emptyRm()])} span={7} label="Add RM line" />
              </LineEditor>

              <LineEditor title="Pack Materials" cols={['Code', 'Description', 'Qty', '₹/pc', 'Material']}>
                {adhocPm.map((p, i) => (
                  <tr key={i}>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-20`} value={p.pm_code} onChange={(e) => setPm(i, 'pm_code', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2`} value={p.description} onChange={(e) => setPm(i, 'description', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-14 text-right`} type="number" value={p.qty_per_unit} onChange={(e) => setPm(i, 'qty_per_unit', e.target.value)} /></td>
                    <td className="p-1"><input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" value={p.price_per_pc} onChange={(e) => setPm(i, 'price_per_pc', e.target.value)} /></td>
                    <td className="p-1"><select className={`${selectClassName} py-1 px-2`} value={p.material} onChange={(e) => setPm(i, 'material', e.target.value)}>{PM_MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></td>
                    <td className="p-1 text-right"><button onClick={() => setAdhocPm((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
                <AddRow onClick={() => setAdhocPm((p) => [...p, emptyPm()])} span={6} label="Add PM line" />
              </LineEditor>
            </>
          )}

          {!hasInput && mode === 'bom' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center"><Calculator className="w-10 h-10 mx-auto text-gray-300 mb-3" /><p className="text-gray-500 font-medium">Select a BOM to generate a quote.</p></div>
          )}

          {hasInput && (
            <>
              {sg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-2"><FlaskConical className="w-4 h-4 text-slate-600" /><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Formula Specific Gravity</h3></div>
                  {sg.sg_complete ? (
                    <p className="text-sm text-gray-600">Auto-computed blended SG: <span className="font-semibold text-emerald-700">{sg.blended_sg}</span></p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{sg.missing_sg_lines.length} ingredient(s) missing SG ({sg.sg_known_pct}% known). {mode === 'adhoc' ? 'Fill the SG column above, or' : 'Enter values below, or'} set a manual blended SG.</span></div>
                      {mode === 'bom' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sg.missing_sg_lines.map((l) => (
                              <div key={l.rm_code} className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 flex-1 truncate" title={l.name}>{l.name} <span className="text-gray-400">({l.pct_w_w}%)</span></span>
                                <input className={`${inputClassName} w-24`} type="number" step="0.001" placeholder="SG" value={sgOverrides[l.rm_code] ?? ''} onChange={(e) => setSgOverrides((p) => ({ ...p, [l.rm_code]: e.target.value }))} />
                              </div>
                            ))}
                          </div>
                          {sg.missing_sg_lines.some((l) => l.raw_material_id != null) && (
                            <button onClick={saveSgToMaster} disabled={savingSg} className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium disabled:opacity-50">
                              {savingSg && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save entered SG values to RM master
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2"><span className="text-xs text-gray-500">Manual blended SG override:</span><input className={`${inputClassName} w-28`} type="number" step="0.001" placeholder="optional" value={sgManual} onChange={(e) => setSgManual(e.target.value)} /></div>
                </div>
              )}

              {result && result.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1"><AlertTriangle className="w-4 h-4" /> Warnings</div>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-0.5">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              {calcError && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{calcError}</div>}

              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Pricing — 7 MOQ Bands</h3>
                  {calcLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                  {result && <span className="text-xs text-gray-400">{result.product_type} · OH: {result.overhead_category}</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-3 px-4">MOQ</th><th className="py-3 px-3 text-right">RM</th><th className="py-3 px-3 text-right">PM</th><th className="py-3 px-3 text-right">Conv.</th><th className="py-3 px-3 text-right">OH</th><th className="py-3 px-3 text-right">Cost</th><th className="py-3 px-3 text-right">Markup</th><th className="py-3 px-3 text-right">Margin</th><th className="py-3 px-4 text-right">Sell ₹</th>{result && result.bands[0]?.target > 0 && <th className="py-3 px-3 text-right">Gap</th>}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {result?.bands.map((b) => (
                        <tr key={b.moqv} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-900">{b.moq}</td>
                          <td className="py-2.5 px-3 text-right text-gray-600">{f2(b.rm)}</td><td className="py-2.5 px-3 text-right text-gray-600">{f2(b.pm)}</td><td className="py-2.5 px-3 text-right text-gray-600">{f2(b.conversion)}</td><td className="py-2.5 px-3 text-right text-gray-600">{f2(b.overhead)}</td><td className="py-2.5 px-3 text-right text-gray-700">{f2(b.total_cost)}</td><td className="py-2.5 px-3 text-right text-gray-500">{pct1(b.markup_pct)}</td><td className="py-2.5 px-3 text-right text-gray-500">{pct1(b.gross_margin_pct)}</td><td className="py-2.5 px-4 text-right font-semibold text-slate-900">{f2(b.sell_price)}</td>
                          {b.target > 0 && <td className={`py-2.5 px-3 text-right ${b.gap <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{f2(b.gap)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Delivery Timeline (days)</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-3 px-4">MOQ</th><th className="py-3 px-3 text-right">Procurement</th><th className="py-3 px-3 text-right">Manufacturing</th><th className="py-3 px-3 text-right">QC</th><th className="py-3 px-3 text-right">Dispatch</th><th className="py-3 px-3 text-right">Total</th><th className="py-3 px-4 text-right">Weeks</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {result?.bands.map((b) => (
                        <tr key={b.moqv} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-900">{b.moq}</td><td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.procurement}</td><td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.manufacturing}</td><td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.qc}</td><td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.dispatch}</td><td className="py-2.5 px-3 text-right text-gray-700 font-medium">{b.timeline.total}</td><td className="py-2.5 px-4 text-right font-semibold text-slate-900">{b.timeline.weeks}w</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <BreakdownCard title={`RM Breakdown (${result.rm_detail.length})`} headers={['Ingredient', '% w/w', '₹/kg', 'Landed']} rows={result.rm_detail.map((r) => [r.name, String(r.pct_w_w), f2(r.price_per_kg), f2(r.landed_per_kg), r.missing_price])} />
                  <BreakdownCard title={`PM Breakdown (${result.pm_detail.length})`} headers={['Component', 'Qty', '₹/pc', 'Line']} rows={result.pm_detail.map((p) => [p.name, String(p.qty_per_unit), f2(p.price_per_pc), f2(p.line_total), p.missing_price])} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {saveOpen && result && <SaveQuoteModal result={result} payload={buildPayload()} onClose={() => setSaveOpen(false)} onSaved={(ref) => { toast.success(`Quote saved: ${ref}`); navigate('/quotations'); }} />}
    </div>
  );
}

function LineEditor({ title, cols, children }: { title: string; cols: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h3></div>
      <div className="overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{cols.map((c) => <th key={c} className="px-2 py-1">{c}</th>)}<th></th></tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function AddRow({ onClick, span, label }: { onClick: () => void; span: number; label: string }) {
  return <tr><td colSpan={span} className="p-1"><button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 font-medium"><Plus className="w-4 h-4" /> {label}</button></td></tr>;
}

function BreakdownCard({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<string | boolean>> }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h3></div>
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">{headers.map((h, i) => <th key={h} className={`py-2.5 px-4 ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r, i) => {
              const missing = r[r.length - 1] === true;
              return (
                <tr key={i} className={missing ? 'bg-red-50/40' : ''}>
                  {r.slice(0, -1).map((c, j) => <td key={j} className={`py-2 px-4 ${j > 0 ? 'text-right text-gray-600' : 'text-gray-800 truncate max-w-[14rem]'}`} title={j === 0 ? String(c) : undefined}>{String(c)}{j === 0 && missing && <span className="text-red-500 text-xs ml-1">(no price)</span>}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SaveQuoteModal({ result, payload, onClose, onSaved }: { result: QuoteResult; payload: CalculatePayload | null; onClose: () => void; onSaved: (ref: string) => void }) {
  const [quoteName, setQuoteName] = useState(result.bom_name || 'Untitled Quote');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [gst, setGst] = useState('18');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const r = await quotesApi.saveQuote({ quote_name: quoteName, customer_name: customerName, notes, payload: (payload || {}) as Record<string, unknown>, result, gst_pct: Number(gst) || 18, valid_until: validUntil || undefined });
    setSaving(false);
    if (r.success && r.data) onSaved(r.data.quote_ref); else toast.error(r.error ? String(r.error) : 'Failed to save');
  };

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200"><h2 className="text-lg font-bold text-slate-900">Save Quote</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-4">
          <FormField label="Quote Name" required><input className={inputClassName} value={quoteName} onChange={(e) => setQuoteName(e.target.value)} /></FormField>
          <FormField label="Customer"><input className={inputClassName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="optional" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="GST %"><input className={inputClassName} type="number" value={gst} onChange={(e) => setGst(e.target.value)} /></FormField>
            <FormField label="Valid Until"><input className={inputClassName} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></FormField>
          </div>
          <FormField label="Notes"><textarea className={inputClassName} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" /></FormField>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
          <button onClick={submit} disabled={saving || !quoteName.trim()} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-semibold disabled:opacity-50">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}
