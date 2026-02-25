import React, { useState, useEffect } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import { getPrimaryFields, validatePrimaryFields } from '../utils/masterFormUtils';
import { useGlobalState } from '../context/GlobalStateContext';
import BMRPrintTemplate from '../components/ordermanagementcomp/BMRPrintTemplate';
import ConsolidatedMRModal from '../components/ordermanagementcomp/ConsolidatedMRModal';

const BOMRefactored: React.FC = () => {
  const { addItem } = useItems();
  const { addToast } = useToast();
  const [pageTab, setPageTab] = useState<'bom' | 'bmr'>('bmr');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStage, setCurrentStage] = useState(0);
  const [_printBmr, _setPrintBmr] = useState<any>(null);
  const [_consolidatedMRIds, _setConsolidatedMRIds] = useState<string[] | null>(null);
  const [_selectedBmrIds, _setSelectedBmrIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    // Primary Info
    bomCode: '',
    bomSku: '',
    bomCategory: '',
    bomUnit: 'GM',
    bomHsn: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',

    // BOM Setup & Coding
    type: 'BULK',
    status: 'Draft',
    version: 'v1.0',
    client: '',
    name: '',
    dosage: '',
    packSize: '',
    site: '',
    category: '',
    claims: '',
    project: '',
    market: '',
    createdBy: '',
    reviewedBy: '',
    desc: '',

    // Specs & Yield
    specBulk: '',
    specProcess: '',
    specFg: '',
    specPack: '',
    specTests: '',
    specRelease: '',
    batch: '',
    yield: '',
    overage: '',
    line: '',
    notes: '',

    // Header / regulatory extras
    regulatory: '',
    phRange: '',
    description: '',

    // ARRAYS (no temp fields!)
    rmLines: [] as Array<{
      code: string;
      name: string;
      phase: string;
      func: string;
      pct: number;
      uom: string;
      spec: string;
      notes: string;
    }>,

    pmLines: [] as Array<{
      code: string;
      name: string;
      cat: string;
      qty: number;
      uom: string;
      notes: string;
    }>,
  });

  // Temp fields separated
  const [tempRMLine, setTempRMLine] = useState({
    code: '', name: '', phase: '', func: '', pct: '', uom: 'GM', spec: '', notes: ''
  });
  const [tempPMLine, setTempPMLine] = useState({
    code: '', name: '', cat: '', qty: '', uom: 'PCS', notes: ''
  });

  // Auto-save draft
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.values(formData).some(v => Boolean(v))) {
        localStorage.setItem('bom_draft_new', JSON.stringify(formData));
        addToast('info', 'BOM draft auto-saved');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, addToast]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('bom_draft_new');
    if (draft) {
      try {
        setFormData(JSON.parse(draft));
      } catch (e) {
      }
    }
  }, []);

  const stages = [
    'Primary Info',
    'BOM Setup & Coding',
    'Header Details & Formulation (RM Items)',
    'Packaging (FG PM Items)',
    'Specifications',
    'Yield, Batch & Notes',
    'Review / JSON',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // RM Line operations
  const handleAddRMLine = () => {
    if (!tempRMLine.name.trim()) {
      setErrors(prev => ({ ...prev, rmName: 'RM Name is required' }));
      addToast('error', 'RM Name is required');
      return;
    }
    if (!tempRMLine.pct || Number(tempRMLine.pct) <= 0) {
      setErrors(prev => ({ ...prev, rmPct: 'Enter % w/w' }));
      addToast('error', 'Enter % w/w');
      return;
    }

    setFormData(prev => ({
      ...prev,
      rmLines: [...prev.rmLines, {
        code: tempRMLine.code,
        name: tempRMLine.name,
        phase: tempRMLine.phase,
        func: tempRMLine.func,
        pct: Number(tempRMLine.pct),
        uom: tempRMLine.uom,
        spec: tempRMLine.spec,
        notes: tempRMLine.notes,
      }]
    }));
    setTempRMLine({ code: '', name: '', phase: '', func: '', pct: '', uom: 'GM', spec: '', notes: '' });
    setErrors(prev => ({ ...prev, rmName: '', rmPct: '' }));
  };

  const handleRemoveRMLine = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      rmLines: prev.rmLines.filter((_, i) => i !== idx)
    }));
  };

  // PM Line operations
  const handleAddPMLine = () => {
    if (!tempPMLine.name.trim()) {
      setErrors(prev => ({ ...prev, pmName: 'PM Name is required' }));
      addToast('error', 'PM Name is required');
      return;
    }
    if (!tempPMLine.qty || Number(tempPMLine.qty) <= 0) {
      setErrors(prev => ({ ...prev, pmQty: 'Enter quantity' }));
      addToast('error', 'Enter quantity');
      return;
    }

    setFormData(prev => ({
      ...prev,
      pmLines: [...prev.pmLines, {
        code: tempPMLine.code,
        name: tempPMLine.name,
        cat: tempPMLine.cat,
        qty: Number(tempPMLine.qty),
        uom: tempPMLine.uom,
        notes: tempPMLine.notes,
      }]
    }));
    setTempPMLine({ code: '', name: '', cat: '', qty: '', uom: 'PCS', notes: '' });
    setErrors(prev => ({ ...prev, pmName: '', pmQty: '' }));
  };

  const handleRemovePMLine = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      pmLines: prev.pmLines.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = () => {
    const validation = validatePrimaryFields(formData, 'bom');
    if (!validation.valid) {
      setErrors(validation.errors);
      addToast('error', 'Please fill all primary fields');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      type: 'bom' as const,
      name: formData.name || 'Unnamed BOM',
      code: formData.bomCode || 'BOM-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      data: formData,
    };
    addItem(newItem);
    addToast('success', 'BOM saved successfully!');
    localStorage.removeItem('bom_draft_new');
  };

  // Stage content rendering
  const renderStageContent = () => {
    switch (currentStage) {
      case 0: // Primary Info
        return (
          <div className="space-y-4">
            <InputField label="BOM Code" id="bomCode" value={formData.bomCode} onChange={handleInputChange} />
            <InputField label="BOM SKU" id="bomSku" value={formData.bomSku} onChange={handleInputChange} />
            <InputField label="Category" id="bomCategory" value={formData.bomCategory} onChange={handleInputChange} />
            <SelectField label="Unit of Measure" id="bomUnit" value={formData.bomUnit} onChange={handleInputChange}
              options={['GM', 'ML', 'PCS', 'L', 'KG']} />
            <InputField label="HSN Code" id="bomHsn" value={formData.bomHsn} onChange={handleInputChange} />
            <SelectField label="Tax Preference" id="bomTaxPreference" value={formData.bomTaxPreference} onChange={handleInputChange}
              options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']} />
            <CheckboxField label="Returnable Item" id="bomReturnable" checked={formData.bomReturnable} onChange={handleInputChange} />
            <TextareaField label="Associate Items" id="bomAssociateItems" value={formData.bomAssociateItems} onChange={handleInputChange} />
          </div>
        );

      case 1: // BOM Setup & Coding
        return (
          <div className="space-y-4">
            <SelectField label="Type" id="type" value={formData.type} onChange={handleInputChange}
              options={['BULK', 'FG', 'SEMI', 'INTERMEDIATE']} />
            <SelectField label="Status" id="status" value={formData.status} onChange={handleInputChange}
              options={['Draft', 'Approved', 'Archived', 'Deprecated']} />
            <InputField label="Version" id="version" value={formData.version} onChange={handleInputChange} />
            <InputField label="Client" id="client" value={formData.client} onChange={handleInputChange} />
            <InputField label="Name" id="name" value={formData.name} onChange={handleInputChange} />
            <InputField label="Dosage (e.g., 10% w/w)" id="dosage" value={formData.dosage} onChange={handleInputChange} />
            <InputField label="Pack Size" id="packSize" value={formData.packSize} onChange={handleInputChange} />
            <InputField label="Site/Plant" id="site" value={formData.site} onChange={handleInputChange} />
            <InputField label="Project" id="project" value={formData.project} onChange={handleInputChange} />
            <InputField label="Market" id="market" value={formData.market} onChange={handleInputChange} />
          </div>
        );

      case 2: // Header Details & Formulation (RM Items)
        return (
          <div className="space-y-6">
            {/* Header Details Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Header Details</h3>
              <div className="space-y-4">
                <InputField label="Category (FMCG, Pharma, etc.)" id="category" value={formData.category} onChange={handleInputChange} />
                <InputField label="Created By" id="createdBy" value={formData.createdBy} onChange={handleInputChange} />
                <InputField label="Reviewed By" id="reviewedBy" value={formData.reviewedBy} onChange={handleInputChange} />
                <TextareaField label="Description" id="desc" value={formData.desc} onChange={handleInputChange} />
                <TextareaField label="Claims" id="claims" value={formData.claims} onChange={handleInputChange} />
                <TextareaField label="Regulatory Notes" id="regulatory" value={formData.regulatory} onChange={handleInputChange} />
                <InputField label="pH Range" id="phRange" value={formData.phRange} onChange={handleInputChange} />
              </div>
            </div>

            {/* Formulation (RM Items) Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Formulation - Raw Materials</h3>
              <ArrayItemManager
                masterType="bom"
                itemType="rmLine"
                items={formData.rmLines}
                tempFields={tempRMLine}
                onTempFieldChange={(field, value) => setTempRMLine(prev => ({ ...prev, [field]: value }))}
                onAdd={handleAddRMLine}
                onRemove={handleRemoveRMLine}
                errors={errors}
                itemLabel="Raw Material Line"
                columns={[
                  { key: 'code', label: 'RM Code' },
                  { key: 'name', label: 'RM Name' },
                  { key: 'phase', label: 'Phase' },
                  { key: 'func', label: 'Function' },
                  { key: 'pct', label: '% w/w', type: 'number' },
                  { key: 'uom', label: 'UoM' },
                  { key: 'spec', label: 'Spec' },
                  { key: 'notes', label: 'Notes' },
                ]}
              />
            </div>
          </div>
        );

      case 3: // Packaging (PM Items) - renumbered from 4
        return (
          <ArrayItemManager
            masterType="bom"
            itemType="pmLine"
            items={formData.pmLines}
            tempFields={tempPMLine}
            onTempFieldChange={(field, value) => setTempPMLine(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddPMLine}
            onRemove={handleRemovePMLine}
            errors={errors}
            itemLabel="Packaging Material Line"
            columns={[
              { key: 'code', label: 'PM Code' },
              { key: 'name', label: 'PM Name' },
              { key: 'cat', label: 'Category' },
              { key: 'qty', label: 'Qty', type: 'number' },
              { key: 'uom', label: 'UoM' },
              { key: 'notes', label: 'Notes' },
            ]}
          />
        );

      case 4: // Specifications - renumbered from 5
        return (
          <div className="space-y-4">
            <TextareaField label="Bulk Specification" id="specBulk" value={formData.specBulk} onChange={handleInputChange} />
            <TextareaField label="Process Specification" id="specProcess" value={formData.specProcess} onChange={handleInputChange} />
            <TextareaField label="FG Specification" id="specFg" value={formData.specFg} onChange={handleInputChange} />
            <TextareaField label="Packaging Specification" id="specPack" value={formData.specPack} onChange={handleInputChange} />
            <TextareaField label="Testing Requirements" id="specTests" value={formData.specTests} onChange={handleInputChange} />
            <TextareaField label="Release Criteria" id="specRelease" value={formData.specRelease} onChange={handleInputChange} />
          </div>
        );

      case 5: // Yield, Batch & Notes - renumbered from 6
        return (
          <div className="space-y-4">
            <InputField label="Batch Lot Size" id="batch" value={formData.batch} onChange={handleInputChange} />
            <InputField label="Yield %" id="yield" value={formData.yield} onChange={handleInputChange} />
            <InputField label="Overage %" id="overage" value={formData.overage} onChange={handleInputChange} />
            <InputField label="Production Line" id="line" value={formData.line} onChange={handleInputChange} />
            <TextareaField label="General Notes" id="notes" value={formData.notes} onChange={handleInputChange} />
          </div>
        );

      case 6: // Review / JSON - renumbered from 7
        return (
          <div>
            <h3 className="font-semibold text-gray-700 mb-4">Complete Form Data (JSON)</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        );

      default:
        return <p>No content</p>;
    }
  };

  if (pageTab === 'bmr') return <BmrDashboard onSwitchToBOM={() => setPageTab('bom')} />;

  return (
    <MasterFormBase
      title="Bill of Materials (BOM) - Refactored"
      stages={stages}
      currentStage={currentStage}
      onStageChange={setCurrentStage}
      errors={errors}
      formData={formData}
      onInputChange={handleInputChange}
      primaryFields={getPrimaryFields('bom')}
      onSave={() => {
        localStorage.setItem('bom_draft_new', JSON.stringify(formData));
        addToast('success', 'Draft saved!');
      }}
      onSubmit={handleSubmit}
    >
      <div className="flex gap-2 mb-4">
        <button onClick={() => setPageTab('bmr')}
          className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
          ← BMR Dashboard
        </button>
      </div>
      {renderStageContent()}
    </MasterFormBase>
  );
};

// ─── BMR Dashboard ────────────────────────────────────────────────────────────
const BMR_STAGES = [
  'Draft', 'Confirmed', 'RM Issued', 'Mixing', 'IPT Check', 'Filling', 'QC Review', 'Completed'
];

const BmrDashboard: React.FC<{ onSwitchToBOM: () => void }> = ({ onSwitchToBOM }) => {
  const { state, dispatch } = useGlobalState();
  const bmrs: any[] = state.mfg?.bmrs || [];
  const bprs: any[] = state.mfg?.bprs || [];
  const salesOrders: any[] = state.orders?.salesOrders || [];

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ soId: '', batchSize: '', area: '', startDate: '', notes: '' });
  const [printBmr, setPrintBmr] = useState<any>(null);
  const [consolidatedMRIds, setConsolidatedMRIds] = useState<string[] | null>(null);
  const [selectedBmrIds, setSelectedBmrIds] = useState<string[]>([]);

  const selectedSO = salesOrders.find((s) => s.so === form.soId);

  const handleCreateBMR = () => {
    if (!form.soId || !form.batchSize) { alert('Select a Sales Order and batch size.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const bmrSeq = (state.mfg?.seq?.bmr || 1001);
    const bmrId = `BMR-${bmrSeq}`;
    const batchId = `BULK-${form.soId.replace('SO-', '')}-0${(state.mfg?.seq?.batch || 1)}`;
    const batch = {
      id: batchId, so: form.soId, clientName: selectedSO?.clientName || '',
      product: selectedSO?.notes || form.soId, batchSize: Number(form.batchSize),
      area: form.area, startDate: form.startDate || today, createdAt: today,
    };
    const bmr = {
      id: bmrId, batchId, so: form.soId, clientName: selectedSO?.clientName || '',
      product: selectedSO?.notes?.split('—')[0]?.trim() || form.soId,
      batchSize: Number(form.batchSize), area: form.area,
      stage: 0, createdAt: today, notes: form.notes,
    };
    dispatch({ type: 'CREATE_BMR_BATCH', payload: { batch, bmr } });
    setShowCreate(false);
    setForm({ soId: '', batchSize: '', area: '', startDate: '', notes: '' });
  };

  const advanceStage = (bmr: any) => {
    if (bmr.stage >= BMR_STAGES.length - 1) return;
    dispatch({ type: 'ADVANCE_BMR_STAGE', payload: { bmrId: bmr.id, newStage: bmr.stage + 1 } });
  };

  const completeQC = (bmr: any) => {
    const _today = new Date().toISOString().slice(0, 10);
    const bprSeq = (state.mfg?.seq?.bpr || 2001) + bprs.length;
    const bprId = `BPR-${bprSeq}`;
    dispatch({
      type: 'COMPLETE_BPR_QC',
      payload: { bprId, bmrId: bmr.id },
    });
  };

  const stageColor = (stage: number) => {
    if (stage === 0) return 'bg-gray-100 text-gray-700';
    if (stage <= 2) return 'bg-blue-100 text-blue-700';
    if (stage <= 5) return 'bg-amber-100 text-amber-700';
    if (stage === 6) return 'bg-purple-100 text-purple-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">BMR / BOM Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Batch Manufacturing Records — track production batches stage by stage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onSwitchToBOM}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            + New BOM
          </button>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition">
            + Create BMR
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total BMRs', value: bmrs.length, color: 'text-gray-800' },
          { label: 'In Production', value: bmrs.filter(b => b.stage > 0 && b.stage < 7).length, color: 'text-blue-600' },
          { label: 'QC Review', value: bmrs.filter(b => b.stage === 6).length, color: 'text-purple-600' },
          { label: 'Completed', value: bmrs.filter(b => b.stage === 7).length, color: 'text-emerald-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* BMR Cards */}
      {bmrs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <svg className="w-14 h-14 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-semibold text-gray-600 text-lg">No BMRs yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Click "+ Create BMR" to link a Sales Order to a production batch</p>
          <button onClick={() => setShowCreate(true)}
            className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition">
            + Create First BMR
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {bmrs.map((bmr: any) => (
            <div key={bmr.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* BMR Header */}
              <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-gray-800">{bmr.id}</span>
                  <span className="text-gray-600 text-sm">{bmr.product}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${stageColor(bmr.stage)}`}>
                    {BMR_STAGES[bmr.stage]}
                  </span>
                </div>
                <div className="text-sm text-gray-500 space-x-4">
                  <span>SO: <span className="font-medium text-gray-700">{bmr.so}</span></span>
                  <span>Batch: <span className="font-medium text-gray-700">{bmr.batchId}</span></span>
                  <span>Size: <span className="font-medium text-gray-700">{new Intl.NumberFormat('en-IN').format(bmr.batchSize)}</span></span>
                </div>
              </div>

              {/* Stage Progress Bar */}
              <div className="px-5 py-3">
                <div className="flex items-center gap-0.5 overflow-x-auto">
                  {BMR_STAGES.map((s, i) => (
                    <div key={s} className="flex-1 flex flex-col items-center min-w-15">
                      <div className={`w-full h-2 rounded-sm ${i < bmr.stage ? 'bg-emerald-400' : i === bmr.stage ? 'bg-blue-500' : 'bg-gray-200'
                        }`} />
                      <span className={`text-[10px] mt-1 text-center leading-tight ${i === bmr.stage ? 'text-blue-600 font-semibold' : 'text-gray-400'
                        }`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 bg-gray-50/50 flex gap-2 flex-wrap items-center">
                <input
                  type="checkbox"
                  checked={selectedBmrIds.includes(bmr.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedBmrIds(prev => [...prev, bmr.id]);
                    else setSelectedBmrIds(prev => prev.filter(id => id !== bmr.id));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                {bmr.stage < 6 && (
                  <button onClick={() => advanceStage(bmr)}
                    className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                    → Advance to {BMR_STAGES[bmr.stage + 1]}
                  </button>
                )}
                {bmr.stage === 6 && (
                  <button onClick={() => completeQC(bmr)}
                    className="px-4 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition">
                    ✓ Approve QC &amp; Complete BMR
                  </button>
                )}
                {bmr.stage === 7 && (
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg">✓ BMR Completed</span>
                )}
                <button onClick={() => setPrintBmr(bmr)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition">
                  🖨 Print BMR
                </button>
                {bmr.notes && <span className="text-xs text-gray-400 self-center ml-2">📝 {bmr.notes}</span>}
              </div>
            </div>
          ))}

          {/* Consolidated Material Request button */}
          {selectedBmrIds.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-gray-500">{selectedBmrIds.length} BMR(s) selected</span>
              <button
                onClick={() => setConsolidatedMRIds(selectedBmrIds)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                📋 Consolidated Material Request
              </button>
            </div>
          )}
        </div>
      )}

      {/* BPR Panel */}
      {bprs.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-3">Batch Packaging Records (BPR)</h3>
          <div className="space-y-2">
            {bprs.map((bpr: any) => (
              <div key={bpr.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-gray-700 font-medium">{bpr.id}</span>
                  <span className="text-gray-600">→ {bpr.bmrId}</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                  {bpr.stage === 4 ? 'QC Cleared' : `Stage ${bpr.stage}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create BMR Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">Create BMR / Batch</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* SO Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Order *</label>
                <select value={form.soId} onChange={e => setForm(f => ({ ...f, soId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Select SO...</option>
                  {salesOrders.map((so: any) => (
                    <option key={so.so} value={so.so}>{so.so} — {so.clientName} ({so.units?.toLocaleString()} units)</option>
                  ))}
                </select>
                {selectedSO && (
                  <p className="text-xs text-blue-600 mt-1">Status: {selectedSO.internalStatus} · Planning: {selectedSO.planning}%</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size (units) *</label>
                <input type="number" value={form.batchSize} onChange={e => setForm(f => ({ ...f, batchSize: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="e.g. 7000" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturing Area</label>
                  <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="">Select...</option>
                    <option>Line A – Creams</option>
                    <option>Line B – Gels</option>
                    <option>Line C – General</option>
                    <option>Line D – Liquids</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  rows={2} placeholder="Any special instructions..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleCreateBMR}
                  className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition">Create BMR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BMR Print Template Modal */}
      {printBmr && (
        <BMRPrintTemplate bmr={printBmr} onClose={() => setPrintBmr(null)} />
      )}

      {/* Consolidated Material Request Modal */}
      {consolidatedMRIds && (
        <ConsolidatedMRModal
          bmrIds={consolidatedMRIds}
          onClose={() => { setConsolidatedMRIds(null); setSelectedBmrIds([]); }}
        />
      )}
    </div>
  );
};

// Helper components
const InputField: React.FC<{
  label: string;
  id: string;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
}> = ({ label, id, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      id={id}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  id: string;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}> = ({ label, id, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      id={id}
      value={value || ''}
      onChange={onChange}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

const TextareaField: React.FC<{
  label: string;
  id: string;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}> = ({ label, id, value, onChange, rows = 3 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea
      id={id}
      value={value || ''}
      onChange={onChange}
      rows={rows}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const CheckboxField: React.FC<{
  label: string;
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, checked, onChange }) => (
  <label className="flex items-center text-sm">
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
    />
    <span className="ml-2 text-gray-700">{label}</span>
  </label>
);

export default BOMRefactored;
