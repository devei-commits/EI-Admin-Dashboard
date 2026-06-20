/**
 * Quotation Guide — methodology reference + LIVE config viewer.
 * Glossary, the cost stack, and formulas are static; grades, overheads,
 * and timeline rules are fetched from the API so the guide always reflects
 * the current engine configuration.
 */
import { useState, useEffect } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import QuotationsNav from './QuotationsNav';
import * as api from '../../services/quotations.service';
import type { QuoteGrade, OverheadRow, ProcurementRule, ManufacturingRule, QcRule, DispatchRule } from '../../services/quotations.service';

// ── static reference data ──
const GLOSSARY: [string, string][] = [
  ['RM', 'Raw Material — a formula ingredient, priced in ₹/kg.'],
  ['PM', 'Pack Material — a packaging component (bottle, cap, label, carton), priced in ₹/piece.'],
  ['FG', 'Finished Good — the final filled & packed product.'],
  ['BOM', 'Bill of Materials — the formulation (RM lines, % w/w) plus packaging (PM lines, qty/unit).'],
  ['MOQ', 'Minimum Order Quantity — the units-per-band the price is quoted at (7 bands per grade).'],
  ['OH', 'Overhead — indirect cost per unit (QC, testing, storage, compliance, etc.).'],
  ['SG', 'Specific Gravity — formula density vs water. weight = volume × SG ÷ 1000.'],
  ['% w/w', 'Weight-for-weight — an ingredient\'s percentage by weight of the formula (all RM must sum to 100%).'],
  ['Ex-works', 'Supplier price before freight, insurance, and handling.'],
  ['Landed', 'Ex-works price × landing factor (freight + insurance + handling uplift).'],
  ['bmap', 'Band map — per-MOQ-band conversion bracket + scaling factor.'],
  ['QC', 'Quality Control / testing lead time (set per grade).'],
  ['Customer PPM', 'Customer Provides Pack Materials — Grade 3, where PM cost is zeroed.'],
  ['Conversion', 'Manufacturing + filling operation cost per unit (from fixed BT/TB/SR tables).'],
  ['Markup vs Gross Margin', 'Markup is profit as a % of COST; gross margin is profit as a % of SELL price. gross = markup ÷ (1 + markup).'],
];

const FORMULAS: { title: string; lines: string[] }[] = [
  { title: 'Landing factor', lines: ['landing_factor = 1 + freight% + insurance% + handling%', 'default = 1 + 0.03 + 0.01 + 0.01 = 1.05'] },
  { title: 'Raw material cost (₹/unit)', lines: [
    'blended_rm_exworks = Σ (pct_w_w/100 × price_per_kg)',
    'blended_rm_landed  = blended_rm_exworks × landing_factor',
    'blended_sg         = Σ (pct_w_w/100 × specific_gravity)',
    'weight_per_unit_kg = volume_ml × sg ÷ 1000',
    'total_rm = blended_rm_landed × weight_per_unit_kg + wastage + logistics',
  ] },
  { title: 'Pack material cost (₹/unit)', lines: [
    'total_pm = Σ (qty_per_unit × price_per_pc × landing_factor) + wastage + logistics',
    '(Grade with zero_pm → total_pm = 0)',
  ] },
  { title: 'Conversion (₹/unit)', lines: [
    'conversion = table[bracket][volume_key] × bmap.factor',
    '             − 0.70 if no monocarton',
  ] },
  { title: 'Overhead (₹/unit)', lines: ['overhead = Σ interpolated head values at the band\'s MOQ', '(category-specific heads override the \'all\' baseline)'] },
  { title: 'Credit & sell price', lines: [
    'credit_factor = (annual_rate ÷ 365) × credit_days',
    'cost_base  = total_rm + total_pm + conversion + overhead',
    'total_cost = cost_base × (1 + credit_factor)',
    'sell_price = total_cost × (1 + markup)',
    'gross_margin = markup ÷ (1 + markup)',
  ] },
  { title: 'Delivery timeline (days)', lines: [
    'procurement   = max(lead days across all RM + PM lines)',
    'total = procurement + manufacturing + qc + dispatch',
    'weeks = ceil(total ÷ 7)',
  ] },
];

const CONVERSION_TABLES: { name: string; cols: string[]; rows: [string, ...number[]][] }[] = [
  { name: 'BT — Bottle & Jar', cols: ['MOQ band', '≤50', '≤100', '≤200'], rows: [['1–1,000', 11.15, 11.85, 12.55], ['1,000–5,000', 8.90, 9.70, 10.30], ['5,000–10,000', 8.55, 9.35, 9.95], ['10,000+', 7.65, 8.45, 9.05]] },
  { name: 'TB — Tube', cols: ['MOQ band', '≤50', '≤100'], rows: [['1–1,000', 11.45, 12.15], ['1,000–5,000', 9.30, 10.10], ['5,000–10,000', 8.45, 9.25], ['10,000+', 7.25, 7.65]] },
  { name: 'SR — Serum w/ Dropper', cols: ['MOQ band', '≤30'], rows: [['1–1,000', 12.45], ['1,000–5,000', 10.65], ['5,000–10,000', 9.60], ['10,000+', 8.60]] },
];

const WARNINGS: [string, string][] = [
  ['RM composition ≠ 100%', 'The RM % w/w lines don\'t sum to 100. Fix the BOM formula.'],
  ['Volume or SG is 0', 'Costs are shown per-kg, not per-unit. Provide fill volume and SG.'],
  ['RM/PM ₹0 price', 'A material has no price in its master record. Set the price or override it on the quote.'],
];

const SECTIONS = [
  ['glossary', 'Abbreviations'], ['stack', 'Cost Stack'], ['formulas', 'Formulas'],
  ['grades', 'Grades'], ['conversion', 'Conversion'], ['overheads', 'Overheads'],
  ['timeline', 'Timeline'], ['warnings', 'Warnings'],
] as const;

const pct0 = (n: number) => (n * 100).toFixed(0) + '%';

export default function QuoteGuide() {
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<QuoteGrade[]>([]);
  const [overheads, setOverheads] = useState<OverheadRow[]>([]);
  const [proc, setProc] = useState<ProcurementRule[]>([]);
  const [mfg, setMfg] = useState<ManufacturingRule[]>([]);
  const [qc, setQc] = useState<QcRule[]>([]);
  const [dispatch, setDispatch] = useState<DispatchRule[]>([]);

  useEffect(() => {
    Promise.all([
      api.fetchGrades(), api.fetchOverheads('all'),
      api.fetchProcurementRules(), api.fetchManufacturingRules(),
      api.fetchQcRules(), api.fetchDispatchRules(),
    ]).then(([g, o, p, m, q, d]) => {
      if (g.success) setGrades(g.data);
      if (o.success) setOverheads(o.data);
      if (p.success) setProc(p.data);
      if (m.success) setMfg(m.data);
      if (q.success) setQc(q.data);
      if (d.success) setDispatch(d.data);
      setLoading(false);
    });
  }, []);

  // pivot manufacturing base rules (subtype '') into type × band grid
  const mfgTypes = [...new Set(mfg.map((r) => r.product_type))];
  const mfgGrid = (type: string) => Array.from({ length: 7 }, (_, b) => mfg.find((r) => r.product_type === type && (r.product_subtype || '') === '' && r.band_index === b)?.manufacturing_days ?? '—');
  const ohTotals = Array.from({ length: 7 }, (_, i) => overheads.reduce((s, r) => s + (Number(r.band_values[i]) || 0), 0));

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title="Quotation Guide"
        subtitle="Methodology, formulas, and the live engine configuration"
        icon={<BookOpen className="w-6 h-6" />}
      />

      <QuotationsNav />

      {/* in-page nav */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-slate-800 hover:text-white transition-all">{label}</a>
        ))}
      </div>

      {/* Glossary */}
      <Section id="glossary" title="Abbreviations & Glossary">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="flex gap-3">
              <dt className="font-semibold text-slate-900 whitespace-nowrap min-w-[7rem]">{term}</dt>
              <dd className="text-sm text-gray-600">{def}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Cost stack */}
      <Section id="stack" title="The Cost Stack">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {['RM', 'PM', 'Conversion', 'Overhead', 'Credit'].map((x, i) => (
            <span key={x} className="inline-flex items-center gap-2">
              <span className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700">{x}</span>
              {i < 4 && <span className="text-gray-400">+</span>}
            </span>
          ))}
          <span className="text-gray-400 mx-1">→</span>
          <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-semibold text-slate-800">Total Cost</span>
          <span className="text-gray-400 mx-1">× (1 + Markup) →</span>
          <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-700">Sell Price</span>
        </div>
      </Section>

      {/* Formulas */}
      <Section id="formulas" title="Formulas">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {FORMULAS.map((f) => (
            <div key={f.title} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-slate-800">{f.title}</div>
              <pre className="p-4 text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">{f.lines.join('\n')}</pre>
            </div>
          ))}
        </div>
      </Section>

      {loading ? (
        <div className="p-8 text-center"><Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" /><p className="text-sm text-gray-400 mt-2">Loading live configuration…</p></div>
      ) : (
        <>
          {/* Grades (live) */}
          <Section id="grades" title="Grades (live)">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {grades.map((g) => (
                <div key={g.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-slate-900">{g.name}</h4>
                    {g.zero_pm && <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">no PM</span>}
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr><td className="text-gray-400 py-0.5">MOQ</td><td className="text-gray-700">{g.moq_labels[0]} → {g.moq_labels[6]}</td></tr>
                      <tr><td className="text-gray-400 py-0.5">Markup</td><td className="text-gray-700">{pct0(g.markups[0])} → {pct0(g.markups[6])}</td></tr>
                      <tr><td className="text-gray-400 py-0.5">QC days</td><td className="text-gray-700">{g.qc_days ?? '—'}</td></tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Section>

          {/* Conversion tables (static) */}
          <Section id="conversion" title="Conversion Cost Tables (₹/unit)">
            <p className="text-xs text-gray-500 mb-3">Fixed operational rates by packaging type, MOQ band, and volume bracket. A band's grade <code>bmap</code> factor scales these; no-monocarton subtracts ₹0.70.</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {CONVERSION_TABLES.map((t) => (
                <div key={t.name} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-slate-800">{t.name}</div>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-400">{t.cols.map((c, i) => <th key={c} className={`py-1.5 px-2 ${i > 0 ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {t.rows.map((r) => <tr key={r[0] as string}>{r.map((c, i) => <td key={i} className={`py-1 px-2 ${i > 0 ? 'text-right text-gray-600' : 'text-gray-700'}`}>{c}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Section>

          {/* Overheads (live) */}
          <Section id="overheads" title="Overhead Heads — baseline (live)">
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="py-2 px-3 text-left">Head</th>{['500', '1K', '2.5K', '5K', '10K', '15K', '25K'].map((b) => <th key={b} className="py-2 px-2 text-right">{b}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {overheads.map((r) => <tr key={r.id}><td className="py-1 px-3 text-gray-700">{r.head_name}</td>{r.band_values.map((v, i) => <td key={i} className="py-1 px-2 text-right text-gray-500">{Number(v).toFixed(2)}</td>)}</tr>)}
                  <tr className="bg-gray-50 font-semibold"><td className="py-1.5 px-3 text-gray-700">Total</td>{ohTotals.map((t, i) => <td key={i} className="py-1.5 px-2 text-right text-slate-900">{t.toFixed(2)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Timeline (live) */}
          <Section id="timeline" title="Timeline Rules (live)">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MiniTable title="Procurement — RM (days)" cols={['Category', 'Individual', 'Batch']} rows={proc.filter((r) => r.material_type === 'RM').map((r) => [r.category_or_material, String(r.individual_lead_days), r.batch_lead_days == null ? '—' : String(r.batch_lead_days)])} />
              <MiniTable title="Procurement — PM (days)" cols={['Material', 'Individual', 'Batch']} rows={proc.filter((r) => r.material_type === 'PM').map((r) => [r.category_or_material, String(r.individual_lead_days), r.batch_lead_days == null ? '—' : String(r.batch_lead_days)])} />
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-slate-800">Manufacturing — days by band</div>
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400"><th className="py-1.5 px-2 text-left">Type</th>{[0, 1, 2, 3, 4, 5, 6].map((b) => <th key={b} className="py-1.5 px-2 text-right">B{b}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {mfgTypes.map((t) => <tr key={t}><td className="py-1 px-2 text-gray-700">{t}</td>{mfgGrid(t).map((d, i) => <td key={i} className="py-1 px-2 text-right text-gray-500">{d}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MiniTable title="QC (days)" cols={['Grade', 'Days']} rows={qc.map((r) => [r.grade_ref, String(r.qc_days)])} />
                <MiniTable title="Dispatch (days)" cols={['Grade', 'Days']} rows={dispatch.map((r) => [r.grade_ref, String(r.dispatch_days)])} />
              </div>
            </div>
          </Section>
        </>
      )}

      {/* Warnings */}
      <Section id="warnings" title="Warnings Explained">
        <dl className="space-y-2">
          {WARNINGS.map(([w, d]) => (
            <div key={w} className="flex gap-3 text-sm">
              <dt className="font-medium text-amber-700 min-w-[12rem]">{w}</dt><dd className="text-gray-600">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 scroll-mt-20">
      <h2 className="text-base font-bold text-slate-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function MiniTable({ title, cols, rows }: { title: string; cols: string[]; rows: string[][] }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-x-auto">
      <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-slate-800">{title}</div>
      <table className="w-full text-xs">
        <thead><tr className="text-gray-400">{cols.map((c, i) => <th key={c} className={`py-1.5 px-2 ${i > 0 ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i} className={`py-1 px-2 ${i > 0 ? 'text-right text-gray-500' : 'text-gray-700'}`}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
