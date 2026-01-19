import React, { useState, useEffect } from 'react'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'

const RawMaterial = () => {
    const { addItem } = useItems()
    const { addToast } = useToast()
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = useState(false)
    const [currentStage, setCurrentStage] = useState(0)
    const [status, setStatus] = useState('Draft')
    
    const [formData, setFormData] = useState({
        // Primary Info
        rmSku: '',
        rmTaxPreference: 'Taxable',
        rmReturnable: false,
        rmAssociateItems: '',

        // QC Categorisation & Coding
        rmCategory: '',
        qcInspectionGroup: '',
        subCategory: '',
        hazardHandlingClass: '',
        seriesPrefix: '',
        
        // Identity
        inciName: '',
        tradeCommercialName: '',
        functionRole: '',
        rmType: '',
        casNo: '',
        einecs: '',
        countryOfOrigin: '',
        manufacturer: '',
        synonyms: '',
        internalNotes: '',
        
        // Units, Tax & Procurement
        primaryUom: '',
        issueUom: '',
        conversionFactor: '',
        standardPackSize: '',
        hsnCode: '',
        gst: '',
        accountingCategory: '',
        preferredCurrency: 'INR',
        
        // Technical & Regulatory
        grade: '',
        compliance: '',
        allergenRequired: '',
        gmoRequired: '',
        sdsAvailable: '',
        coaAvailable: '',
        regulatoryNotes: '',
        
        // Quality Specifications
        assayPurity: '',
        appearanceSpec: '',
        phSpec: '',
        moistureLod: '',
        heavyMetalsSpec: '',
        microbialSpec: '',
        odorColorSpec: '',
        otherSpecs: '',
        
        // Usage in Formulation
        recommendedUseLevel: '',
        maxUseLevel: '',
        solubility: '',
        processingGuidance: '',
        incompatibilities: '',
        stabilityNotes: '',
        claims: '',
        
        // Vendors & Commercial
        vendorName: '',
        vendorLocation: '',
        moq: '',
        unitPrice: '',
        leadTime: '',
        approved: '',
        priceValidTill: '',
        preferredVendor: '',
        vendors: [],
        
        // QA Testing & Documents
        documentType: '',
        documentLink: '',
        documentDate: '',
        testName: '',
        testResult: '',
        testDate: '',
        approvedBy: '',
        testRemarks: '',
        documents: [],
        tests: [],
        
        // Inventory, Storage & WH
        storageConditions: '',
        shelfLife: '',
        retestPeriod: '',
        warehouseLocation: '',
        batchTracking: '',
        fifoFefo: '',
        minimumStock: '',
        reorderLevel: '',
        handlingNotes: ''
    })

    // Auto-save draft every 30 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            if (Object.values(formData).some(v => Boolean(v))) {
                localStorage.setItem('raw_material_draft', JSON.stringify(formData))
                addToast('info', 'Raw Material draft auto-saved')
            }
        }, 30000)
        return () => clearInterval(timer)
    }, [formData, addToast])

    // Load draft on mount
    useEffect(() => {
        const draft = localStorage.getItem('raw_material_draft')
        if (draft) {
            setFormData(JSON.parse(draft))
            addToast('info', 'Raw Material draft loaded')
        }
    }, [])

    const stages = [
        'Primary Info',
        'QC Categorisation & Coding',
        'Identity',
        'Units, Tax & Procurement Basics',
        'Technical & Regulatory',
        'Quality Specifications',
        'Usage in Formulation (R&D)',
        'Vendors & Commercial',
        'QA Testing & Documents',
        'Inventory, Storage & WH',
        'Review / JSON'
    ]

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleAddVendor = () => {
        if (!formData.vendorName.trim()) {
            setErrors(prev => ({ ...prev, vendorName: 'Vendor name is required' }))
            addToast('error', 'Vendor name is required')
            return
        }
        const newVendor = {
            id: Date.now(),
            name: formData.vendorName,
            location: formData.vendorLocation,
            moq: formData.moq,
            unitPrice: formData.unitPrice,
            leadTime: formData.leadTime,
            approved: formData.approved,
            priceValidTill: formData.priceValidTill
        }
        setFormData(prev => ({
            ...prev,
            vendors: [...prev.vendors, newVendor],
            vendorName: '',
            vendorLocation: '',
            moq: '',
            unitPrice: '',
            leadTime: '',
            approved: '',
            priceValidTill: ''
        }))
    }

    const handleDeleteVendor = (id) => {
        setFormData(prev => ({
            ...prev,
            vendors: prev.vendors.filter(v => v.id !== id)
        }))
    }

    const handleAddDocument = () => {
        if (!formData.documentType || !formData.documentLink.trim()) {
            setErrors(prev => ({ ...prev, documentType: 'Document type and link are required' }))
            addToast('error', 'Document type and link are required')
            return
        }
        const newDoc = {
            id: Date.now(),
            type: formData.documentType,
            link: formData.documentLink,
            date: formData.documentDate
        }
        setFormData(prev => ({
            ...prev,
            documents: [...prev.documents, newDoc],
            documentType: '',
            documentLink: '',
            documentDate: ''
        }))
    }

    const handleDeleteDocument = (id) => {
        setFormData(prev => ({
            ...prev,
            documents: prev.documents.filter(d => d.id !== id)
        }))
    }

    const handleAddTest = () => {
        if (!formData.testName || !formData.testResult) {
            setErrors(prev => ({ ...prev, testName: 'Test name and result are required' }))
            addToast('error', 'Test name and result are required')
            return
        }
        const newTest = {
            id: Date.now(),
            name: formData.testName,
            result: formData.testResult,
            date: formData.testDate,
            approvedBy: formData.approvedBy,
            remarks: formData.testRemarks
        }
        setFormData(prev => ({
            ...prev,
            tests: [...prev.tests, newTest],
            testName: '',
            testResult: '',
            testDate: '',
            approvedBy: '',
            testRemarks: ''
        }))
    }

    const handleDeleteTest = (id) => {
        setFormData(prev => ({
            ...prev,
            tests: prev.tests.filter(t => t.id !== id)
        }))
    }

    const handleNextStage = () => {
        if (currentStage < stages.length - 1) {
            setCurrentStage(currentStage + 1)
        }
    }

    const handlePrevStage = () => {
        if (currentStage > 0) {
            setCurrentStage(currentStage - 1)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const newItem = {
            id: Date.now().toString(),
            type: 'raw-material' as const,
            name: formData.inciName || formData.tradeCommercialName || 'Unnamed Material',
            code: formData.seriesPrefix || 'RM-' + Date.now().toString().slice(-6),
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            data: formData,
        };
        addItem(newItem);
        addToast('success', 'Raw Material saved successfully!');
    }

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Raw Materials</h1>
                    <p className="text-gray-600">Manage raw material master data</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
                    {/* Status Dropdown */}
                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                            <option value="Draft">Draft</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>

                    {/* Stage Progress */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            {stages.map((stage, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center ${index < stages.length - 1 ? 'flex-1' : ''}`}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                                            index <= currentStage
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-gray-300 text-gray-600'
                                        }`}
                                    >
                                        {index + 1}
                                    </div>
                                    {index < stages.length - 1 && (
                                        <div
                                            className={`flex-1 h-1 mx-2 ${
                                                index < currentStage ? 'bg-amber-600' : 'bg-gray-300'
                                            }`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-center text-sm font-semibold text-gray-700">{stages[currentStage]}</p>
                    </div>

                    {/* Stage 0: Primary Info */}
                    {currentStage === 0 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Primary Information
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        RM Code / SKU
                                    </label>
                                    <input
                                        type="text"
                                        name="rmSku"
                                        value={formData.rmSku}
                                        onChange={handleInputChange}
                                        placeholder="e.g. EI-RM-00001 or supplier SKU"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Tax Preference
                                    </label>
                                    <select
                                        name="rmTaxPreference"
                                        value={formData.rmTaxPreference}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="Taxable">Taxable</option>
                                        <option value="ExemptedGoods">Exempted Goods</option>
                                        <option value="ExemptedServices">Exempted Services</option>
                                        <option value="NonGST">Non-GST</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="rmReturnable"
                                        checked={formData.rmReturnable}
                                        onChange={(e) =>
                                            setFormData(prev => ({ ...prev, rmReturnable: e.target.checked }))
                                        }
                                        className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                                    />
                                    <span className="ml-2 text-sm font-semibold text-gray-700">Returnable Item</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Associate Items
                                </label>
                                <textarea
                                    name="rmAssociateItems"
                                    value={formData.rmAssociateItems}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Enter associated item codes/names, comma-separated"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage 1: QC Categorisation & Coding */}
                    {currentStage === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                RM Category
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        RM Category (QC)
                                    </label>
                                    <select
                                        name="rmCategory"
                                        value={formData.rmCategory}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="active">Active</option>
                                        <option value="base">Base</option>
                                        <option value="excipient">Excipient</option>
                                        <option value="preservative">Preservative</option>
                                        <option value="fragrance">Fragrance</option>
                                        <option value="colour">Colour</option>
                                        <option value="botanical-extract">Botanical / Extract</option>
                                        <option value="surfactant">Surfactant</option>
                                        <option value="polymer-thickener">Polymer / Thickener</option>
                                        <option value="solvent">Solvent</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        QC Inspection Group
                                    </label>
                                    <select
                                        name="qcInspectionGroup"
                                        value={formData.qcInspectionGroup}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="identity-assay">Identity + Assay</option>
                                        <option value="physical">Physical (Appearance / Odor / Color)</option>
                                        <option value="microbiology">Microbiology</option>
                                        <option value="heavy-metals">Heavy metals / Impurities</option>
                                        <option value="residual-solvents">Residual solvents</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Sub-Category (optional)
                                </label>
                                <input
                                    type="text"
                                    name="subCategory"
                                    value={formData.subCategory}
                                    onChange={handleInputChange}
                                    placeholder="e.g. UV filter / Peptide / Humectant / Emollient"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Hazard Handling Class
                                </label>
                                <select
                                    name="hazardHandlingClass"
                                    value={formData.hazardHandlingClass}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                >
                                    <option value="">Select</option>
                                    <option value="non-hazardous">Non-hazardous</option>
                                    <option value="flammable">Flammable</option>
                                    <option value="corrosive">Corrosive</option>
                                    <option value="oxidizer">Oxidizer</option>
                                    <option value="allergen-sensitizer">Allergen / Sensitizer</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className="bg-gray-100 p-6 rounded-lg">
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                                    Code Series Preview
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                                            Series Prefix
                                        </label>
                                        <input
                                            type="text"
                                            name="seriesPrefix"
                                            value={formData.seriesPrefix}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                                            Next Code (preview)
                                        </label>
                                        <div className="px-3 py-2 border border-gray-300 rounded bg-white text-center text-gray-600">
                                            -
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-4">
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold"
                                    >
                                        Generate Code Now
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-semibold"
                                    >
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stage 2: Identity */}
                    {currentStage === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Identity
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        INCI Name
                                    </label>
                                    <input
                                        type="text"
                                        name="inciName"
                                        value={formData.inciName}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Trade / Commercial Name
                                    </label>
                                    <input
                                        type="text"
                                        name="tradeCommercialName"
                                        value={formData.tradeCommercialName}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Function / Role
                                    </label>
                                    <input
                                        type="text"
                                        name="functionRole"
                                        value={formData.functionRole}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        RM Type
                                    </label>
                                    <select
                                        name="rmType"
                                        value={formData.rmType}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="powder">Powder</option>
                                        <option value="liquid">Liquid</option>
                                        <option value="paste">Paste</option>
                                        <option value="granules">Granules</option>
                                        <option value="flakes">Flakes</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        CAS No.
                                    </label>
                                    <input
                                        type="text"
                                        name="casNo"
                                        value={formData.casNo}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        EINECS / EC No.
                                    </label>
                                    <input
                                        type="text"
                                        name="einecs"
                                        value={formData.einecs}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Country of Origin
                                    </label>
                                    <input
                                        type="text"
                                        name="countryOfOrigin"
                                        value={formData.countryOfOrigin}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Manufacturer (if different from vendor)
                                    </label>
                                    <input
                                        type="text"
                                        name="manufacturer"
                                        value={formData.manufacturer}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Synonyms / Alternate Names
                                </label>
                                <input
                                    type="text"
                                    name="synonyms"
                                    value={formData.synonyms}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Internal Notes
                                </label>
                                <textarea
                                    name="internalNotes"
                                    value={formData.internalNotes}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage 3: Units, Tax & Procurement Basics */}
                    {currentStage === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Units, Tax & Procurement Basics
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Primary UoM (purchase)
                                    </label>
                                    <select
                                        name="primaryUom"
                                        value={formData.primaryUom}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="kg">KG</option>
                                        <option value="gm">GM</option>
                                        <option value="l">L</option>
                                        <option value="ml">ML</option>
                                        <option value="ton">TON</option>
                                        <option value="pcs">PCS</option>
                                        <option value="drum">DRUM</option>
                                        <option value="can">CAN</option>
                                        <option value="pack">PACK</option>
                                        <option value="other">OTHER</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Issue / Consumption UoM (BOM)
                                    </label>
                                    <select
                                        name="issueUom"
                                        value={formData.issueUom}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="kg">KG</option>
                                        <option value="gm">GM</option>
                                        <option value="l">L</option>
                                        <option value="ml">ML</option>
                                        <option value="pcs">PCS</option>
                                        <option value="other">OTHER</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Conversion Factor (Primary → Issue)
                                    </label>
                                    <input
                                        type="text"
                                        name="conversionFactor"
                                        value={formData.conversionFactor}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Standard Pack Size
                                    </label>
                                    <input
                                        type="text"
                                        name="standardPackSize"
                                        value={formData.standardPackSize}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide mt-8 mb-4">
                                Tax & Accounting
                            </h3>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        HSN Code
                                    </label>
                                    <input
                                        type="text"
                                        name="hsnCode"
                                        value={formData.hsnCode}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        GST %
                                    </label>
                                    <input
                                        type="text"
                                        name="gst"
                                        value={formData.gst}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Accounting Category
                                    </label>
                                    <select
                                        name="accountingCategory"
                                        value={formData.accountingCategory}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="raw-material">Raw Material</option>
                                        <option value="consumable">Consumable</option>
                                        <option value="packaging">Packaging (RM-type)</option>
                                        <option value="trading">Trading</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Preferred Currency
                                    </label>
                                    <select
                                        name="preferredCurrency"
                                        value={formData.preferredCurrency}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="INR">INR</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stage 4: Technical & Regulatory */}
                    {currentStage === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Technical & Regulatory
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Grade
                                    </label>
                                    <select
                                        name="grade"
                                        value={formData.grade}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="cosmetic">Cosmetic</option>
                                        <option value="pharma">Pharma</option>
                                        <option value="food">Food</option>
                                        <option value="industrial">Industrial</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Compliance
                                    </label>
                                    <input
                                        type="text"
                                        name="compliance"
                                        value={formData.compliance}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Allergen Declaration Required
                                    </label>
                                    <select
                                        name="allergenRequired"
                                        value={formData.allergenRequired}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        GMO / BSE-TSE Declaration
                                    </label>
                                    <select
                                        name="gmoRequired"
                                        value={formData.gmoRequired}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="required">Required</option>
                                        <option value="not-required">Not required</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        MSDS / SDS Available
                                    </label>
                                    <select
                                        name="sdsAvailable"
                                        value={formData.sdsAvailable}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        COA Template Available
                                    </label>
                                    <select
                                        name="coaAvailable"
                                        value={formData.coaAvailable}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Regulatory Notes
                                </label>
                                <textarea
                                    name="regulatoryNotes"
                                    value={formData.regulatoryNotes}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage 5: Quality Specifications */}
                    {currentStage === 5 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Quality Specifications (QC)
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Assay / Purity Spec
                                    </label>
                                    <input
                                        type="text"
                                        name="assayPurity"
                                        value={formData.assayPurity}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 98% min"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Appearance Spec
                                    </label>
                                    <input
                                        type="text"
                                        name="appearanceSpec"
                                        value={formData.appearanceSpec}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        pH (if applicable)
                                    </label>
                                    <input
                                        type="text"
                                        name="phSpec"
                                        value={formData.phSpec}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 4.5-7.5"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Moisture / Loss on Drying
                                    </label>
                                    <input
                                        type="text"
                                        name="moistureLod"
                                        value={formData.moistureLod}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Max 5%"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Heavy Metals Spec
                                    </label>
                                    <input
                                        type="text"
                                        name="heavyMetalsSpec"
                                        value={formData.heavyMetalsSpec}
                                        onChange={handleInputChange}
                                        placeholder="e.g., As <10 ppm"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Microbial Limits Spec
                                    </label>
                                    <input
                                        type="text"
                                        name="microbialSpec"
                                        value={formData.microbialSpec}
                                        onChange={handleInputChange}
                                        placeholder="e.g., TPC <100 CFU/g"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Odor / Color Limits
                                    </label>
                                    <input
                                        type="text"
                                        name="odorColorSpec"
                                        value={formData.odorColorSpec}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Other Specs
                                    </label>
                                    <input
                                        type="text"
                                        name="otherSpecs"
                                        value={formData.otherSpecs}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stage 5: Usage in Formulation */}
                    {currentStage === 5 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Usage in Formulation (R&D)
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Recommended Use Level (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="recommendedUseLevel"
                                        value={formData.recommendedUseLevel}
                                        onChange={handleInputChange}
                                        step="0.0001"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Max Use Level (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="maxUseLevel"
                                        value={formData.maxUseLevel}
                                        onChange={handleInputChange}
                                        step="0.0001"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Solubility
                                    </label>
                                    <input
                                        type="text"
                                        name="solubility"
                                        value={formData.solubility}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Water soluble"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Processing Guidance
                                    </label>
                                    <input
                                        type="text"
                                        name="processingGuidance"
                                        value={formData.processingGuidance}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Incompatibilities
                                    </label>
                                    <input
                                        type="text"
                                        name="incompatibilities"
                                        value={formData.incompatibilities}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Stability Notes
                                    </label>
                                    <input
                                        type="text"
                                        name="stabilityNotes"
                                        value={formData.stabilityNotes}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Claims / Benefits
                                </label>
                                <textarea
                                    name="claims"
                                    value={formData.claims}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage 6: Vendors & Commercial */}
                    {currentStage === 6 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Vendors & Commercial
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Vendor Name
                                    </label>
                                    <input
                                        type="text"
                                        name="vendorName"
                                        value={formData.vendorName}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        name="vendorLocation"
                                        value={formData.vendorLocation}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        MOQ
                                    </label>
                                    <input
                                        type="text"
                                        name="moq"
                                        value={formData.moq}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Unit Price
                                    </label>
                                    <input
                                        type="number"
                                        name="unitPrice"
                                        value={formData.unitPrice}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Lead Time (days)
                                    </label>
                                    <input
                                        type="number"
                                        name="leadTime"
                                        value={formData.leadTime}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Approved?
                                    </label>
                                    <select
                                        name="approved"
                                        value={formData.approved}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                        <option value="optional">Optional</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Price Valid Till
                                </label>
                                <input
                                    type="date"
                                    name="priceValidTill"
                                    value={formData.priceValidTill}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAddVendor}
                                className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold"
                            >
                                + Add Vendor
                            </button>

                            {formData.vendors.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse border border-gray-300">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Vendor</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Location</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">MOQ</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Unit Price</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Lead Time</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Approved</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.vendors.map((vendor) => (
                                                <tr key={vendor.id}>
                                                    <td className="border border-gray-300 px-4 py-2">{vendor.name}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{vendor.location}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{vendor.moq}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{vendor.unitPrice}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{vendor.leadTime}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{vendor.approved}</td>
                                                    <td className="border border-gray-300 px-4 py-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteVendor(vendor.id)}
                                                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Preferred Vendor (name)
                                </label>
                                <input
                                    type="text"
                                    name="preferredVendor"
                                    value={formData.preferredVendor}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage 7: QA Testing & Documents */}
                    {currentStage === 7 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                QA Testing & Documents
                            </h2>

                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
                                <h3 className="font-semibold text-amber-900 mb-2">Documents</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Document Type
                                    </label>
                                    <select
                                        name="documentType"
                                        value={formData.documentType}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="coa">COA</option>
                                        <option value="sds">SDS / MSDS</option>
                                        <option value="tds">TDS</option>
                                        <option value="allergen">Allergen Declaration</option>
                                        <option value="gmo">GMO / BSE-TSE</option>
                                        <option value="ifra">IFRA Statement</option>
                                        <option value="origin">Origin Certificate</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Document Link
                                    </label>
                                    <input
                                        type="text"
                                        name="documentLink"
                                        value={formData.documentLink}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Version / Date
                                    </label>
                                    <input
                                        type="date"
                                        name="documentDate"
                                        value={formData.documentDate}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={handleAddDocument}
                                        className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold"
                                    >
                                        + Add Document
                                    </button>
                                </div>
                            </div>

                            {formData.documents.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse border border-gray-300">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Doc Type</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Link</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.documents.map((doc) => (
                                                <tr key={doc.id}>
                                                    <td className="border border-gray-300 px-4 py-2">{doc.type}</td>
                                                    <td className="border border-gray-300 px-4 py-2 truncate">{doc.link}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{doc.date}</td>
                                                    <td className="border border-gray-300 px-4 py-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mt-8">
                                <h3 className="font-semibold text-amber-900 mb-2">QC Test Log</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Test Name
                                    </label>
                                    <select
                                        name="testName"
                                        value={formData.testName}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="identification">Identification</option>
                                        <option value="assay">Assay / Purity</option>
                                        <option value="ph">pH</option>
                                        <option value="lod">LOD / Moisture</option>
                                        <option value="heavy-metals">Heavy Metals</option>
                                        <option value="microbiology">Microbiology</option>
                                        <option value="residual-solvents">Residual Solvents</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Result
                                    </label>
                                    <select
                                        name="testResult"
                                        value={formData.testResult}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="observation">Observation</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        name="testDate"
                                        value={formData.testDate}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Approved By
                                    </label>
                                    <input
                                        type="text"
                                        name="approvedBy"
                                        value={formData.approvedBy}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Remarks
                                    </label>
                                    <input
                                        type="text"
                                        name="testRemarks"
                                        value={formData.testRemarks}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={handleAddTest}
                                        className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold"
                                    >
                                        + Log Test
                                    </button>
                                </div>
                            </div>

                            {formData.tests.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse border border-gray-300">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Test</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Result</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Approved By</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Remarks</th>
                                                <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.tests.map((test) => (
                                                <tr key={test.id}>
                                                    <td className="border border-gray-300 px-4 py-2">{test.name}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{test.result}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{test.date}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{test.approvedBy}</td>
                                                    <td className="border border-gray-300 px-4 py-2">{test.remarks}</td>
                                                    <td className="border border-gray-300 px-4 py-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTest(test.id)}
                                                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stage 8: Inventory, Storage & WH */}
                    {currentStage === 8 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Inventory, Storage & WH
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Storage Conditions
                                    </label>
                                    <input
                                        type="text"
                                        name="storageConditions"
                                        value={formData.storageConditions}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Room temp, dry place"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Shelf Life (months)
                                    </label>
                                    <input
                                        type="number"
                                        name="shelfLife"
                                        value={formData.shelfLife}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Re-test Period (months)
                                    </label>
                                    <input
                                        type="number"
                                        name="retestPeriod"
                                        value={formData.retestPeriod}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Default WH Location Type
                                    </label>
                                    <select
                                        name="warehouseLocation"
                                        value={formData.warehouseLocation}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="rm-store">RM Store</option>
                                        <option value="cold-room">Cold Room</option>
                                        <option value="flammable">Flammable Store</option>
                                        <option value="qa-hold">QA Hold</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Batch Tracking Required
                                    </label>
                                    <select
                                        name="batchTracking"
                                        value={formData.batchTracking}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        FIFO/FEFO Rule
                                    </label>
                                    <select
                                        name="fifoFefo"
                                        value={formData.fifoFefo}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    >
                                        <option value="">Select</option>
                                        <option value="fifo">FIFO</option>
                                        <option value="fefo">FEFO</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Minimum Stock Level
                                    </label>
                                    <input
                                        type="number"
                                        name="minimumStock"
                                        value={formData.minimumStock}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Reorder Level
                                    </label>
                                    <input
                                        type="number"
                                        name="reorderLevel"
                                        value={formData.reorderLevel}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Handling Notes
                                </label>
                                <textarea
                                    name="handlingNotes"
                                    value={formData.handlingNotes}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage 9: Review / JSON */}
                    {currentStage === 9 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-6">
                                Review / JSON Snapshot
                            </h2>

                            <button
                                type="button"
                                onClick={() => console.log(JSON.stringify(formData, null, 2))}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold"
                            >
                                Copy JSON to Console
                            </button>

                            <div className="bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap break-words">
                                    {JSON.stringify(formData, null, 2)}
                                </pre>
                            </div>

                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                <h3 className="font-semibold text-green-900 mb-2">Form Complete</h3>
                                <p className="text-sm text-green-800">
                                    All stages have been filled. Click Submit to save the Raw Material master record.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-10 pt-8 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handlePrevStage}
                            disabled={currentStage === 0}
                            className={`px-6 py-2 rounded-lg font-semibold ${
                                currentStage === 0
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                        >
                            Previous
                        </button>

                        {currentStage === stages.length - 1 ? (
                            <button
                                type="submit"
                                className="px-8 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                            >
                                Submit
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleNextStage}
                                className="px-6 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
                            >
                                Next
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}

export default RawMaterial
