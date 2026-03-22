import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { X, Plus, Trash2 } from 'lucide-react';
import { createBOM } from '../services/bom.service';
import { fetchPRProductDetail, type PRProductDetail } from '../services/productsMaster.service';


interface BOMFormState {
  // Overview Tab
  productName: string;
  category: string;
  productForm: string;
  brandClient: string;
  fillSize: string;
  packConfiguration: string;
  skuCode: string;
  mrp: string;
  zohoId: string;
  skuForZoho: string;
  bomTaxPreference: string;
  bomReturnable: boolean;
  bomAssociateItems: string;

  // Formula BOM Tab
  formulaIngredients: Array<{
    id: string;
    inciName: string;
    phase: string;
    percentWW: string;
    uom: string;
  }>;

  // Pack BOM Tab
  packingComponents: Array<{
    id: string;
    pmDescription: string;
    type: string;
    qtyUnit: string;
    uom: string;
  }>;

  // Process Steps Tab
  processSteps: Array<{
    id: string;
    stepNumber: string;
    instruction: string;
    duration: string;
  }>;

  // Specs & Regulatory Tab
  phRange: string;
  viscosity: string;
  specificGravity: string;
  appearance: string;
  odour: string;
  fillWeightSpec: string;
  microbialLimits: string;
  sppRating: string;
  acceleratedStability: string;
  intermediateStability: string;
  longTermStability: string;
  phototability: string;
  freezeThawCycles: string;
  applicableRegulation: string;
  cosmosNaturalCertification: string;
  dermatologicallyTested: string;
  crueltyFreeVegan: string;
  approvedMarketingClaims: string;
  claimsSubstantiation: string;
}

function emptyBomForm(): BOMFormState {
  return {
    productName: '',
    category: '',
    productForm: '',
    brandClient: '',
    fillSize: '',
    packConfiguration: '',
    skuCode: '',
    mrp: '',
    zohoId: '',
    skuForZoho: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
    formulaIngredients: [],
    packingComponents: [],
    processSteps: [],
    phRange: '',
    viscosity: '',
    specificGravity: '',
    appearance: '',
    odour: '',
    fillWeightSpec: '',
    microbialLimits: '',
    sppRating: '',
    acceleratedStability: '',
    intermediateStability: '',
    longTermStability: '',
    phototability: '',
    freezeThawCycles: '',
    applicableRegulation: '',
    cosmosNaturalCertification: '',
    dermatologicallyTested: '',
    crueltyFreeVegan: '',
    approvedMarketingClaims: '',
    claimsSubstantiation: '',
  };
}

function mockBomForm(): BOMFormState {
  return {
    productName: 'EI Sunscreen Lotion SPF50+ PA++++',
    category: 'Sunscreen',
    productForm: 'Lotion',
    brandClient: 'Esthetic Insights',
    fillSize: '50ml',
    packConfiguration: 'Bottle + Cap',
    skuCode: 'EI-PR-00001',
    mrp: '₹499',
    zohoId: '',
    skuForZoho: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
    formulaIngredients: [
      { id: '1', inciName: 'Zinc Oxide', phase: 'Oil', percentWW: '15', uom: 'GM' },
      { id: '2', inciName: 'Titanium Dioxide', phase: 'Oil', percentWW: '10', uom: 'GM' },
      { id: '3', inciName: 'Cetyl Alcohol', phase: 'Oil', percentWW: '5', uom: 'GM' },
      { id: '4', inciName: 'Glycerin', phase: 'Water', percentWW: '5', uom: 'GM' },
    ],
    packingComponents: [
      { id: '1', pmDescription: '50ml White Bottle', type: 'Primary Container', qtyUnit: '1', uom: 'PCS' },
      { id: '2', pmDescription: 'White Cap with Pump', type: 'Closure', qtyUnit: '1', uom: 'PCS' },
      { id: '3', pmDescription: 'Product Label', type: 'Label', qtyUnit: '1', uom: 'PCS' },
    ],
    processSteps: [
      { id: '1', stepNumber: '1', instruction: 'Mix oils in reactor at 60°C', duration: '30 min' },
      { id: '2', stepNumber: '2', instruction: 'Add water phase slowly with stirring', duration: '15 min' },
      { id: '3', stepNumber: '3', instruction: 'Cool to 25°C', duration: '45 min' },
    ],
    phRange: '6.0-7.0',
    viscosity: '8000-12000 CPS',
    specificGravity: '0.95-1.02',
    appearance: 'White smooth lotion',
    odour: 'Pleasant fragrance',
    fillWeightSpec: '50 ± 2g',
    microbialLimits: 'TVC < 1000 cfu/g',
    sppRating: 'SPF 50+',
    acceleratedStability: '6M/40°C/75%RH - PASS',
    intermediateStability: '9M/30°C/65%RH - PASS',
    longTermStability: '12M/25°C/60%RH - PASS',
    phototability: 'ICH Q1B PASS',
    freezeThawCycles: '3 cycles PASS',
    applicableRegulation: 'India - BIS / CDSCO',
    cosmosNaturalCertification: 'Not applicable',
    dermatologicallyTested: 'Yes - certified',
    crueltyFreeVegan: 'No',
    approvedMarketingClaims: 'Broad spectrum UVA+UVB protection, Non-greasy formula, Dermatologist tested',
    claimsSubstantiation: 'SPF test ref: SPF-2024-001, Clinical report on file',
  };
}

function productDetailToBomForm(p: PRProductDetail): BOMFormState {
  const formulaIngredients: BOMFormState['formulaIngredients'] = [];
  (p.formulaBom || []).forEach((phase, pi) => {
    (phase.ingredients || []).forEach((ing, ii) => {
      formulaIngredients.push({
        id: `fi-${pi}-${ii}`,
        inciName: ing.inci_name || '',
        phase: phase.phase || '',
        percentWW: String(ing.pct_w_w ?? ''),
        uom: ing.uom || 'GM',
      });
    });
  });
  const packingComponents: BOMFormState['packingComponents'] = (p.packBom || []).map((row, i) => ({
    id: `pc-${i}`,
    pmDescription: row.pm_description || '',
    type: row.pack_type || '',
    qtyUnit: String(row.qty_per_unit ?? ''),
    uom: row.uom || 'PCS',
  }));
  const processSteps: BOMFormState['processSteps'] = (p.processSteps || []).map((step, i) => ({
    id: `ps-${i}`,
    stepNumber: String(step.step_number ?? ''),
    instruction: step.description || '',
    duration: String(step.duration_minutes ?? ''),
  }));
  return {
    ...emptyBomForm(),
    productName: p.product_name || '',
    category: p.category || '',
    productForm: p.form || '',
    fillSize: p.fill_size || '',
    skuCode: p.product_code || '',
    mrp: p.mrp_price != null ? `₹${p.mrp_price}` : '',
    formulaIngredients,
    packingComponents,
    processSteps,
    phRange: p.ph_range || '',
    viscosity: p.viscosity_range || '',
    appearance: p.appearance || '',
    odour: p.odour || '',
    fillWeightSpec: p.fill_weight_spec || '',
    approvedMarketingClaims: p.approved_claims || '',
    longTermStability: p.stability_summary || '',
  };
}

const BOMForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: productIdFromRoute } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<BOMFormState>(emptyBomForm());
  const [editLoading, setEditLoading] = useState(!!productIdFromRoute);
  const [tempIngredient, setTempIngredient] = useState({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
  const [tempComponent, setTempComponent] = useState({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
  const [tempStep, setTempStep] = useState({ stepNumber: '', instruction: '', duration: '' });

  // When route has :id, fetch product and fill form for edit
  useEffect(() => {
    if (!productIdFromRoute) return;
    let cancelled = false;
    setEditLoading(true);
    fetchPRProductDetail(productIdFromRoute).then((res) => {
      if (cancelled) return;
      setEditLoading(false);
      if (res.success && res.data) {
        setFormData(productDetailToBomForm(res.data));
      }
    }).catch(() => {
      if (!cancelled) setEditLoading(false);
    });
    return () => { cancelled = true; };
  }, [productIdFromRoute]);

  const tabs = [
    { id: 0, label: 'Overview', icon: '1' },
    { id: 1, label: 'Formula BOM', icon: '2' },
    { id: 2, label: 'Pack BOM', icon: '3' },
    { id: 3, label: 'Process Steps', icon: '4' },
    { id: 4, label: 'Specs & Regulatory', icon: '5' },
  ];

  const handleInputChange = (field: keyof BOMFormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const fillMockData = () => {
    const mock = mockBomForm();
    setFormData(mock);
    addToast('success', 'Form filled with mock data for testing!');
  };

  const addIngredient = () => {
    if (!tempIngredient.inciName.trim()) {
      addToast('error', 'INCI Name is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      formulaIngredients: [...prev.formulaIngredients, {
        id: Date.now().toString(),
        ...tempIngredient
      }]
    }));
    setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
  };

  const removeIngredient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      formulaIngredients: prev.formulaIngredients.filter(item => item.id !== id)
    }));
  };

  const addComponent = () => {
    if (!tempComponent.pmDescription.trim()) {
      addToast('error', 'PM Description is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      packingComponents: [...prev.packingComponents, {
        id: Date.now().toString(),
        ...tempComponent
      }]
    }));
    setTempComponent({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
  };

  const removeComponent = (id: string) => {
    setFormData(prev => ({
      ...prev,
      packingComponents: prev.packingComponents.filter(item => item.id !== id)
    }));
  };

  const addStep = () => {
    if (!tempStep.instruction.trim()) {
      addToast('error', 'Instruction is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      processSteps: [...prev.processSteps, {
        id: Date.now().toString(),
        ...tempStep
      }]
    }));
    setTempStep({ stepNumber: '', instruction: '', duration: '' });
  };

  const removeStep = (id: string) => {
    setFormData(prev => ({
      ...prev,
      processSteps: prev.processSteps.filter(item => item.id !== id)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.productName.trim()) {
      addToast('error', 'Product Name is required');
      return;
    }

    const bomCode = formData.skuCode || `PR-${Date.now()}`;
    const payload = {
      name: formData.productName,
      category: formData.category || undefined,
      type: formData.productForm || undefined,
      client: formData.brandClient || undefined,
      packSize: formData.fillSize || undefined,
      bomCode,
      zohoId: formData.zohoId?.trim() || undefined,
      bomSku: (formData.skuForZoho?.trim() ? formData.skuForZoho.trim() : bomCode) || undefined,
      bomTaxPreference: formData.bomTaxPreference || undefined,
      bomReturnable: formData.bomReturnable,
      bomAssociateItems: formData.bomAssociateItems?.trim() || undefined,
      status: 'Draft',
    };

    const result = await createBOM(payload);
    if (result.success) {
      addToast('success', 'Product saved successfully!');
      navigate('/bom');
    } else {
      addToast('error', result.error || 'Failed to save product');
    }
  };

  if (editLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50">
        <p className="text-white bg-slate-800 px-4 py-2 rounded-lg">Loading product…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-start justify-center z-50 overflow-y-auto pt-8">
      <div className="w-full mx-auto bg-white rounded-2xl shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                PR
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">{productIdFromRoute ? 'Edit Product Registration' : 'New Product Registration (PR Master)'}</h1>
                <p className="text-xs text-slate-600">Complete all 5 sections — identity, formula BOM, pack BOM, process steps & specs.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fillMockData}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Add Mock Data
            </button>
            <button onClick={() => navigate('/bom')} className="text-slate-600 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-1">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              const isCompleted = activeTab > tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : isCompleted
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${isActive
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                    }`}>
                    {isCompleted ? 'Done' : tab.icon}
                  </span>
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tab 0: Overview */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">PRODUCT IDENTITY</label>
                <div className="space-y-4 border-t pt-4">
                  <input
                    type="text"
                    placeholder="e.g. EI Sunscreen Lotion SPF50+ PA++++"
                    value={formData.productName}
                    onChange={(e) => handleInputChange('productName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">CATEGORY</option>
                      <option value="Sunscreen">Sunscreen</option>
                      <option value="Face Wash">Face Wash</option>
                      <option value="Serum">Serum</option>
                      <option value="Cream">Cream</option>
                    </select>
                    <select
                      value={formData.productForm}
                      onChange={(e) => handleInputChange('productForm', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">PRODUCT FORM</option>
                      <option value="Lotion/Cream">Lotion/Cream</option>
                      <option value="Gel">Gel</option>
                      <option value="Serum">Serum</option>
                      <option value="Oil">Oil</option>
                    </select>
                  </div>

                  <select
                    value={formData.brandClient}
                    onChange={(e) => handleInputChange('brandClient', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">BRAND / CLIENT</option>
                    <option value="EI Own Brand">EI Own Brand</option>
                    <option value="Client A">Client A</option>
                    <option value="Client B">Client B</option>
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="e.g. 50g"
                      value={formData.fillSize}
                      onChange={(e) => handleInputChange('fillSize', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      placeholder="e.g. 1x50 tube"
                      value={formData.packConfiguration}
                      onChange={(e) => handleInputChange('packConfiguration', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="e.g. EI-SUN-50G-001"
                      value={formData.skuCode}
                      onChange={(e) => handleInputChange('skuCode', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      placeholder="e.g. Rs.499"
                      value={formData.mrp}
                      onChange={(e) => handleInputChange('mrp', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  {/* Zoho + Tax / Returnable / Associate Items (Primary Info) */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Zoho item id (sync TODO)"
                      value={formData.zohoId}
                      onChange={(e) => handleInputChange('zohoId', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      placeholder="SKU (for Zoho) - optional (defaults to SKU)"
                      value={formData.skuForZoho}
                      onChange={(e) => handleInputChange('skuForZoho', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={formData.bomTaxPreference}
                      onChange={(e) => handleInputChange('bomTaxPreference', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">TAX PREFERENCE</option>
                      {['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg">
                      <input
                        type="checkbox"
                        checked={formData.bomReturnable}
                        onChange={(e) => handleInputChange('bomReturnable', e.target.checked)}
                      />
                      <span className="text-sm font-medium text-slate-700">Returnable Item</span>
                    </div>
                  </div>

                  <div className="mt-1">
                    <textarea
                      value={formData.bomAssociateItems}
                      onChange={(e) => handleInputChange('bomAssociateItems', e.target.value)}
                      rows={2}
                      placeholder="Link related BOM / RM / packaging if any"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Formula BOM */}
          {activeTab === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">FORMULA BOM - RAW MATERIALS</label>
                <p className="text-xs text-slate-600 mb-3">Add all formula ingredients in phase order. Total must equal 100.00%.</p>
                
                <button
                  onClick={addIngredient}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 mb-4"
                >
                  <Plus className="w-4 h-4" /> Add Ingredient
                </button>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase">
                    <div>INCI Name / Raw Material</div>
                    <div>Phase</div>
                    <div>% W/W</div>
                    <div>UOM</div>
                  </div>
                  <div className="space-y-2">
                    {formData.formulaIngredients.map(ing => (
                      <div key={ing.id} className="grid grid-cols-4 gap-2 text-sm items-center bg-slate-50 p-2 rounded">
                        <div className="text-slate-900">{ing.inciName}</div>
                        <div className="text-slate-600">{ing.phase}</div>
                        <div className="text-slate-600">{ing.percentWW}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">{ing.uom}</span>
                          <button onClick={() => removeIngredient(ing.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="INCI Name"
                    value={tempIngredient.inciName}
                    onChange={(e) => setTempIngredient(prev => ({ ...prev, inciName: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Phase"
                      value={tempIngredient.phase}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, phase: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="% W/W"
                      value={tempIngredient.percentWW}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, percentWW: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <select
                      value={tempIngredient.uom}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, uom: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    >
                      <option>GM</option>
                      <option>ML</option>
                      <option>KG</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-3">Total: <span className="font-semibold text-blue-600">0.00%</span></p>
              </div>
            </div>
          )}

          {/* Tab 2: Pack BOM */}
          {activeTab === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">PACKAGING BOM</label>
                <p className="text-xs text-slate-600 mb-3">Add all packaging components - primary, secondary, labels.</p>
                
                <button
                  onClick={addComponent}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 mb-4"
                >
                  <Plus className="w-4 h-4" /> Add Component
                </button>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase">
                    <div className="col-span-2">PM Description</div>
                    <div>Type</div>
                    <div>Qty / Unit</div>
                  </div>
                  <div className="space-y-2">
                    {formData.packingComponents.map(comp => (
                      <div key={comp.id} className="grid grid-cols-4 gap-2 text-sm items-center bg-slate-50 p-2 rounded">
                        <div className="col-span-2 text-slate-900">{comp.pmDescription}</div>
                        <div className="text-slate-600">{comp.type}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">{comp.qtyUnit}</span>
                          <button onClick={() => removeComponent(comp.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="PM Description"
                    value={tempComponent.pmDescription}
                    onChange={(e) => setTempComponent(prev => ({ ...prev, pmDescription: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Type"
                      value={tempComponent.type}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, type: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Qty / Unit"
                      value={tempComponent.qtyUnit}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, qtyUnit: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Process Steps */}
          {activeTab === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">MANUFACTURING PROCESS STEPS</label>
                <p className="text-xs text-slate-600 mb-3">Define step-by-step instructions in manufacturing order.</p>
                
                <button
                  onClick={addStep}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 mb-4"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600 uppercase">
                    <div>Step</div>
                    <div className="col-span-2">Step Description / Instruction</div>
                  </div>
                  <div className="space-y-2">
                    {formData.processSteps.map(step => (
                      <div key={step.id} className="grid grid-cols-3 gap-2 text-sm items-start bg-slate-50 p-2 rounded">
                        <div className="text-slate-900 font-semibold">{step.stepNumber}</div>
                        <div className="col-span-2 flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="text-slate-900">{step.instruction}</div>
                            <div className="text-xs text-slate-600 mt-1">Duration: {step.duration}</div>
                          </div>
                          <button onClick={() => removeStep(step.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Step #"
                    value={tempStep.stepNumber}
                    onChange={(e) => setTempStep(prev => ({ ...prev, stepNumber: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <textarea
                    placeholder="Step Description / Instruction"
                    value={tempStep.instruction}
                    onChange={(e) => setTempStep(prev => ({ ...prev, instruction: e.target.value }))}
                    rows={2}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 15 mins)"
                    value={tempStep.duration}
                    onChange={(e) => setTempStep(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Specs & Regulatory */}
          {activeTab === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">FINISHED PRODUCT SPECIFICATIONS</label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="e.g. 6.0-7.0" value={formData.phRange} onChange={(e) => handleInputChange('phRange', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                    <input type="text" placeholder="e.g. 15,000-25,000" value={formData.viscosity} onChange={(e) => handleInputChange('viscosity', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                    <input type="text" placeholder="e.g. 0.98-1.02" value={formData.specificGravity} onChange={(e) => handleInputChange('specificGravity', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                    <input type="text" placeholder="e.g. White smooth lotion" value={formData.appearance} onChange={(e) => handleInputChange('appearance', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">STABILITY PROTOCOL</label>
                <div className="space-y-3">
                  <input type="text" placeholder="e.g. 6M completed PASS" value={formData.acceleratedStability} onChange={(e) => handleInputChange('acceleratedStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                  <input type="text" placeholder="e.g. 12M ongoing" value={formData.intermediateStability} onChange={(e) => handleInputChange('intermediateStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                  <input type="text" placeholder="e.g. 24M ongoing" value={formData.longTermStability} onChange={(e) => handleInputChange('longTermStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">REGULATORY & CLAIMS</label>
                <div className="space-y-3">
                  <select value={formData.applicableRegulation} onChange={(e) => handleInputChange('applicableRegulation', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">APPLICABLE REGULATION</option>
                    <option value="India - BIS / CDSCO">India - BIS / CDSCO</option>
                    <option value="EU">EU</option>
                    <option value="USA - FDA">USA - FDA</option>
                  </select>
                  <select value={formData.cosmosNaturalCertification} onChange={(e) => handleInputChange('cosmosNaturalCertification', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">COSMOS / NATURAL CERTIFICATION</option>
                    <option value="Not applicable">Not applicable</option>
                    <option value="COSMOS Organic">COSMOS Organic</option>
                    <option value="COSMOS Natural">COSMOS Natural</option>
                  </select>
                  <select value={formData.dermatologicallyTested} onChange={(e) => handleInputChange('dermatologicallyTested', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">DERMATOLOGICALLY TESTED</option>
                    <option value="Yes - certified">Yes - certified</option>
                    <option value="No">No</option>
                  </select>
                  <select value={formData.crueltyFreeVegan} onChange={(e) => handleInputChange('crueltyFreeVegan', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">CRUELTY FREE / VEGAN</option>
                    <option value="Yes - certified">Yes - certified</option>
                    <option value="No">No</option>
                  </select>
                  <textarea placeholder="e.g. Broad spectrum UVA+UVB, Niacinamide brightening..." value={formData.approvedMarketingClaims} onChange={(e) => handleInputChange('approvedMarketingClaims', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                  <textarea placeholder="SPF test ref, in-vitro study, clinical report ref no." value={formData.claimsSubstantiation} onChange={(e) => handleInputChange('claimsSubstantiation', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-between">
          <button onClick={() => activeTab > 0 && setActiveTab(activeTab - 1)} className="px-4 py-2 text-slate-600 hover:text-slate-900">
            Prev
          </button>
          <button onClick={() => navigate('/bom')} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium">
            Cancel
          </button>
          {activeTab < tabs.length - 1 ? (
            <button onClick={() => setActiveTab(activeTab + 1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Next
            </button>
          ) : (
            <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
              Save PR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BOMForm;
