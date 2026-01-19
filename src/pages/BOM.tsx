import React, { useState, useEffect } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';

const BOM: React.FC = () => {
  const { addItem } = useItems();
  const { addToast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
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
    rmCode: '',
    rmName: '',
    rmPhase: '',
    rmFunc: '',
    rmPct: '',
    rmUom: 'GM',
    rmSpec: '',
    rmNotes: '',
    pmLines: [] as Array<{
      code: string;
      name: string;
      cat: string;
      qty: number;
      uom: string;
      notes: string;
    }>,
    pmCode: '',
    pmName: '',
    pmCat: '',
    pmQty: '',
    pmUom: 'PCS',
    pmNotes: '',
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
  });

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.values(formData).some(v => Boolean(v))) {
        localStorage.setItem('bom_draft', JSON.stringify(formData));
        addToast('info', 'BOM draft auto-saved');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, addToast]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('bom_draft');
    if (draft) {
      setFormData(JSON.parse(draft));
      addToast('info', 'BOM draft loaded');
    }
  }, []);

  const stages = [
    'Primary Info',
    'BOM Setup & Coding',
    'Header Details',
    'Formulation (Bulk RM Items)',
    'Packaging (FG PM Items)',
    'Specs (Bulk + FG)',
    'Yield, Batch & Notes',
    'Review / JSON',
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddRM = () => {
    if (!formData.rmName.trim()) {
      setErrors(prev => ({ ...prev, rmName: 'RM Name is required' }));
      addToast('error', 'RM Name is required');
      return;
    }
    if (!formData.rmPct || Number(formData.rmPct) <= 0) {
      setErrors(prev => ({ ...prev, rmPct: 'Enter % w/w' }));
      addToast('error', 'Enter % w/w');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      rmLines: [
        ...prev.rmLines,
        {
          code: prev.rmCode,
          name: prev.rmName,
          phase: prev.rmPhase,
          func: prev.rmFunc,
          pct: Number(prev.rmPct),
          uom: prev.rmUom,
          spec: prev.rmSpec,
          notes: prev.rmNotes,
        },
      ],
      rmCode: '',
      rmName: '',
      rmPhase: '',
      rmFunc: '',
      rmPct: '',
      rmSpec: '',
      rmNotes: '',
    }));
  };

  const handleDeleteRM = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      rmLines: prev.rmLines.filter((_, i) => i !== idx),
    }));
  };

  const handleAddPM = () => {
    if (formData.type !== 'FG') {
      addToast('error', 'PM lines only for FG BOM');
      return;
    }
    if (!formData.pmName.trim()) {
      setErrors(prev => ({ ...prev, pmName: 'PM Name is required' }));
      addToast('error', 'PM Name is required');
      return;
    }
    if (!formData.pmQty || Number(formData.pmQty) <= 0) {
      setErrors(prev => ({ ...prev, pmQty: 'Enter Qty per FG' }));
      addToast('error', 'Enter Qty per FG');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      pmLines: [
        ...prev.pmLines,
        {
          code: prev.pmCode,
          name: prev.pmName,
          cat: prev.pmCat,
          qty: Number(prev.pmQty),
          uom: prev.pmUom,
          notes: prev.pmNotes,
        },
      ],
      pmCode: '',
      pmName: '',
      pmCat: '',
      pmQty: '',
      pmNotes: '',
    }));
  };

  const handleDeletePM = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      pmLines: prev.pmLines.filter((_, i) => i !== idx),
    }));
  };

  const handleNextStage = () => {
    if (currentStage < stages.length - 1) {
      setCurrentStage(currentStage + 1);
    }
  };

  const handlePrevStage = () => {
    if (currentStage > 0) {
      setCurrentStage(currentStage - 1);
    }
  };

  const handleSubmit = () => {
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
  };

  const rmTotal = formData.rmLines.reduce((sum, rm) => sum + (rm.pct || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Manage BOM master data</h1>
          
          <div className="flex items-center justify-between mb-6">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option>Draft</option>
                <option>Under Review</option>
                <option>Approved</option>
                <option>Archived</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition">
                Save
              </button>
            </div>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {stages.map((stage, idx) => (
              <div key={idx} className="flex items-center">
                <button
                  onClick={() => setCurrentStage(idx)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition ${
                    currentStage === idx
                      ? 'bg-orange-500 text-white'
                      : currentStage > idx
                      ? 'bg-gray-300 text-gray-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {idx + 1}
                </button>
                {idx < stages.length - 1 && (
                  <div className="w-12 h-0.5 bg-gray-300 mx-2"></div>
                )}
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-800">{stages[currentStage]}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Stage 0: Primary Info */}
          {currentStage === 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Primary Information</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">BOM Code *</label>
                  <input
                    type="text"
                    id="bomCode"
                    placeholder="e.g., EI-BOM-001"
                    value={formData.bomCode}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SKU</label>
                  <input
                    type="text"
                    id="bomSku"
                    placeholder="e.g., SKU-12345"
                    value={formData.bomSku}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <select
                    id="bomCategory"
                    value={formData.bomCategory}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select Category</option>
                    <option value="Formulation">Formulation</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Finish">Finish Good</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unit of Measure *</label>
                  <select
                    id="bomUnit"
                    value={formData.bomUnit}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="GM">Grams (GM)</option>
                    <option value="ML">Milliliters (ML)</option>
                    <option value="PCS">Pieces (PCS)</option>
                    <option value="L">Liters (L)</option>
                    <option value="KG">Kilograms (KG)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">HSN Code</label>
                  <input
                    type="text"
                    id="bomHsn"
                    placeholder="e.g., 3304"
                    value={formData.bomHsn}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tax Preference</label>
                  <select
                    id="bomTaxPreference"
                    value={formData.bomTaxPreference}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Taxable">Taxable</option>
                    <option value="ExemptedGoods">Exempted Goods</option>
                    <option value="ExemptedServices">Exempted Services</option>
                    <option value="NonGST">Non-GST</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="bomReturnable"
                    checked={formData.bomReturnable}
                    onChange={(e) => setFormData(prev => ({ ...prev, bomReturnable: e.target.checked }))}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="ml-2 text-sm font-semibold text-gray-700">Returnable Item</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Associate Items</label>
                <textarea
                  id="bomAssociateItems"
                  placeholder="Enter associated item codes/names, comma-separated"
                  value={formData.bomAssociateItems}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Stage 1: BOM Setup & Coding */}
              {currentStage === 1 && (
                <div>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      BOM Type
                    </label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="BULK">Bulk BOM (Internal)</option>
                      <option value="FG">FG BOM (Client)</option>
                    </select>
                  </div>

                  {formData.type === 'FG' && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Client / Brand Name
                      </label>
                      <input
                        type="text"
                        id="client"
                        placeholder="e.g., Emcure / Aqua Oat"
                        value={formData.client}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Product / Formula Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        placeholder="e.g., Aqua Oat Face Cleanser"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Dosage Form
                      </label>
                      <select
                        id="dosage"
                        value={formData.dosage}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Select</option>
                        <option>Cleanser / Face Wash</option>
                        <option>Cream / Lotion</option>
                        <option>Serum / Gel</option>
                        <option>Sunscreen</option>
                        <option>Moisturizer</option>
                        <option>Shampoo / Conditioner</option>
                        <option>Body Wash</option>
                        <option>Soap / Syndet Bar</option>
                        <option>Deodorant</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Target Pack Size
                      </label>
                      <input
                        type="text"
                        id="packSize"
                        placeholder="e.g., 100 g / 200 ml"
                        value={formData.packSize}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Site / Plant
                      </label>
                      <input
                        type="text"
                        id="site"
                        placeholder="e.g., Hyderabad"
                        value={formData.site}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded mb-6">
                    <p className="text-sm text-amber-900">
                      <span className="font-mono font-bold">Bulk:</span> EI-BOM-BULK-00001 |{' '}
                      <span className="font-mono font-bold">FG:</span> EI-BOM-FG-00001
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      BOM Code
                    </label>
                    <input
                      type="text"
                      id="bomCode"
                      value={formData.bomCode}
                      readOnly
                      placeholder="Generate via button"
                      className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100"
                    />
                  </div>
                </div>
              )}

              {/* Stage 2: Header Details */}
              {currentStage === 2 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Product Category
                      </label>
                      <input
                        type="text"
                        id="category"
                        placeholder="e.g., Skin Care / Hair Care"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Claim Family
                      </label>
                      <input
                        type="text"
                        id="claims"
                        placeholder="e.g., Brightening / Anti-acne"
                        value={formData.claims}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Reference / Project ID
                      </label>
                      <input
                        type="text"
                        id="project"
                        placeholder="Internal project / PIS ID"
                        value={formData.project}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Target Market / Country
                      </label>
                      <select
                        id="market"
                        value={formData.market}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Select</option>
                        <option>India</option>
                        <option>USA</option>
                        <option>EU</option>
                        <option>UAE</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Regulatory Compliance
                      </label>
                      <input
                        type="text"
                        id="regulatory"
                        placeholder="e.g., BIS, FDA, EU cosmetics"
                        value={formData.regulatory}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Formulation pH Range
                      </label>
                      <input
                        type="text"
                        id="phRange"
                        placeholder="e.g., 5.0 - 6.0"
                        value={formData.phRange}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description / Notes
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Brief description of formulation, key features, etc."
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Created By
                      </label>
                      <input
                        type="text"
                        id="createdBy"
                        value={formData.createdBy}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Reviewed By
                      </label>
                      <input
                        type="text"
                        id="reviewedBy"
                        value={formData.reviewedBy}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Short Description
                    </label>
                    <textarea
                      id="desc"
                      placeholder="What this BOM is for…"
                      value={formData.desc}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 2: Formulation RM Lines */}
              {currentStage === 2 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        RM Code
                      </label>
                      <input
                        type="text"
                        id="rmCode"
                        placeholder="EI-RM-XXX-00001"
                        value={formData.rmCode}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        RM Name
                      </label>
                      <input
                        type="text"
                        id="rmName"
                        placeholder="INCI / Trade name"
                        value={formData.rmName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phase
                      </label>
                      <select
                        id="rmPhase"
                        value={formData.rmPhase}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Select</option>
                        <option>A (Water phase)</option>
                        <option>B (Oil phase)</option>
                        <option>C (Cool down)</option>
                        <option>D (Actives / Fragrance)</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Function
                      </label>
                      <input
                        type="text"
                        id="rmFunc"
                        placeholder="Humectant / Emollient / Active"
                        value={formData.rmFunc}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        % w/w
                      </label>
                      <input
                        type="number"
                        id="rmPct"
                        step="0.0001"
                        placeholder="e.g., 2.5"
                        value={formData.rmPct}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        UoM (issue)
                      </label>
                      <select
                        id="rmUom"
                        value={formData.rmUom}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option>GM</option>
                        <option>KG</option>
                        <option>ML</option>
                        <option>L</option>
                        <option>PCS</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Specification / Grade
                      </label>
                      <input
                        type="text"
                        id="rmSpec"
                        placeholder="e.g., Cosmetic grade / assay"
                        value={formData.rmSpec}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Notes
                      </label>
                      <input
                        type="text"
                        id="rmNotes"
                        placeholder="Any constraints"
                        value={formData.rmNotes}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddRM}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition mb-6"
                  >
                    + Add RM Line
                  </button>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">#</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Code</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Name</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Phase</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Function</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">%</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">UoM</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.rmLines.map((rm, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 text-sm">{idx + 1}</td>
                            <td className="border border-gray-300 p-2 text-sm font-mono">{rm.code}</td>
                            <td className="border border-gray-300 p-2 text-sm">{rm.name}</td>
                            <td className="border border-gray-300 p-2 text-sm">{rm.phase}</td>
                            <td className="border border-gray-300 p-2 text-sm">{rm.func}</td>
                            <td className="border border-gray-300 p-2 text-sm font-mono">{rm.pct}</td>
                            <td className="border border-gray-300 p-2 text-sm">{rm.uom}</td>
                            <td className="border border-gray-300 p-2">
                              <button
                                onClick={() => handleDeleteRM(idx)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-sm text-gray-600 mt-4">
                    <b>Rule:</b> RM total should be ~100%. For Bulk BOM, this table is the entire BOM. For FG BOM, this is the bulk formulation part.
                  </p>
                </div>
              )}

              {/* Stage 3: Packaging PM Lines */}
              {currentStage === 3 && (
                <div>
                  <p className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded mb-6 text-sm text-amber-900">
                    PM lines are required only for FG BOM. This stage is hidden for Bulk BOM.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PM Code
                      </label>
                      <input
                        type="text"
                        id="pmCode"
                        placeholder="EI-PM-PRI-00001"
                        value={formData.pmCode}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PM Name
                      </label>
                      <input
                        type="text"
                        id="pmName"
                        placeholder="Bottle / Tube / Cap / Label"
                        value={formData.pmName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PM Category
                      </label>
                      <select
                        id="pmCat"
                        value={formData.pmCat}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Select</option>
                        <option>Primary</option>
                        <option>Secondary – Label</option>
                        <option>Secondary – Monocarton</option>
                        <option>Tertiary – Shipper</option>
                        <option>Sleeve / Shrink</option>
                        <option>Insert / Leaflet</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Qty per FG
                      </label>
                      <input
                        type="number"
                        id="pmQty"
                        step="0.01"
                        placeholder="e.g., 1"
                        value={formData.pmQty}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        UoM
                      </label>
                      <select
                        id="pmUom"
                        value={formData.pmUom}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option>PCS</option>
                        <option>SET</option>
                        <option>MTR</option>
                        <option>KG</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Notes
                      </label>
                      <input
                        type="text"
                        id="pmNotes"
                        placeholder="Artwork / GSM / finish"
                        value={formData.pmNotes}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddPM}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition mb-6"
                  >
                    + Add PM Line
                  </button>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">#</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Code</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Name</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Category</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Qty/FG</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">UoM</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.pmLines.map((pm, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 text-sm">{idx + 1}</td>
                            <td className="border border-gray-300 p-2 text-sm font-mono">{pm.code}</td>
                            <td className="border border-gray-300 p-2 text-sm">{pm.name}</td>
                            <td className="border border-gray-300 p-2 text-sm">{pm.cat}</td>
                            <td className="border border-gray-300 p-2 text-sm font-mono">{pm.qty}</td>
                            <td className="border border-gray-300 p-2 text-sm">{pm.uom}</td>
                            <td className="border border-gray-300 p-2">
                              <button
                                onClick={() => handleDeletePM(idx)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Stage 4: Specs */}
              {currentStage === 4 && (
                <div>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bulk Formulation Specification
                    </label>
                    <textarea
                      id="specBulk"
                      placeholder="Appearance, pH, viscosity range, density, odor, color, micro limits, assay (if any)"
                      value={formData.specBulk}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Process / Manufacturing Instructions
                    </label>
                    <textarea
                      id="specProcess"
                      placeholder="Heating temp, mixing rpm, hold time, cool down additions, order of addition"
                      value={formData.specProcess}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Finished Product Specs (FG BOM)
                    </label>
                    <textarea
                      id="specFg"
                      placeholder="Final appearance, pH, viscosity, SPF/PA (if sunscreen), fill weight/volume tolerance, microbial limits, stability conditions"
                      value={formData.specFg}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Packaging / Labelling Specs (FG)
                    </label>
                    <textarea
                      id="specPack"
                      placeholder="Artwork version, barcode, label text, claims, shelf life, storage, carton spec"
                      value={formData.specPack}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Testing Plan (FG)
                    </label>
                    <textarea
                      id="specTests"
                      placeholder="Incoming QC, in-process, finished goods testing: pH, viscosity, micro, SPF etc."
                      value={formData.specTests}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Acceptance Criteria / Release
                    </label>
                    <textarea
                      id="specRelease"
                      placeholder="Release parameters and limits."
                      value={formData.specRelease}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 5: Yield & Batch */}
              {currentStage === 5 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Standard Batch Size (Bulk)
                      </label>
                      <input
                        type="text"
                        id="batch"
                        placeholder="e.g., 100 KG"
                        value={formData.batch}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Expected Yield %
                      </label>
                      <input
                        type="number"
                        id="yield"
                        step="0.01"
                        placeholder="e.g., 98"
                        value={formData.yield}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Overage % (for filling)
                      </label>
                      <input
                        type="number"
                        id="overage"
                        step="0.01"
                        placeholder="e.g., 2"
                        value={formData.overage}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Line / Equipment Notes
                      </label>
                      <input
                        type="text"
                        id="line"
                        placeholder="e.g., vacuum emulsifier, 1T tank"
                        value={formData.line}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Change Log / Notes
                    </label>
                    <textarea
                      id="notes"
                      placeholder="Version changes, reason for change"
                      value={formData.notes}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 6: Review / JSON */}
              {currentStage === 6 && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Review your complete BOM form as JSON. Useful for backend developers.
                  </p>

                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96 mb-6">
                    <pre>{JSON.stringify(formData, null, 2)}</pre>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Import JSON
                    </label>
                    <textarea
                      placeholder='{"meta":{...}}'
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-10 pt-8 border-t border-gray-200">
              <button
                onClick={handlePrevStage}
                disabled={currentStage === 0}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  currentStage === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                ← Previous
              </button>

              {currentStage === stages.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Submit
                </button>
              ) : (
                <button
                  onClick={handleNextStage}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Next →
                </button>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default BOM;
