import React, { useState } from 'react';
import { useItems } from '../context/ItemsContext';

const Packaging: React.FC = () => {
  const { addItem } = useItems();
  const [currentStage, setCurrentStage] = useState(0);
  const [formData, setFormData] = useState({
    // Meta
    itemCode: '',
    status: 'Draft',
    version: 'v1.0',

    // Categorisation
    pmCategory: '',
    qcGroup: '',
    subCategory: '',
    hazardClass: '',
    storeLoc: '',

    // Identity
    name: '',
    level: '',
    category: '',
    intendedUse: '',
    expectedProductTypes: '',
    reusability: '',
    regulatory: '',
    identityNotes: '',

    // Material & Specs
    matBody: '',
    matClosure: '',
    matInner: '',
    matRecycle: '',
    matBpa: '',
    matGrade: '',
    specNominal: '',
    specBrimful: '',
    specHeight: '',
    specDia: '',
    specNeck: '',
    specWeight: '',
    specWall: '',
    specLink: '',

    // Aesthetics
    colorType: '',
    colorCode: '',
    finish: '',
    deco: '',
    images: '',

    // Variants
    variants: [] as Array<{
      id: string;
      volume: number;
      sameMold: string;
      moq: number;
      status: string;
    }>,

    // Temp variant fields
    varId: '',
    varVolume: '',
    varSameMold: '',
    varMoq: '',
    varStatus: 'Active',

    // Customization
    cusCustomizable: '',
    cusParams: '',
    cusStdMoq: '',
    cusCustomMoq: '',
    cusToolingReq: '',
    cusToolingCost: '',
    cusSamplingLT: '',
    cusBulkLTStd: '',
    cusBulkLTCustom: '',
    cusRemarks: '',

    // Compatibility
    compLow: '',
    compMed: '',
    compHigh: '',
    compOil: '',
    compAlc: '',
    compAirless: '',
    compPump: '',
    compLeak: '',
    compActives: '',
    compRisk: '',
    compRemarks: '',

    // Vendors
    vendors: [] as Array<{
      name: string;
      location: string;
      moq: number;
      price: number;
      leadTime: number;
      approved: string;
      priceType: string;
      validTill: string;
      sampleCost: number;
    }>,

    // Temp vendor fields
    venName: '',
    venLocation: '',
    venMoq: '',
    venPrice: '',
    venLT: '',
    venApproved: '',
    venPriceType: '',
    venValid: '',
    venSampleCost: '',
    venPreferred: '',

    // Secondary Packaging
    secLabelType: '',
    secLabelSize: '',
    secAdhesive: '',
    secLabelCompat: '',
    secGsm: '',
    secCartonFinish: '',
    secFit: '',
    secArtLink: '',
    secNotes: '',

    // Tertiary Packaging
    terShipType: '',
    terUnits: '',
    terDrop: '',
    terStack: '',
    terNotes: '',

    // Testing & Approval
    tests: [] as Array<{
      name: string;
      result: string;
      date: string;
      by: string;
      remarks: string;
    }>,

    // Temp test fields
    testName: '',
    testResult: '',
    testDate: '',
    testBy: '',
    testRemarks: '',

    // Approval flags
    apprPack: '',
    apprRd: '',
    apprFin: '',
    apprLock: '',

    // Catalogue
    catVisible: '',
    catShare: '',
    catWebName: '',
    catTags: '',
    catRecoTypes: '',
    catWebImages: '',
  });

  const stages = [
    'QC / PM Categorisation',
    'Identity',
    'Material & Specs',
    'Aesthetics',
    'Variants Matrix',
    'Customization & Tooling',
    'Compatibility (R&D / QA)',
    'Vendors & Commercial',
    'Secondary Packaging',
    'Tertiary Packaging',
    'Testing & Approval',
    'Catalogue / Website',
    'Review / JSON',
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddVariant = () => {
    if (!formData.varVolume || Number(formData.varVolume) <= 0) {
      alert('Fill volume is required');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: prev.varId || `V${prev.variants.length + 1}`,
          volume: Number(prev.varVolume),
          sameMold: prev.varSameMold,
          moq: Number(prev.varMoq),
          status: prev.varStatus,
        },
      ],
      varId: '',
      varVolume: '',
      varSameMold: '',
      varMoq: '',
      varStatus: 'Active',
    }));
  };

  const handleDeleteVariant = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }));
  };

  const handleAddVendor = () => {
    if (!formData.venName.trim()) {
      alert('Vendor name required');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      vendors: [
        ...prev.vendors,
        {
          name: prev.venName,
          location: prev.venLocation,
          moq: Number(prev.venMoq),
          price: Number(prev.venPrice),
          leadTime: Number(prev.venLT),
          approved: prev.venApproved,
          priceType: prev.venPriceType,
          validTill: prev.venValid,
          sampleCost: Number(prev.venSampleCost),
        },
      ],
      venName: '',
      venLocation: '',
      venMoq: '',
      venPrice: '',
      venLT: '',
      venApproved: '',
      venPriceType: '',
      venValid: '',
      venSampleCost: '',
    }));
  };

  const handleDeleteVendor = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      vendors: prev.vendors.filter((_, i) => i !== idx),
    }));
  };

  const handleAddTest = () => {
    if (!formData.testName || !formData.testResult) {
      alert('Select test + result');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      tests: [
        ...prev.tests,
        {
          name: prev.testName,
          result: prev.testResult,
          date: prev.testDate,
          by: prev.testBy,
          remarks: prev.testRemarks,
        },
      ],
      testName: '',
      testResult: '',
      testDate: '',
      testBy: '',
      testRemarks: '',
    }));
  };

  const handleDeleteTest = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      tests: prev.tests.filter((_, i) => i !== idx),
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
      type: 'packaging' as const,
      name: formData.name || 'Unnamed Packaging',
      code: formData.itemCode || 'PKG-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      data: formData,
    };
    addItem(newItem);
    alert('Packaging saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-sm p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Manage packaging master data</h1>
          
          <div className="flex items-center justify-between mb-6">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Draft</option>
                <option>Under Review</option>
                <option>Approved</option>
                <option>Archived</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
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
          
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">{stages[currentStage]}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-600 text-center mb-8">
                {currentStage === 0 && 'Select PM category first (mandatory) — code series depends on this.'}
                {currentStage === 1 && 'General identity fields. PM category is already captured in Step-0.'}
                {currentStage === 2 && 'Material, recyclability, dimensions and tech link.'}
                {currentStage === 3 && 'Color, finish and decoration options.'}
                {currentStage === 4 && 'Add volumes/variants (used for SKU creation).'}
                {currentStage === 5 && 'MOQs, tooling, lead times.'}
                {currentStage === 6 && 'Viscosity, chemical and functional suitability.'}
                {currentStage === 7 && 'Multi-vendor mapping + price validity.'}
                {currentStage === 8 && 'Label/monocarton details.'}
                {currentStage === 9 && 'Shipper/outer box details.'}
                {currentStage === 10 && 'Log tests + approvals flags.'}
                {currentStage === 11 && 'Client share + CMS-ready info.'}
                {currentStage === 12 && 'Backend-friendly JSON view + import.'}
              </p>

              {/* Stage 0: QC / PM Categorisation */}
              {currentStage === 0 && (
                <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">PM CATEGORY</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      PM Category (QC)
                    </label>
                    <select
                      id="pmCategory"
                      value={formData.pmCategory}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="PRIMARY">Primary (Container/Closure)</option>
                      <option value="SECONDARY_LABEL">Secondary – Label</option>
                      <option value="SECONDARY_MONOCARTON">Secondary – Monocarton</option>
                      <option value="SLEEVE">Sleeve / Shrink Sleeve</option>
                      <option value="TERTIARY_SHIPPER">Tertiary – Shipper / Outer Carton</option>
                      <option value="TERTIARY_INNER">Tertiary – Inner Box / Divider</option>
                      <option value="INSERT">Leaflet / Insert / Tag</option>
                      <option value="TAMPER">Tamper Evident (Seal / Shrink / Hologram)</option>
                      <option value="ACCESSORY">Accessory (Spatula / Pump / Dropper / Wiper etc.)</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      QC Inspection Group
                    </label>
                    <select
                      id="qcGroup"
                      value={formData.qcGroup}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      <option>Visual + Dimensional</option>
                      <option>Functional (Pump/Dispense)</option>
                      <option>Artwork / Print / Shade</option>
                      <option>Material Declaration / CoA</option>
                      <option>Transit / Drop / Compression</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sub-Category (optional)
                    </label>
                    <input
                      type="text"
                      id="subCategory"
                      placeholder="e.g., Airless bottle / Flip-top cap"
                      value={formData.subCategory}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hazard Handling Class
                    </label>
                    <select
                      id="hazardClass"
                      value={formData.hazardClass || ''}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      <option>Standard</option>
                      <option>Fragile</option>
                      <option>Controlled Temperature</option>
                      <option>Special Handling</option>
                    </select>
                  </div>
                </div>

                {/* CODE SERIES PREVIEW */}
                <div className="bg-gray-50 border border-gray-200 p-4 rounded mt-8">
                  <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">CODE SERIES PREVIEW</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Series Prefix</p>
                      <div className="bg-white border border-gray-300 rounded p-2 text-sm font-mono">
                        {formData.pmCategory === 'PRIMARY' ? 'EI-PM-PRI-' : 
                         formData.pmCategory === 'SECONDARY_LABEL' ? 'EI-PM-SLBL-' :
                         formData.pmCategory === 'SECONDARY_MONOCARTON' ? 'EI-PM-SMCN-' :
                         formData.pmCategory === 'TERTIARY_SHIPPER' ? 'EI-PM-TSHP-' :
                         formData.pmCategory ? 'EI-PM-' : '—'}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Next Code (preview)</p>
                      <div className="bg-white border border-gray-300 rounded p-2 text-sm font-mono">
                        {formData.pmCategory === 'PRIMARY' ? 'EI-PM-PRI-00001' : 
                         formData.pmCategory === 'SECONDARY_LABEL' ? 'EI-PM-SLBL-00001' :
                         formData.pmCategory === 'SECONDARY_MONOCARTON' ? 'EI-PM-SMCN-00001' :
                         formData.pmCategory === 'TERTIARY_SHIPPER' ? 'EI-PM-TSHP-00001' :
                         formData.pmCategory ? 'EI-PM-00001' : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">
                      Generate Code Now
                    </button>
                    <button className="px-3 py-2 bg-red-100 text-red-700 border border-red-300 rounded text-sm hover:bg-red-200 transition">
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 1: Identity */}
              {currentStage === 1 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Packaging Item Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        placeholder="e.g., Airless Pump Bottle – White"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Packaging Level
                      </label>
                      <select
                        id="level"
                        value={formData.level}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Primary</option>
                        <option>Secondary</option>
                        <option>Tertiary</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Packaging Category (general)
                      </label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Bottle</option>
                        <option>Jar</option>
                        <option>Tube</option>
                        <option>Pump</option>
                        <option>Dropper</option>
                        <option>Spray</option>
                        <option>Sachet</option>
                        <option>Label</option>
                        <option>Monocarton</option>
                        <option>Shipper</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Intended Use
                      </label>
                      <input
                        type="text"
                        id="intendedUse"
                        placeholder="Face, Body, Hair (comma separated)"
                        value={formData.intendedUse}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Product Type Compatibility (Expected)
                    </label>
                    <input
                      type="text"
                      id="expectedProductTypes"
                      placeholder="Serum, Lotion, Cream, Oil, etc."
                      value={formData.expectedProductTypes}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Reusability
                      </label>
                      <select
                        id="reusability"
                        value={formData.reusability}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Single use</option>
                        <option>Reusable</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Regulatory Sensitivity
                      </label>
                      <select
                        id="regulatory"
                        value={formData.regulatory}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>No</option>
                        <option>Yes</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes (internal)
                    </label>
                    <textarea
                      id="identityNotes"
                      value={formData.identityNotes}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 2: Material & Specs */}
              {currentStage === 2 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Material & Construction</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Material – Main Body
                      </label>
                      <select
                        id="matBody"
                        value={formData.matBody}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>PET</option>
                        <option>HDPE</option>
                        <option>PP</option>
                        <option>Glass</option>
                        <option>Aluminium</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Material – Closure
                      </label>
                      <select
                        id="matClosure"
                        value={formData.matClosure}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>PP</option>
                        <option>PE</option>
                        <option>Aluminium</option>
                        <option>Glass</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Inner Components
                      </label>
                      <input
                        type="text"
                        id="matInner"
                        placeholder="Spring, Ball, Gasket..."
                        value={formData.matInner}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Recyclability Code
                      </label>
                      <input
                        type="text"
                        id="matRecycle"
                        placeholder="e.g., 1 PET, 2 HDPE, 5 PP"
                        value={formData.matRecycle}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        BPA / Phthalate Free
                      </label>
                      <select
                        id="matBpa"
                        value={formData.matBpa}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Food/Cosmetic Grade
                      </label>
                      <select
                        id="matGrade"
                        value={formData.matGrade}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8">Dimensional & Technical Specs</h3>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nominal Volume (ml/gm)
                      </label>
                      <input
                        type="number"
                        id="specNominal"
                        step="0.01"
                        value={formData.specNominal}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Brimful Capacity
                      </label>
                      <input
                        type="number"
                        id="specBrimful"
                        step="0.01"
                        value={formData.specBrimful}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Height (mm)
                      </label>
                      <input
                        type="number"
                        id="specHeight"
                        step="0.01"
                        value={formData.specHeight}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Diameter/Width (mm)
                      </label>
                      <input
                        type="number"
                        id="specDia"
                        step="0.01"
                        value={formData.specDia}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Neck Size
                      </label>
                      <input
                        type="text"
                        id="specNeck"
                        placeholder="e.g., 18/410"
                        value={formData.specNeck}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Weight – Empty (gm)
                      </label>
                      <input
                        type="number"
                        id="specWeight"
                        step="0.01"
                        value={formData.specWeight}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Wall Thickness (mm)
                      </label>
                      <input
                        type="number"
                        id="specWall"
                        step="0.01"
                        value={formData.specWall}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tech Drawing / Spec Link
                      </label>
                      <input
                        type="text"
                        id="specLink"
                        placeholder="Paste link"
                        value={formData.specLink}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 3: Aesthetics */}
              {currentStage === 3 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Color Type
                      </label>
                      <select
                        id="colorType"
                        value={formData.colorType}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Standard</option>
                        <option>Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Color Name / Code
                      </label>
                      <input
                        type="text"
                        id="colorCode"
                        placeholder="e.g., White / Pantone"
                        value={formData.colorCode}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Finish
                      </label>
                      <select
                        id="finish"
                        value={formData.finish}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Glossy</option>
                        <option>Matte</option>
                        <option>Frosted</option>
                        <option>Transparent</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Decoration Options
                      </label>
                      <input
                        type="text"
                        id="deco"
                        placeholder="Label, Print, Foil, Sleeve"
                        value={formData.deco}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reference Images (URLs)
                    </label>
                    <textarea
                      id="images"
                      placeholder="One URL per line"
                      value={formData.images}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 4: Variants Matrix */}
              {currentStage === 4 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Variant ID
                      </label>
                      <input
                        type="text"
                        id="varId"
                        placeholder="V1"
                        value={formData.varId}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Fill Volume (ml/gm)
                      </label>
                      <input
                        type="number"
                        id="varVolume"
                        step="0.01"
                        value={formData.varVolume}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Same Mold?
                      </label>
                      <select
                        id="varSameMold"
                        value={formData.varSameMold}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        MOQ
                      </label>
                      <input
                        type="number"
                        id="varMoq"
                        value={formData.varMoq}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        id="varStatus"
                        value={formData.varStatus}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>Active</option>
                        <option>Optional</option>
                        <option>Inactive</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleAddVariant}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                      >
                        + Add Variant
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Variant</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Fill Volume</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Same Mold</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">MOQ</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Status</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.variants.map((variant, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 text-sm font-semibold">{variant.id}</td>
                            <td className="border border-gray-300 p-2 text-sm">{variant.volume}</td>
                            <td className="border border-gray-300 p-2 text-sm">{variant.sameMold}</td>
                            <td className="border border-gray-300 p-2 text-sm">{variant.moq}</td>
                            <td className="border border-gray-300 p-2 text-sm">{variant.status}</td>
                            <td className="border border-gray-300 p-2">
                              <button
                                onClick={() => handleDeleteVariant(idx)}
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

              {/* Stage 5: Customization & Tooling */}
              {currentStage === 5 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Customization Possible
                      </label>
                      <select
                        id="cusCustomizable"
                        value={formData.cusCustomizable}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Customizable Parameters
                      </label>
                      <input
                        type="text"
                        id="cusParams"
                        placeholder="Color, Printing, Labelling..."
                        value={formData.cusParams}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Standard MOQ
                      </label>
                      <input
                        type="number"
                        id="cusStdMoq"
                        value={formData.cusStdMoq}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Customized MOQ
                      </label>
                      <input
                        type="number"
                        id="cusCustomMoq"
                        value={formData.cusCustomMoq}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tooling / Mold Required
                      </label>
                      <select
                        id="cusToolingReq"
                        value={formData.cusToolingReq}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tooling Cost (INR)
                      </label>
                      <input
                        type="number"
                        id="cusToolingCost"
                        step="0.01"
                        value={formData.cusToolingCost}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Sampling Lead Time (days)
                      </label>
                      <input
                        type="number"
                        id="cusSamplingLT"
                        value={formData.cusSamplingLT}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Bulk Lead Time (Standard)
                      </label>
                      <input
                        type="number"
                        id="cusBulkLTStd"
                        value={formData.cusBulkLTStd}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Bulk Lead Time (Customized)
                      </label>
                      <input
                        type="number"
                        id="cusBulkLTCustom"
                        value={formData.cusBulkLTCustom}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Remarks
                      </label>
                      <input
                        type="text"
                        id="cusRemarks"
                        value={formData.cusRemarks}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Additional stages 6-12 would continue here in the same pattern... */}
              {/* For brevity, I'll implement the final stage (Review/JSON) and navigation */}

              {/* Stage 12: Review / JSON */}
              {currentStage === 12 && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Useful for backend developers: current state as JSON.
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
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                    <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      Import Now
                    </button>
                  </div>
                </div>
              )}

              {/* Stage 6: Compatibility (R&D / QA) */}
              {currentStage === 6 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Viscosity Compatibility</h3>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Low Viscosity (Lotion)
                      </label>
                      <select
                        id="compLow"
                        value={formData.compLow}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Medium Viscosity (Cream)
                      </label>
                      <select
                        id="compMed"
                        value={formData.compMed}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        High Viscosity (Gel/Paste)
                      </label>
                      <select
                        id="compHigh"
                        value={formData.compHigh}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8">Chemical Compatibility</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Oil-based / Oily Formulations
                      </label>
                      <select
                        id="compOil"
                        value={formData.compOil}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Compatible</option>
                        <option>Not Compatible</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Alcohol-based
                      </label>
                      <select
                        id="compAlc"
                        value={formData.compAlc}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Compatible</option>
                        <option>Not Compatible</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8">Functional Suitability</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Airless Pump Compatible
                      </label>
                      <select
                        id="compAirless"
                        value={formData.compAirless}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">N/A</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pump Mechanism Test
                      </label>
                      <select
                        id="compPump"
                        value={formData.compPump}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">N/A</option>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Leak Test Result
                      </label>
                      <select
                        id="compLeak"
                        value={formData.compLeak}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Active Ingredient Compatibility
                      </label>
                      <select
                        id="compActives"
                        value={formData.compActives}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Compatible</option>
                        <option>Not Compatible</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Risk Level
                      </label>
                      <select
                        id="compRisk"
                        value={formData.compRisk}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Remarks / Test Notes
                      </label>
                      <input
                        type="text"
                        id="compRemarks"
                        value={formData.compRemarks}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 7: Vendors & Commercial */}
              {currentStage === 7 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Vendor / Supplier Name
                      </label>
                      <input
                        type="text"
                        id="venName"
                        value={formData.venName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Location / Country
                      </label>
                      <input
                        type="text"
                        id="venLocation"
                        value={formData.venLocation}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        MOQ (Minimum Order Qty)
                      </label>
                      <input
                        type="number"
                        id="venMoq"
                        value={formData.venMoq}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Unit Price (INR)
                      </label>
                      <input
                        type="number"
                        id="venPrice"
                        step="0.01"
                        value={formData.venPrice}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Lead Time (days)
                      </label>
                      <input
                        type="number"
                        id="venLT"
                        value={formData.venLT}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Approved Status
                      </label>
                      <select
                        id="venApproved"
                        value={formData.venApproved}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Approved</option>
                        <option>Pending</option>
                        <option>Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Price Type
                      </label>
                      <select
                        id="venPriceType"
                        value={formData.venPriceType}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Ex-Works</option>
                        <option>FOB</option>
                        <option>CIF</option>
                        <option>DDP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Price Valid Till
                      </label>
                      <input
                        type="date"
                        id="venValid"
                        value={formData.venValid}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Sample Cost
                      </label>
                      <input
                        type="number"
                        id="venSampleCost"
                        step="0.01"
                        value={formData.venSampleCost}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleAddVendor}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                      >
                        + Add Vendor
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Vendor</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Location</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">MOQ</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Price</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Lead Time</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Status</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.vendors.map((vendor, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 text-sm">{vendor.name}</td>
                            <td className="border border-gray-300 p-2 text-sm">{vendor.location}</td>
                            <td className="border border-gray-300 p-2 text-sm">{vendor.moq}</td>
                            <td className="border border-gray-300 p-2 text-sm">₹{vendor.price}</td>
                            <td className="border border-gray-300 p-2 text-sm">{vendor.leadTime}d</td>
                            <td className="border border-gray-300 p-2 text-sm">{vendor.approved}</td>
                            <td className="border border-gray-300 p-2">
                              <button
                                onClick={() => handleDeleteVendor(idx)}
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

              {/* Stage 8: Secondary Packaging */}
              {currentStage === 8 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Label Type
                      </label>
                      <select
                        id="secLabelType"
                        value={formData.secLabelType}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Sticker / Pressure Sensitive</option>
                        <option>Sleeve</option>
                        <option>Direct Print</option>
                        <option>IML (In-Mold Label)</option>
                        <option>None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Label Size
                      </label>
                      <input
                        type="text"
                        id="secLabelSize"
                        placeholder="e.g., 50mm x 80mm"
                        value={formData.secLabelSize}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Adhesive Type
                      </label>
                      <input
                        type="text"
                        id="secAdhesive"
                        placeholder="Permanent / Removable"
                        value={formData.secAdhesive}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Label Compatibility
                      </label>
                      <select
                        id="secLabelCompat"
                        value={formData.secLabelCompat}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Compatible</option>
                        <option>Needs Testing</option>
                        <option>Not Compatible</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Monocarton GSM / Material
                      </label>
                      <input
                        type="text"
                        id="secGsm"
                        placeholder="e.g., 300 GSM Coated Board"
                        value={formData.secGsm}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Carton Finish
                      </label>
                      <select
                        id="secCartonFinish"
                        value={formData.secCartonFinish}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Matt Lamination</option>
                        <option>Gloss Lamination</option>
                        <option>UV Varnish</option>
                        <option>Foil Stamping</option>
                        <option>None</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Container Fit Test
                      </label>
                      <select
                        id="secFit"
                        value={formData.secFit}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Artwork / Design Link
                      </label>
                      <input
                        type="text"
                        id="secArtLink"
                        placeholder="Paste design file link"
                        value={formData.secArtLink}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      id="secNotes"
                      value={formData.secNotes}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 9: Tertiary Packaging */}
              {currentStage === 9 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Shipper / Outer Carton Type
                      </label>
                      <select
                        id="terShipType"
                        value={formData.terShipType}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>3-Ply Corrugated</option>
                        <option>5-Ply Corrugated</option>
                        <option>7-Ply Corrugated</option>
                        <option>Heavy Duty Box</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Units per Shipper
                      </label>
                      <input
                        type="number"
                        id="terUnits"
                        value={formData.terUnits}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Drop Test Result
                      </label>
                      <select
                        id="terDrop"
                        value={formData.terDrop}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Stack Test Result
                      </label>
                      <select
                        id="terStack"
                        value={formData.terStack}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Not Tested</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tertiary Notes
                    </label>
                    <textarea
                      id="terNotes"
                      value={formData.terNotes}
                      onChange={handleInputChange}
                      placeholder="Stacking height limits, storage conditions, shipping requirements"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Stage 10: Testing & Approval */}
              {currentStage === 10 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Test Log</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Test Name
                      </label>
                      <select
                        id="testName"
                        value={formData.testName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Visual Inspection</option>
                        <option>Dimensional Check</option>
                        <option>Leak Test</option>
                        <option>Drop Test</option>
                        <option>Torque Test</option>
                        <option>Pump Actuation</option>
                        <option>Material Declaration</option>
                        <option>Artwork Proof</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Result
                      </label>
                      <select
                        id="testResult"
                        value={formData.testResult}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Conditional Pass</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Test Date
                      </label>
                      <input
                        type="date"
                        id="testDate"
                        value={formData.testDate}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tested By
                      </label>
                      <input
                        type="text"
                        id="testBy"
                        value={formData.testBy}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Test Remarks
                    </label>
                    <input
                      type="text"
                      id="testRemarks"
                      value={formData.testRemarks}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-6">
                    <button
                      onClick={handleAddTest}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      + Add Test
                    </button>
                  </div>

                  <div className="overflow-x-auto mb-8">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Test</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Result</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Date</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">By</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Remarks</th>
                          <th className="border border-gray-300 p-2 text-left text-sm font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.tests.map((test, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 text-sm">{test.name}</td>
                            <td className="border border-gray-300 p-2 text-sm">{test.result}</td>
                            <td className="border border-gray-300 p-2 text-sm">{test.date}</td>
                            <td className="border border-gray-300 p-2 text-sm">{test.by}</td>
                            <td className="border border-gray-300 p-2 text-sm">{test.remarks}</td>
                            <td className="border border-gray-300 p-2">
                              <button
                                onClick={() => handleDeleteTest(idx)}
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

                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8">Approval Flags</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Packaging Approved
                      </label>
                      <select
                        id="apprPack"
                        value={formData.apprPack}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        R&D Approved
                      </label>
                      <select
                        id="apprRd"
                        value={formData.apprRd}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Finance Approved
                      </label>
                      <select
                        id="apprFin"
                        value={formData.apprFin}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Lock for Production
                      </label>
                      <select
                        id="apprLock"
                        value={formData.apprLock}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Locked</option>
                        <option>Unlocked</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 11: Catalogue / Website */}
              {currentStage === 11 && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Client Catalogue Visible
                      </label>
                      <select
                        id="catVisible"
                        value={formData.catVisible}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Share with Clients
                      </label>
                      <select
                        id="catShare"
                        value={formData.catShare}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option>All Clients</option>
                        <option>Selected Clients Only</option>
                        <option>Internal Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Website Display Name
                    </label>
                    <input
                      type="text"
                      id="catWebName"
                      placeholder="User-friendly name for website"
                      value={formData.catWebName}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tags / Keywords
                    </label>
                    <input
                      type="text"
                      id="catTags"
                      placeholder="e.g., Airless, Premium, Sustainable"
                      value={formData.catTags}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Recommended Product Types
                    </label>
                    <input
                      type="text"
                      id="catRecoTypes"
                      placeholder="Serum, Lotion, Cream"
                      value={formData.catRecoTypes}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Website Images (URLs)
                    </label>
                    <textarea
                      id="catWebImages"
                      placeholder="One URL per line"
                      value={formData.catWebImages}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
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

export default Packaging;
