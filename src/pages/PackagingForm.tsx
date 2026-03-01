import React, { useState, useEffect, useCallback } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import ArrayItemManager from '../components/ArrayItemManager';
import { fetchPackMaterialsList, fetchNextPackMaterialCode, createPackMaterial, type PackMaterialRecord } from '../services/packMaterials.service';

// ─── PM Category Code Series ─────────────────────────────────────────────────
const PM_CATEGORIES: Record<string, { label: string; prefix: string }> = {
  PRI:  { label: 'Primary Container (Bottle/Jar/Tube)',   prefix: 'EI-PM-PRI' },
  SLBL: { label: 'Self-adhesive Label',                    prefix: 'EI-PM-SLBL' },
  MONO: { label: 'Mono Carton / Folding Box',              prefix: 'EI-PM-MONO' },
  SHIP: { label: 'Shipper / Master Carton',                prefix: 'EI-PM-SHIP' },
  CLSR: { label: 'Closure / Cap / Pump',                   prefix: 'EI-PM-CLSR' },
  SACH: { label: 'Sachet / Pouch / Stick Pack',            prefix: 'EI-PM-SACH' },
  FIOL: { label: 'Ampoule / Vial / Fiolax',                prefix: 'EI-PM-FIOL' },
  ALUM: { label: 'Aluminium Tube / Blister',               prefix: 'EI-PM-ALUM' },
  AIRLS: { label: 'Airless / Vacuum Dispenser',            prefix: 'EI-PM-AIRLS' },
  TAPE: { label: 'Tape / Rubber Band / Twistie',           prefix: 'EI-PM-TAPE' },
  GIFT: { label: 'Gift Box / Rigid Box / Set',             prefix: 'EI-PM-GIFT' },
  MISC: { label: 'Miscellaneous / Others',                  prefix: 'EI-PM-MISC' },
};

const QC_GROUPS = ['Chemical QC', 'Microbiology', 'Physical QC', 'Packaging QC', 'Incoming QA'];
const STORAGE_TYPES = ['Ambient – Dry', 'Ambient – Cool', 'Refrigerated (2–8°C)', 'Frozen', 'Flammable Store'];

/** Mock form data for testing (Pack Materials / BPR form). */
const PACKAGING_FORM_MOCK = {
  pmCategory: 'PRI',
  qcGroup: 'Packaging QC',
  pkgSku: 'PKG-MOCK-001',
  name: 'Mock 30ml Dropper Bottle',
  level: 'Primary',
  itemCategory: 'Bottle',
  intendedUse: 'Serum',
  matBody: 'PET',
  matClosure: 'PP',
  specNominal: '30ml',
  colorType: 'Clear',
  identityNotes: 'Mock data for testing',
};

const SECTIONS = [
  '0) QC / PM Categorisation',
  '1) Identity',
  '2) Material & Specs',
  '3) Aesthetics',
  '4) Variants Matrix',
  '5) Customization & Tooling',
  '6) Compatibility (R&D / QA)',
  '7) Vendors & Commercial',
  '8) Secondary Packaging',
  '9) Tertiary Packaging',
  '10) Testing & Approval',
  '11) Catalogue / Website',
  '12) Review / JSON',
];

// ─── Main Component ───────────────────────────────────────────────────────────
const PackagingRefactored: React.FC = () => {
  const { addItem: _addItem } = useItems(); // BPR submit posts to API; addItem unused here
  const { addToast } = useToast();
  const [pageTab, setPageTab] = useState<'bpr' | 'form'>('bpr');
  const [bprRefreshKey, setBprRefreshKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [autoSaveOn, setAutoSaveOn] = useState(true);
  const [lastSaved, setLastSaved] = useState<string>('—');
  const [generatedCode, setGeneratedCode] = useState('');

  const [formData, setFormData] = useState({
    itemCode: '',
    status: 'Draft',
    version: 'v1.0',

    // Section 0 – QC / PM Categorisation + Basic
    pmCategory: '',
    qcGroup: '',
    subCategory: '',
    storeLoc: '',
    pkgSku: '',
    pkgUnit: 'PCS',
    pkgHsn: '',
    pkgTaxPreference: 'Taxable',
    pkgReturnable: false,
    pkgAssociateItems: '',

    // Section 1 – Identity
    name: '',
    level: '',
    itemCategory: '',
    intendedUse: '',
    expectedProductTypes: '',
    reusability: '',
    regulatory: '',
    identityNotes: '',

    // Section 2 – Material & Specs
    matBody: '',
    matClosure: '',
    matInner: '',
    matRecycle: false,
    matBpa: false,
    matGrade: '',
    specNominal: '',
    specBrimful: '',
    specHeight: '',
    specDia: '',
    specNeck: '',
    specWeight: '',
    specWall: '',
    specLink: '',

    // Section 3 – Aesthetics
    colorType: '',
    colorCode: '',
    finish: '',
    deco: '',
    images: '',

    // Section 5 – Customization
    cusCustomizable: false,
    cusParams: '',
    cusStdMoq: '',
    cusCustomMoq: '',
    cusToolingReq: '',
    cusToolingCost: '',
    cusSamplingLT: '',
    cusBulkLTStd: '',
    cusBulkLTCustom: '',
    cusRemarks: '',

    // Section 6 – Compatibility
    compLow: false,
    compMed: false,
    compHigh: false,
    compOil: false,
    compAlc: false,
    compAirless: false,
    compPump: false,
    compLeak: false,
    compActives: '',
    compRisk: '',
    compRemarks: '',

    // Section 8 – Secondary Packaging
    secLabelType: '',
    secLabelSize: '',
    secAdhesive: '',
    secLabelCompat: '',
    secGsm: '',
    secCartonFinish: '',
    secFit: '',
    secArtLink: '',
    secNotes: '',

    // Section 9 – Tertiary Packaging
    terShipType: '',
    terUnits: '',
    terDrop: '',
    terStack: '',
    terNotes: '',

    // Section 10 – Testing & Approval
    apprPack: false,
    apprRd: false,
    apprFin: false,
    apprLock: false,

    // Section 11 – Catalogue
    catVisible: false,
    catShare: false,
    catWebName: '',
    catTags: '',
    catRecoTypes: '',
    catWebImages: '',

    // Arrays
    variants: [] as Array<{ id: string; volume: number; sameMold: string; moq: number; status: string }>,
    vendors: [] as Array<{ name: string; location: string; moq: number; price: number; leadTime: number; approved: string; priceType: string; validTill: string; sampleCost: number }>,
    tests: [] as Array<{ name: string; result: string; date: string; by: string; remarks: string }>,
  });

  const [tempVariant, setTempVariant] = useState({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
  const [tempVendor, setTempVendor] = useState({ name: '', location: '', moq: '', price: '', leadTime: '', approved: '', priceType: '', validTill: '', sampleCost: '' });
  const [tempTest, setTempTest] = useState({ name: '', result: '', date: '', by: '', remarks: '' });

  const doSave = (silent = false) => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setLastSaved(now);
    if (!silent) addToast('success', 'Draft saved locally (session only)');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // Code generation (next code comes from backend)
  const getCodePreview = () => {
    const cat = PM_CATEGORIES[formData.pmCategory];
    if (!cat) return { prefix: '—', next: '—' };
    if (generatedCode && generatedCode.startsWith(cat.prefix)) {
      const suffix = generatedCode.slice(cat.prefix.length).replace(/^-+/, '') || '—';
      return { prefix: cat.prefix, next: suffix };
    }
    return { prefix: cat.prefix, next: '…' };
  };

  const generateCode = async (confirm = false) => {
    if (!formData.pmCategory) {
      addToast('error', 'Select a PM Category first');
      return;
    }
    if (generatedCode && !confirm) {
      const ok = window.confirm('A code is already generated. Regenerate? This must be controlled after approvals.');
      if (!ok) return;
    }
    const cat = PM_CATEGORIES[formData.pmCategory];
    try {
      const code = await fetchNextPackMaterialCode(cat.prefix);
      setGeneratedCode(code);
      setFormData(prev => ({ ...prev, itemCode: code }));
      addToast('success', `Code generated: ${code}`);
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Failed to generate code');
    }
  };

  // Variant ops
  const handleAddVariant = () => {
    if (!tempVariant.volume || Number(tempVariant.volume) <= 0) {
      setErrors(prev => ({ ...prev, varVolume: 'Fill volume is required' }));
      addToast('error', 'Fill volume is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: tempVariant.id || `V${prev.variants.length + 1}`,
        volume: Number(tempVariant.volume),
        sameMold: tempVariant.sameMold,
        moq: Number(tempVariant.moq),
        status: tempVariant.status,
      }],
    }));
    setTempVariant({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
    setErrors(prev => ({ ...prev, varVolume: '' }));
  };
  const handleRemoveVariant = (idx: number) => setFormData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }));

  // Vendor ops
  const handleAddVendor = () => {
    if (!tempVendor.name.trim()) { addToast('error', 'Vendor name required'); return; }
    setFormData(prev => ({
      ...prev,
      vendors: [...prev.vendors, {
        name: tempVendor.name, location: tempVendor.location,
        moq: Number(tempVendor.moq), price: Number(tempVendor.price),
        leadTime: Number(tempVendor.leadTime), approved: tempVendor.approved,
        priceType: tempVendor.priceType, validTill: tempVendor.validTill,
        sampleCost: Number(tempVendor.sampleCost),
      }],
    }));
    setTempVendor({ name: '', location: '', moq: '', price: '', leadTime: '', approved: '', priceType: '', validTill: '', sampleCost: '' });
  };
  const handleRemoveVendor = (idx: number) => setFormData(prev => ({ ...prev, vendors: prev.vendors.filter((_, i) => i !== idx) }));

  // Test ops
  const handleAddTest = () => {
    if (!tempTest.name || !tempTest.result) { addToast('error', 'Select test + result'); return; }
    setFormData(prev => ({
      ...prev,
      tests: [...prev.tests, { name: tempTest.name, result: tempTest.result, date: tempTest.date, by: tempTest.by, remarks: tempTest.remarks }],
    }));
    setTempTest({ name: '', result: '', date: '', by: '', remarks: '' });
  };
  const handleRemoveTest = (idx: number) => setFormData(prev => ({ ...prev, tests: prev.tests.filter((_, i) => i !== idx) }));

  const handleReset = () => {
    if (window.confirm('Reset all form data? This cannot be undone.')) {
      setGeneratedCode('');
      setFormData(prev => ({ ...prev, itemCode: '', pmCategory: '', status: 'Draft', version: 'v1.0' }));
      setCurrentSection(0);
      addToast('info', 'Form reset');
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ ...formData, itemCode: generatedCode || formData.itemCode }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PM_${generatedCode || 'draft'}.json`;
    a.click();
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          setFormData(prev => ({ ...prev, ...parsed }));
          if (parsed.itemCode) setGeneratedCode(parsed.itemCode);
          addToast('success', 'JSON imported');
        } catch { addToast('error', 'Invalid JSON file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!formData.pmCategory) { addToast('error', 'Select PM Category first (Section 0)'); return; }
    if (!generatedCode && !formData.itemCode) { addToast('error', 'Generate item code before submitting'); return; }
    const code = generatedCode || formData.itemCode;
    const firstVendor = formData.vendors[0];
    const payload = {
      code,
      description: formData.name || `PM Item ${code}`,
      type: formData.itemCategory || formData.pmCategory || undefined,
      level: formData.level || undefined,
      group: formData.subCategory || undefined,
      material: formData.matBody || undefined,
      size_spec: formData.specNominal || undefined,
      price_per_pc: firstVendor?.price != null ? Number(firstVendor.price) : undefined,
      moq: firstVendor?.moq != null ? Number(firstVendor.moq) : undefined,
      lead_time_days: firstVendor?.leadTime != null ? Number(firstVendor.leadTime) : undefined,
      print_status: formData.deco || undefined,
    };
    try {
      await createPackMaterial(payload);
      localStorage.removeItem('packaging_draft_new');
      addToast('success', 'Packaging item saved!');
      setBprRefreshKey(k => k + 1);
      setPageTab('bpr');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save pack material');
    }
  };

  // ── Section Content ──────────────────────────────────────────────────────────
  const renderSection = () => {
    const { prefix, next } = getCodePreview();

    switch (currentSection) {
      case 0:
        return (
          <div className="space-y-6">
            {/* PM Category — Industry Buckets */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">PM Category (Industry Buckets)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PM Category</label>
                  <select
                    id="pmCategory"
                    value={formData.pmCategory}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {Object.entries(PM_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QC Inspection Group</label>
                  <select
                    id="qcGroup"
                    value={formData.qcGroup}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {QC_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub‑Category <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    id="subCategory"
                    value={formData.subCategory}
                    onChange={handleInputChange}
                    placeholder="e.g. Airless bottle / Flip-top cap / BOPP label / 5-ply shipper"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Storage Location Type</label>
                  <select
                    id="storeLoc"
                    value={formData.storeLoc}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {STORAGE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Code Series Preview */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Code Series Preview</h3>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-6 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Series Prefix</p>
                    <p className="font-mono font-bold text-gray-800 text-sm">{prefix}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Next Code (preview)</p>
                    <p className="font-mono font-bold text-gray-800 text-sm">{prefix !== '—' ? `${prefix}-${next}` : '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => generateCode()}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
                  >
                    Generate Code Now
                  </button>
                  {generatedCode && (
                    <button
                      type="button"
                      onClick={() => generateCode(true)}
                      className="px-4 py-1.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition"
                    >
                      Regenerate (change category)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, ...PACKAGING_FORM_MOCK }))}
                    className="px-4 py-1.5 border border-amber-300 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-50 transition"
                  >
                    Fill mock values
                  </button>
                </div>
              </div>
            </div>

            {/* Basic Details */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Basic Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="SKU / Internal Code"
                  id="pkgSku"
                  value={formData.pkgSku}
                  onChange={handleInputChange}
                  placeholder="Internal code used in ERP (e.g. PKG-000123)"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                  <select id="pkgUnit" value={formData.pkgUnit} onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['PCS', 'GM', 'ML', 'L', 'KG'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <InputField
                  label="HSN Code"
                  id="pkgHsn"
                  value={formData.pkgHsn}
                  onChange={handleInputChange}
                  placeholder="e.g. 3923, 4819, 7010"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Preference</label>
                  <select id="pkgTaxPreference" value={formData.pkgTaxPreference} onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input type="checkbox" id="pkgReturnable" checked={formData.pkgReturnable} onChange={handleInputChange}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                <label htmlFor="pkgReturnable" className="text-sm text-gray-700">Returnable Item</label>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Associate Items</label>
                <textarea
                  id="pkgAssociateItems"
                  value={formData.pkgAssociateItems}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Link related BOM / RM / secondary packaging if any"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        );

      case 1: // Identity
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Item Name"
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Packaging item name as used internally"
              />
              <InputField
                label="Level"
                id="level"
                value={formData.level}
                onChange={handleInputChange}
                placeholder="e.g. Primary / Secondary / Tertiary"
              />
              <InputField
                label="Category"
                id="itemCategory"
                value={formData.itemCategory}
                onChange={handleInputChange}
                placeholder="e.g. Bottle, Carton, Label, Shipper"
              />
              <InputField
                label="Intended Use"
                id="intendedUse"
                value={formData.intendedUse}
                onChange={handleInputChange}
                placeholder="e.g. Face serum bottle, Outer mono-carton"
              />
              <InputField
                label="Expected Product Types"
                id="expectedProductTypes"
                value={formData.expectedProductTypes}
                onChange={handleInputChange}
                placeholder="e.g. Creams, Serums, Shampoos"
              />
              <InputField
                label="Reusability"
                id="reusability"
                value={formData.reusability}
                onChange={handleInputChange}
                placeholder="e.g. Single use, Refillable, Re-closable"
              />
            </div>
            <TextareaField
              label="Regulatory Notes"
              id="regulatory"
              value={formData.regulatory}
              onChange={handleInputChange}
              placeholder="Any packaging-specific regulations or country notes"
            />
            <TextareaField
              label="Identity Notes"
              id="identityNotes"
              value={formData.identityNotes}
              onChange={handleInputChange}
              placeholder="Any extra description to identify this item uniquely"
            />
          </div>
        );

      case 2: // Material & Specs
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Material</h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Body Material"
                  id="matBody"
                  value={formData.matBody}
                  onChange={handleInputChange}
                  placeholder="e.g. PET, Glass, HDPE"
                />
                <InputField
                  label="Closure Material"
                  id="matClosure"
                  value={formData.matClosure}
                  onChange={handleInputChange}
                  placeholder="e.g. PP cap, Pump, Dropper"
                />
                <InputField
                  label="Inner Material"
                  id="matInner"
                  value={formData.matInner}
                  onChange={handleInputChange}
                  placeholder="e.g. LDPE liner, Pouch film"
                />
                <InputField
                  label="Grade"
                  id="matGrade"
                  value={formData.matGrade}
                  onChange={handleInputChange}
                  placeholder="e.g. Pharma grade, Food grade"
                />
              </div>
              <div className="flex gap-6 mt-3">
                <CheckboxField label="Recyclable" id="matRecycle" checked={formData.matRecycle} onChange={handleInputChange} />
                <CheckboxField label="BPA Free" id="matBpa" checked={formData.matBpa} onChange={handleInputChange} />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Specifications</h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Nominal Volume"
                  id="specNominal"
                  value={formData.specNominal}
                  onChange={handleInputChange}
                  placeholder="Declared fill volume (e.g. 50 ml)"
                />
                <InputField
                  label="Brimful Volume"
                  id="specBrimful"
                  value={formData.specBrimful}
                  onChange={handleInputChange}
                  placeholder="Total capacity at brim"
                />
                <InputField
                  label="Height (mm)"
                  id="specHeight"
                  value={formData.specHeight}
                  onChange={handleInputChange}
                  placeholder="Total height of pack"
                />
                <InputField
                  label="Diameter (mm)"
                  id="specDia"
                  value={formData.specDia}
                  onChange={handleInputChange}
                  placeholder="Body diameter"
                />
                <InputField
                  label="Neck (mm)"
                  id="specNeck"
                  value={formData.specNeck}
                  onChange={handleInputChange}
                  placeholder="Neck / thread spec"
                />
                <InputField
                  label="Weight (g)"
                  id="specWeight"
                  value={formData.specWeight}
                  onChange={handleInputChange}
                  placeholder="Empty component weight"
                />
                <InputField
                  label="Wall Thickness (mm)"
                  id="specWall"
                  value={formData.specWall}
                  onChange={handleInputChange}
                  placeholder="Critical wall thickness if applicable"
                />
                <InputField
                  label="Tech Link / Reference"
                  id="specLink"
                  value={formData.specLink}
                  onChange={handleInputChange}
                  placeholder="Link to drawing / spec sheet"
                />
              </div>
            </div>
          </div>
        );

      case 3: // Aesthetics
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Color Type"
                id="colorType"
                value={formData.colorType}
                onChange={handleInputChange}
                placeholder="e.g. Solid, Transparent, Frosted"
              />
              <InputField
                label="Color Code"
                id="colorCode"
                value={formData.colorCode}
                onChange={handleInputChange}
                placeholder="e.g. Pantone, HEX, or vendor shade code"
              />
              <InputField
                label="Finish"
                id="finish"
                value={formData.finish}
                onChange={handleInputChange}
                placeholder="e.g. Glossy, Matte, Soft-touch"
              />
              <InputField
                label="Decoration"
                id="deco"
                value={formData.deco}
                onChange={handleInputChange}
                placeholder="e.g. Screen print, Hot foil, Label, Embossing"
              />
            </div>
            <TextareaField
              label="Images / References"
              id="images"
              value={formData.images}
              onChange={handleInputChange}
              placeholder="Links or notes for reference artwork, mood boards, or sample packs"
            />
          </div>
        );

      case 4: // Variants Matrix
        return (
          <ArrayItemManager
            masterType="packaging"
            itemType="variant"
            items={formData.variants}
            tempFields={tempVariant}
            onTempFieldChange={(field, value) => setTempVariant(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddVariant}
            onRemove={handleRemoveVariant}
            errors={errors}
            itemLabel="Variant"
            columns={[
              { key: 'id', label: 'Variant ID' },
              { key: 'volume', label: 'Volume (ml)', type: 'number' },
              { key: 'sameMold', label: 'Same Mold' },
              { key: 'moq', label: 'MOQ', type: 'number' },
              { key: 'status', label: 'Status' },
            ]}
          />
        );

      case 5: // Customization & Tooling
        return (
          <div className="space-y-4">
            <CheckboxField label="Customizable" id="cusCustomizable" checked={formData.cusCustomizable} onChange={handleInputChange} />
            <TextareaField label="Customization Parameters" id="cusParams" value={formData.cusParams} onChange={handleInputChange} />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Standard MOQ" id="cusStdMoq" value={formData.cusStdMoq} onChange={handleInputChange} />
              <InputField label="Custom MOQ" id="cusCustomMoq" value={formData.cusCustomMoq} onChange={handleInputChange} />
              <InputField label="Tooling Required" id="cusToolingReq" value={formData.cusToolingReq} onChange={handleInputChange} />
              <InputField label="Tooling Cost" id="cusToolingCost" value={formData.cusToolingCost} onChange={handleInputChange} />
              <InputField label="Sampling Lead Time" id="cusSamplingLT" value={formData.cusSamplingLT} onChange={handleInputChange} />
              <InputField label="Bulk Lead Time (Std)" id="cusBulkLTStd" value={formData.cusBulkLTStd} onChange={handleInputChange} />
              <InputField label="Bulk Lead Time (Custom)" id="cusBulkLTCustom" value={formData.cusBulkLTCustom} onChange={handleInputChange} />
            </div>
            <TextareaField label="Customization Remarks" id="cusRemarks" value={formData.cusRemarks} onChange={handleInputChange} />
          </div>
        );

      case 6: // Compatibility (R&D / QA)
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-[220px,1fr] gap-6 items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-1">
                Viscosity Compatibility
              </p>
              <div className="flex flex-wrap gap-3">
                <PillCheckboxField label="Low" id="compLow" checked={formData.compLow} onChange={handleInputChange} />
                <PillCheckboxField label="Medium" id="compMed" checked={formData.compMed} onChange={handleInputChange} />
                <PillCheckboxField label="High" id="compHigh" checked={formData.compHigh} onChange={handleInputChange} />
              </div>
            </div>

            <div className="grid grid-cols-[220px,1fr] gap-6 items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-1">
                Chemical Compatibility
              </p>
              <div className="flex flex-wrap gap-3">
                <PillCheckboxField label="Oil Compatible" id="compOil" checked={formData.compOil} onChange={handleInputChange} color="red" />
                <PillCheckboxField label="Alcohol Compatible" id="compAlc" checked={formData.compAlc} onChange={handleInputChange} color="red" />
                <PillCheckboxField label="Airless Compatible" id="compAirless" checked={formData.compAirless} onChange={handleInputChange} color="red" />
              </div>
            </div>

            <div className="grid grid-cols-[220px,1fr] gap-6 items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-1">
                Functional Compatibility
              </p>
              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-wrap gap-3">
                  <PillCheckboxField label="Pump Compatible" id="compPump" checked={formData.compPump} onChange={handleInputChange} />
                  <PillCheckboxField label="Leak Proof" id="compLeak" checked={formData.compLeak} onChange={handleInputChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Actives Compatible" id="compActives" value={formData.compActives} onChange={handleInputChange} />
                  <InputField label="Risk Level" id="compRisk" value={formData.compRisk} onChange={handleInputChange} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[220px,1fr] gap-6 items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-2">
                Compatibility Remarks
              </p>
              <TextareaField label="" id="compRemarks" value={formData.compRemarks} onChange={handleInputChange} />
            </div>
          </div>
        );

      case 7: // Vendors & Commercial
        return (
          <ArrayItemManager
            masterType="packaging"
            itemType="vendor"
            items={formData.vendors}
            tempFields={tempVendor}
            onTempFieldChange={(field, value) => setTempVendor(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddVendor}
            onRemove={handleRemoveVendor}
            errors={errors}
            itemLabel="Vendor"
            columns={[
              { key: 'name', label: 'Vendor Name' },
              { key: 'location', label: 'Location' },
              { key: 'moq', label: 'MOQ', type: 'number' },
              { key: 'price', label: 'Unit Price', type: 'number' },
              { key: 'leadTime', label: 'Lead Time (days)', type: 'number' },
              { key: 'approved', label: 'Approved' },
              { key: 'priceType', label: 'Price Type' },
              { key: 'validTill', label: 'Valid Till', type: 'date' },
              { key: 'sampleCost', label: 'Sample Cost', type: 'number' },
            ]}
          />
        );

      case 8: // Secondary Packaging
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Label Type" id="secLabelType" value={formData.secLabelType} onChange={handleInputChange} />
              <InputField label="Label Size" id="secLabelSize" value={formData.secLabelSize} onChange={handleInputChange} />
              <InputField label="Adhesive Type" id="secAdhesive" value={formData.secAdhesive} onChange={handleInputChange} />
              <InputField label="Label Compatibility" id="secLabelCompat" value={formData.secLabelCompat} onChange={handleInputChange} />
              <InputField label="Paper GSM" id="secGsm" value={formData.secGsm} onChange={handleInputChange} />
              <InputField label="Carton Finish" id="secCartonFinish" value={formData.secCartonFinish} onChange={handleInputChange} />
              <InputField label="Fit & Finish" id="secFit" value={formData.secFit} onChange={handleInputChange} />
              <InputField label="Art Link" id="secArtLink" value={formData.secArtLink} onChange={handleInputChange} />
            </div>
            <TextareaField label="Secondary Packaging Notes" id="secNotes" value={formData.secNotes} onChange={handleInputChange} />
          </div>
        );

      case 9: // Tertiary Packaging
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Shipper Type" id="terShipType" value={formData.terShipType} onChange={handleInputChange} />
              <InputField label="Units per Shipper" id="terUnits" value={formData.terUnits} onChange={handleInputChange} />
              <InputField label="Drop Test (m)" id="terDrop" value={formData.terDrop} onChange={handleInputChange} />
              <InputField label="Stack Height (units)" id="terStack" value={formData.terStack} onChange={handleInputChange} />
            </div>
            <TextareaField label="Tertiary Packaging Notes" id="terNotes" value={formData.terNotes} onChange={handleInputChange} />
          </div>
        );

      case 10: // Testing & Approval
        return (
          <>
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Approvals</h3>
              <div className="grid grid-cols-2 gap-4">
                <CheckboxField label="Approved by Packaging" id="apprPack" checked={formData.apprPack} onChange={handleInputChange} />
                <CheckboxField label="Approved by R&D" id="apprRd" checked={formData.apprRd} onChange={handleInputChange} />
                <CheckboxField label="Approved by Finance" id="apprFin" checked={formData.apprFin} onChange={handleInputChange} />
                <CheckboxField label="Lock for Modification" id="apprLock" checked={formData.apprLock} onChange={handleInputChange} />
              </div>
            </div>
            <ArrayItemManager
              masterType="packaging"
              itemType="test"
              items={formData.tests}
              tempFields={tempTest}
              onTempFieldChange={(field, value) => setTempTest(prev => ({ ...prev, [field]: value }))}
              onAdd={handleAddTest}
              onRemove={handleRemoveTest}
              errors={errors}
              itemLabel="Test"
              columns={[
                { key: 'name', label: 'Test Name' },
                { key: 'result', label: 'Result' },
                { key: 'date', label: 'Test Date', type: 'date' },
                { key: 'by', label: 'Tested By' },
                { key: 'remarks', label: 'Remarks' },
              ]}
            />
          </>
        );

      case 11: // Catalogue / Website
        return (
          <div className="space-y-4">
            <div className="flex gap-6">
              <CheckboxField label="Visible on Catalogue" id="catVisible" checked={formData.catVisible} onChange={handleInputChange} />
              <CheckboxField label="Share with Clients" id="catShare" checked={formData.catShare} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Web Display Name" id="catWebName" value={formData.catWebName} onChange={handleInputChange} />
              <InputField label="Tags (comma-separated)" id="catTags" value={formData.catTags} onChange={handleInputChange} />
              <InputField label="Recommended Product Types" id="catRecoTypes" value={formData.catRecoTypes} onChange={handleInputChange} />
            </div>
            <TextareaField label="Web Images" id="catWebImages" value={formData.catWebImages} onChange={handleInputChange} />
          </div>
        );

      case 12: // Review / JSON
        return (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Complete Form Data (JSON)</h3>
            <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[60vh] border border-gray-200">
              {JSON.stringify({ ...formData, itemCode: generatedCode || formData.itemCode }, null, 2)}
            </pre>
          </div>
        );

      default:
        return null;
    }
  };

  // ── BPR tab ──────────────────────────────────────────────────────────────────
  if (pageTab === 'bpr') return <BprDashboard refreshKey={bprRefreshKey} onSwitchToForm={() => setPageTab('form')} />;

  // ── Main two-panel layout ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setPageTab('bpr')}
              className="text-sm text-indigo-600 hover:underline font-medium shrink-0"
            >
              ← BPR Dashboard
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-base font-bold text-gray-800 leading-tight truncate">
              Packaging Item Onboarding (PM)
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => doSave(false)}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Save
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Export JSON
            </button>
            <button
              onClick={handleImportJSON}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Import JSON
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition"
            >
              Submit
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: Sidebar + Content ─────────────────────────────────────────── */}
      <div className="flex-1">
        <div className="flex gap-4 items-stretch max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-4">

          {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
          <aside className="w-60 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col shrink-0 overflow-y-auto">
          {/* Sections header + autosave */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Sections</span>
              <button
                onClick={() => setAutoSaveOn(prev => !prev)}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${autoSaveOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
              >
                Autosave: {autoSaveOn ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Status + Version */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-1">Item Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {['Draft', 'Active', 'Discontinued', 'Under Review'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="w-12">
              <label className="block text-[10px] text-gray-500 mb-1">Version</label>
              <div className="text-xs font-medium text-gray-700 pt-1">{formData.version}</div>
            </div>
          </div>

          {/* Section List */}
          <nav className="flex-1 px-2 py-2">
            {SECTIONS.map((section, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSection(idx)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium mb-0.5 transition-colors ${
                  currentSection === idx
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {section}
              </button>
            ))}
          </nav>

          {/* Stats */}
          <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-2 gap-x-3 gap-y-2 mt-auto">
            {[
              { label: 'Variants', value: formData.variants.length },
              { label: 'Vendors', value: formData.vendors.length },
              { label: 'Tests Logged', value: formData.tests.length },
              { label: 'Last Saved', value: lastSaved },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-[9px] uppercase text-gray-400 tracking-wide">{stat.label}</p>
                <p className="text-sm font-bold text-gray-700">{stat.value}</p>
              </div>
            ))}
          </div>

        </aside>

        {/* ── RIGHT CONTENT ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
          {/* Content header with Prev/Next */}
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-800">{SECTIONS[currentSection]}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
                  disabled={currentSection === 0}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentSection(prev => Math.min(SECTIONS.length - 1, prev + 1))}
                  disabled={currentSection === SECTIONS.length - 1}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* Section body */}
          <div className="px-4 py-6">
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-6">
                {renderSection()}
              </div>
            </div>
          </div>
        </main>
        </div>
      </div>
    </div>
  );
};

// ─── Pack Materials Dashboard ─────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
 Monocarton:  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
 Bottle:      { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
 Label:       { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
 Closure:     { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
 Pump:        { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
 Tube:        { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
};

const PRINT_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
 'Approved':           { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
 'Label awaited':      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
 'Artwork approved':   { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
 'N/A':                { bg: 'bg-gray-50',    text: 'text-gray-500',    border: 'border-gray-200' },
};

function formatPrice(n: number) {
 return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0 });
}

function GroupChipPM({ group }: { group: string }) {
 const isPrimary = group.startsWith('Primary');
 const isAlt     = group.startsWith('Alt');
 const dotColor  = isPrimary ? 'bg-blue-500' : isAlt ? 'bg-emerald-500' : 'bg-gray-400';
 const label     = group.replace(' +1','').replace(' +2','');
 const extra     = group.includes('+1') ? '+1' : group.includes('+2') ? '+2' : '';
 return (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
   <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
   {label}
   {extra && <span className="ml-0.5 px-1 py-0.5 text-[10px] font-semibold bg-gray-100 rounded">{extra}</span>}
  </span>
 );
}

const BprDashboard: React.FC<{ refreshKey?: number; onSwitchToForm: () => void }> = ({ refreshKey = 0, onSwitchToForm }) => {
 const [search, setSearch] = useState('');
 const [typeFilter, setTypeFilter] = useState('');
 const [levelFilter, setLevelFilter] = useState('');
 const [sortAsc, setSortAsc] = useState(true);
 const [allPMs, setAllPMs] = useState<PackMaterialRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);

 const loadPackMaterials = useCallback(async () => {
  setLoading(true);
  setLoadError(null);
  try {
   const list = await fetchPackMaterialsList();
   setAllPMs(list);
  } catch (e) {
   setLoadError(e instanceof Error ? e.message : 'Failed to load pack materials');
   setAllPMs([]);
  } finally {
   setLoading(false);
  }
 }, []);

 useEffect(() => {
  loadPackMaterials();
 }, [loadPackMaterials, refreshKey]);

 const allTypes = Array.from(new Set(allPMs.map(p => p.type))).filter(Boolean).sort();
 const allLevels = Array.from(new Set(allPMs.map(p => p.level))).filter(Boolean).sort();

 const filtered = allPMs.filter(pm => {
  const q = search.toLowerCase();
  const matchQ = !q || pm.description.toLowerCase().includes(q) || pm.code.toLowerCase().includes(q) || pm.material.toLowerCase().includes(q);
  const matchType = !typeFilter || pm.type === typeFilter;
  const matchLevel = !levelFilter || pm.level === levelFilter;
  return matchQ && matchType && matchLevel;
 }).sort((a, b) => sortAsc ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code));

 const stats = {
  total:     allPMs.length,
  primary:   allPMs.filter(p => p.level === 'Primary').length,
  secondary: allPMs.filter(p => p.level === 'Secondary').length,
  groups:    allPMs.filter(p => p.group).length,
  types:     new Set(allPMs.map(p => p.type)).size,
 };

 const statCards = [
  { label: 'TOTAL PMS',  value: stats.total,     sub: 'Packaging materials',  accent: 'border-l-violet-500', num: 'text-violet-600' },
  { label: 'PRIMARY',    value: stats.primary,   sub: 'Direct contact',       accent: 'border-l-blue-500',   num: 'text-blue-600' },
  { label: 'SECONDARY',  value: stats.secondary, sub: 'Outer packaging',      accent: 'border-l-teal-500',   num: 'text-teal-600' },
  { label: 'PM GROUPS',  value: stats.groups,    sub: 'With affinities',      accent: 'border-l-orange-500', num: 'text-orange-600' },
  { label: 'PACK TYPES', value: stats.types,     sub: 'Tube, Bottle...',      accent: 'border-l-rose-500',   num: 'text-rose-600' },
 ];

 return (
  <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
   <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

    {/* ── Page Header ── */}
    <div className="relative">
     <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
     <div className="relative">
      <div className="inline-flex items-center gap-2 mb-3">
       <span className="text-3xl">📦</span>
       <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">PM Masters</span>
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Pack Materials</h1>
      <p className="text-sm text-gray-600">Manage packaging masters — tubes, bottles, cartons, labels, closures and their vendor details.</p>
     </div>
    </div>

    {/* ── Loading / Error ── */}
    {loading && (
     <div className="flex items-center justify-center py-12 text-gray-500">
      <span className="animate-pulse">Loading pack materials…</span>
     </div>
    )}
    {!loading && loadError && (
     <div className="py-8 text-center">
      <p className="text-red-600 mb-2">{loadError}</p>
      <button type="button" onClick={loadPackMaterials} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Retry</button>
     </div>
    )}

    {!loading && !loadError && (
     <>
    {/* ── Stat Cards ── */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
     {statCards.map(card => (
      <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
       <div className={`h-1 bg-linear-to-r from-violet-400 to-violet-600 ${card.accent}`} />
       <div className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
        <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
        <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
       </div>
      </div>
     ))}
    </div>

    {/* ── Table Card ── */}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

     {/* toolbar */}
     <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
      <div className="flex items-center gap-2 min-w-0">
       <span className="text-sm font-semibold text-gray-900">Packaging Material Masters</span>
       <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200/50">{filtered.length} / {allPMs.length}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
       {/* search */}
       <div className="relative group">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
        </svg>
        <input
         value={search}
         onChange={e => setSearch(e.target.value)}
         placeholder="Search code, type…"
         className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all w-44"
        />
       </div>
       {/* type filter */}
       <select
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-3.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all hover:bg-gray-100"
       >
        <option value="">All Types</option>
        {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
       </select>
       {/* level filter */}
       <select
        value={levelFilter}
        onChange={e => setLevelFilter(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-3.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all hover:bg-gray-100"
       >
        <option value="">All Levels</option>
        {allLevels.map(l => <option key={l} value={l}>{l}</option>)}
       </select>
       {/* new PM button */}
       <button
        onClick={onSwitchToForm}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
       >
        <span className="text-base leading-none">+</span> New PM
       </button>
      </div>
     </div>

     {/* table */}
     <div className="overflow-x-auto">
      <table className="w-full text-xs">
       <thead>
        <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
         <th
          className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-gray-900 hover:bg-slate-100/50 transition-colors"
          onClick={() => setSortAsc(p => !p)}
         >
          CODE <span className="text-violet-500">{sortAsc ? '↑' : '↓'}</span>
         </th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Description</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Type</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Level</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Group</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Material</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Size / Spec</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Price/PC</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">MOQ</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Lead Time</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Print Status</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Products</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-50">
        {filtered.length === 0 ? (
         <tr>
          <td colSpan={12} className="px-4 py-12 text-center text-gray-400 text-sm">
           <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            No packaging materials match your search.
           </div>
          </td>
         </tr>
        ) : filtered.map((pm, _idx) => {
         const typeStyle = TYPE_STYLES[pm.type] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
         const printStyle = PRINT_STATUS_STYLES[pm.printStatus] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
         const levelBg = pm.level === 'Primary' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200';
         return (
          <tr key={pm.code} className="hover:bg-linear-to-r hover:from-violet-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
           {/* code */}
           <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-violet-700 whitespace-nowrap group-hover:text-violet-900">{pm.code}</td>
           {/* description */}
           <td className="px-4 py-3.5 font-semibold text-gray-900 whitespace-nowrap group-hover:text-violet-700 transition-colors">{pm.description}</td>
           {/* type badge */}
           <td className="px-4 py-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border} whitespace-nowrap`}>
             {pm.type}
            </span>
           </td>
           {/* level badge */}
           <td className="px-4 py-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${levelBg} whitespace-nowrap`}>
             {pm.level}
            </span>
           </td>
           {/* group */}
           <td className="px-4 py-3">
            {pm.group ? <GroupChipPM group={pm.group} /> : <span className="text-gray-300">—</span>}
           </td>
           {/* material */}
           <td className="px-4 py-3 text-gray-600">{pm.material}</td>
           {/* size/spec */}
           <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{pm.sizeSpec}</td>
           {/* price */}
           <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatPrice(pm.pricePerPc)}</td>
           {/* moq */}
           <td className="px-4 py-3 text-right text-gray-600">{pm.moq.toLocaleString('en-IN')}</td>
           {/* lead time */}
           <td className="px-4 py-3 text-right text-gray-600">{pm.leadTimeDays} days</td>
           {/* print status */}
           <td className="px-4 py-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${printStyle.bg} ${printStyle.text} ${printStyle.border} whitespace-nowrap`}>
             {pm.printStatus}
            </span>
           </td>
           {/* products */}
           <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
             {pm.products.map(p => (
              <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">{p}</span>
             ))}
            </div>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    </div>

     </>
    )}

   </div>
  </div>
 );
};

// ─── Small field helpers ──────────────────────────────────────────────────────
const InputField: React.FC<{
  label: string; id: string; value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string; placeholder?: string;
}> = ({ label, id, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input type={type} id={id} value={value ?? ''} onChange={onChange} placeholder={placeholder}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  </div>
);

const _SelectField: React.FC<{
  label: string; id: string; value: any;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}> = ({ label, id, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select id={id} value={value ?? ''} onChange={onChange}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
      <option value="">Select...</option>
      {options.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
    </select>
  </div>
);

const TextareaField: React.FC<{
  label: string; id: string; value: any;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; placeholder?: string;
}> = ({ label, id, value, onChange, rows = 3, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea id={id} value={value ?? ''} onChange={onChange} rows={rows} placeholder={placeholder}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  </div>
);

const CheckboxField: React.FC<{
  label: string; id: string; checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <input type="checkbox" id={id} checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
    <span className="text-gray-700">{label}</span>
  </label>
);

const PillCheckboxField: React.FC<{
  label: string;
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  color?: 'indigo' | 'red';
}> = ({ label, id, checked, onChange, color = 'indigo' }) => {
  const base =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors';
  const activeColor =
    color === 'red'
      ? 'bg-red-50 border-red-300 text-red-700'
      : 'bg-indigo-50 border-indigo-300 text-indigo-700';
  const inactiveColor = 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50';

  return (
    <label
      htmlFor={id}
      className={`${base} ${checked ? activeColor : inactiveColor}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          checked
            ? color === 'red'
              ? 'bg-red-500'
              : 'bg-indigo-500'
            : 'bg-gray-300'
        }`}
      />
      <span>{label}</span>
    </label>
  );
};

export default PackagingRefactored;
