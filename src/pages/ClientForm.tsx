import React, { useEffect, useMemo, useState } from 'react';
import { useVendorClient } from '../context/VendorClientContext';
import { useToast } from '../context/ToastContext';

interface Document {
 type: string;
 link: string;
 date: string;
}

interface POC {
 name: string;
 role: string;
 email: string;
 phone: string;
 level: string;
 preferred: string;
 notes: string;
}

interface BankDetail {
 beneficiaryName: string;
 bankName: string;
 accountNo: string;
 ifsc: string;
 branch: string;
 accountType: string;
 upiId: string;
 isDefault: string;
 notes: string;
}

interface ProductInterest {
 productCategory: string;
 productType: string;
 expectedVolume: string;
 frequency: string;
 targetPrice: string;
 specifications: string;
 priority: string;
}

interface ClientFormData {
 setupType: 'CLIENT';
 setupCategory: string;
 setupPrefix: string;
 entityCode: string;
 legalName: string;
 tradeName: string;
 brandName: string;
 primaryEmail: string;
 primaryPhone: string;
 billingAddress: string;
 shippingAddress: string;
 state: string;
 country: string;
 website: string;
 segment: string;
 industry: string;
 businessType: string;
 notes: string;
 gstin: string;
 pan: string;
 tan: string;
 cin: string;
 fssaiLicense: string;
 drugLicense: string;
 paymentTerms: string;
 customTerms: string;
 creditLimit: string;
 advanceRequired: string;
 tdsApplicable: string;
 preferredPaymentMode: string;
 paymentNotes: string;
 agreementType: string;
 agreementStatus: string;
 startDate: string;
 endDate: string;
 agreementLink: string;
 owner: string;
 agreementNotes: string;
 salesOwner: string;
 accountManager: string;
 leadSource: string;
 referredBy: string;
 clientStage: string;
 potentialValue: string;
 acquisitionDate: string;
}

type ClientFormProps = {
 editingId?: string | null;
 onSaved?: () => void;
};

const ClientForm: React.FC<ClientFormProps> = ({ editingId = null, onSaved }) => {
 const { vendorClients, addVendorClient, updateVendorClient } = useVendorClient();
 const { addToast } = useToast();
 const [currentStage, setCurrentStage] = useState(0);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [isSaving, setIsSaving] = useState(false);

 const existingClient = useMemo(() => {
  if (!editingId) return null;
  return vendorClients.find(v => v.id === editingId && v.type === 'client') || null;
 }, [editingId, vendorClients]);

 const [documents, setDocuments] = useState<Document[]>([]);
 const [pocs, setPocs] = useState<POC[]>([]);
 const [banks, setBanks] = useState<BankDetail[]>([]);
 const [productInterests, setProductInterests] = useState<ProductInterest[]>([]);

 const [tempDoc, setTempDoc] = useState({ type: '', link: '', date: '' });
 const [tempPoc, setTempPoc] = useState({ name: '', role: '', email: '', phone: '', level: '', preferred: '', notes: '' });
 const [tempBank, setTempBank] = useState({ beneficiaryName: '', bankName: '', accountNo: '', ifsc: '', branch: '', accountType: '', upiId: '', isDefault: '', notes: '' });
 const [tempProduct, setTempProduct] = useState({ productCategory: '', productType: '', expectedVolume: '', frequency: '', targetPrice: '', specifications: '', priority: 'Medium' });

 const [formData, setFormData] = useState<ClientFormData>({
  setupType: 'CLIENT',
  setupCategory: '',
  setupPrefix: 'CLI',
  entityCode: '',
  legalName: '',
  tradeName: '',
  brandName: '',
  primaryEmail: '',
  primaryPhone: '',
  billingAddress: '',
  shippingAddress: '',
  state: '',
  country: 'India',
  website: '',
  segment: '',
  industry: '',
  businessType: '',
  notes: '',
  gstin: '',
  pan: '',
  tan: '',
  cin: '',
  fssaiLicense: '',
  drugLicense: '',
  paymentTerms: '',
  customTerms: '',
  creditLimit: '',
  advanceRequired: '',
  tdsApplicable: '',
  preferredPaymentMode: '',
  paymentNotes: '',
  agreementType: '',
  agreementStatus: '',
  startDate: '',
  endDate: '',
  agreementLink: '',
  owner: '',
  agreementNotes: '',
  salesOwner: '',
  accountManager: '',
  leadSource: '',
  referredBy: '',
  clientStage: '',
  potentialValue: '',
  acquisitionDate: '',
 });

 const stages = [
  { title: 'Setup & Coding', hint: 'Pick entity type and generate code series.' },
  { title: 'Organization Details', hint: 'Brand, addresses, website, segment and industry.' },
  { title: 'Tax, Compliance & Documents', hint: 'GST/PAN/TAN/CIN/Licenses + document register.' },
  { title: 'Multi-level POCs', hint: 'Multiple contacts with escalation levels and departments.' },
  { title: 'Bank Details', hint: 'Client bank accounts for refunds and payments.' },
  { title: 'Payment Terms & Credit', hint: 'Terms, credit limit, advance requirements.' },
  { title: 'Product Interest & Requirements', hint: 'Products/services client is interested in.' },
  { title: 'Agreements & Client Status', hint: 'Contracts, sales owner, client lifecycle.' },
 ];

 const draftKey = useMemo(() => {
  return editingId ? `client_form_draft_${editingId}` : 'client_form_draft';
 }, [editingId]);

 useEffect(() => {
  const timer = setInterval(() => {
   if (Object.values(formData).some(v => Boolean(v))) {
    const draftData = { formData, documents, pocs, banks, productInterests };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
   }
  }, 30000);
  return () => clearInterval(timer);
 }, [formData, documents, pocs, banks, productInterests, draftKey]);

 useEffect(() => {
  if (existingClient) {
   const data = (existingClient.data || {}) as any;
   setFormData(prev => ({ ...prev, ...(data as any), setupType: 'CLIENT', setupPrefix: 'CLI' }));
   setDocuments(Array.isArray(data.documents) ? data.documents : []);
   setPocs(Array.isArray(data.pocs) ? data.pocs : []);
   setBanks(Array.isArray(data.banks) ? data.banks : []);
   setProductInterests(Array.isArray(data.productInterests) ? data.productInterests : []);
   setCurrentStage(0);
   return;
  }

  const draft = localStorage.getItem(draftKey);
  if (draft) {
   try {
    const parsed = JSON.parse(draft);
    if (parsed.formData) setFormData(parsed.formData);
    if (parsed.documents) setDocuments(parsed.documents);
    if (parsed.pocs) setPocs(parsed.pocs);
    if (parsed.banks) setBanks(parsed.banks);
    if (parsed.productInterests) setProductInterests(parsed.productInterests);
   } catch (e) {
    console.error('Failed to load draft:', e);
   }
  }
 }, [existingClient, draftKey]);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
  if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
 };

 const validateStage = (_stage: number, forSubmit = false): boolean => {
  const newErrors: Record<string, string> = {};
  if (forSubmit) {
   if (!formData.legalName.trim()) {
    newErrors.legalName = 'Legal name is required';
    addToast('error', 'Legal name is required');
   }
   if (!formData.tradeName.trim()) {
    newErrors.tradeName = 'Trade name is required';
    addToast('error', 'Trade name is required');
   }
   if (!formData.primaryEmail.trim()) {
    newErrors.primaryEmail = 'Primary email is required';
    addToast('error', 'Primary email is required');
   }
  }
  if (Object.keys(newErrors).length > 0) {
   setErrors(newErrors);
   return false;
  }
  return true;
 };

 const handleNextStage = () => {
  if (currentStage < stages.length - 1) setCurrentStage(currentStage + 1);
 };

 const handlePrevStage = () => {
  if (currentStage > 0) setCurrentStage(currentStage - 1);
 };

 const generateCode = () => {
  const counter = parseInt(localStorage.getItem('client_counter') || '0') + 1;
  localStorage.setItem('client_counter', counter.toString());
  const code = `EI-CLI-${counter.toString().padStart(5, '0')}`;
  setFormData(prev => ({ ...prev, entityCode: code }));
  addToast('success', `Client code generated: ${code}`);
 };

 const regenerateCode = () => {
  const counter = parseInt(localStorage.getItem('client_counter') || '0') + 1;
  localStorage.setItem('client_counter', counter.toString());
  const code = `EI-CLI-${counter.toString().padStart(5, '0')}`;
  setFormData(prev => ({ ...prev, entityCode: code }));
  addToast('success', `Client code regenerated: ${code}`);
 };

 const addDocument = () => {
  if (!tempDoc.type || !tempDoc.link) { addToast('error', 'Document type and link are required'); return; }
  setDocuments([...documents, tempDoc]);
  setTempDoc({ type: '', link: '', date: '' });
  addToast('success', 'Document added');
 };

 const removeDocument = (index: number) => {
  setDocuments(documents.filter((_, i) => i !== index));
  addToast('success', 'Document removed');
 };

 const addPOC = () => {
  if (!tempPoc.name || !tempPoc.role) { addToast('error', 'POC name and role are required'); return; }
  setPocs([...pocs, tempPoc]);
  setTempPoc({ name: '', role: '', email: '', phone: '', level: '', preferred: '', notes: '' });
  addToast('success', 'POC added');
 };

 const removePOC = (index: number) => {
  setPocs(pocs.filter((_, i) => i !== index));
  addToast('success', 'POC removed');
 };

 const addBank = () => {
  if (!tempBank.beneficiaryName || !tempBank.bankName || !tempBank.accountNo || !tempBank.ifsc) {
   addToast('error', 'Beneficiary, bank name, account no, and IFSC are required'); return;
  }
  setBanks([...banks, tempBank]);
  setTempBank({ beneficiaryName: '', bankName: '', accountNo: '', ifsc: '', branch: '', accountType: '', upiId: '', isDefault: '', notes: '' });
  addToast('success', 'Bank account added');
 };

 const removeBank = (index: number) => {
  setBanks(banks.filter((_, i) => i !== index));
  addToast('success', 'Bank account removed');
 };

 const addProductInterest = () => {
  if (!tempProduct.productCategory || !tempProduct.productType) { addToast('error', 'Product category and type are required'); return; }
  setProductInterests([...productInterests, tempProduct]);
  setTempProduct({ productCategory: '', productType: '', expectedVolume: '', frequency: '', targetPrice: '', specifications: '', priority: 'Medium' });
  addToast('success', 'Product interest added');
 };

 const removeProductInterest = (index: number) => {
  setProductInterests(productInterests.filter((_, i) => i !== index));
  addToast('success', 'Product interest removed');
 };

 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateStage(currentStage, true)) return;
  setIsSaving(true);

  const payload = {
   name: formData.tradeName || formData.legalName,
   email: formData.primaryEmail,
   phone: formData.primaryPhone,
   location: formData.state,
   country: formData.country,
   category: formData.setupCategory,
   paymentTerms: formData.paymentTerms,
   notes: formData.notes,
   data: { ...formData, documents, pocs, banks, productInterests },
  };

  if (editingId && existingClient) {
   updateVendorClient(editingId, payload);
   addToast('success', 'Client updated successfully!');
   localStorage.removeItem(draftKey);
   setIsSaving(false);
   onSaved?.();
   return;
  }

  const newClient = {
   id: Date.now().toString(),
   type: 'client' as const,
   name: payload.name,
   email: payload.email,
   phone: payload.phone,
   location: payload.location,
   country: payload.country,
   city: '',
   category: payload.category,
   rating: 0,
   status: 'pending' as const,
   moq: '',
   leadTime: '',
   paymentTerms: payload.paymentTerms,
   notes: payload.notes,
   createdAt: new Date().toISOString(),
   lastModified: new Date().toISOString(),
   data: payload.data,
  };

  addVendorClient(newClient);
  addToast('success', 'Client created successfully!');
  localStorage.removeItem(draftKey);
  
  setFormData({
   setupType: 'CLIENT', setupCategory: '', setupPrefix: 'CLI', entityCode: '',
   legalName: '', tradeName: '', brandName: '', primaryEmail: '', primaryPhone: '',
   billingAddress: '', shippingAddress: '', state: '', country: 'India',
   website: '', segment: '', industry: '', businessType: '', notes: '',
   gstin: '', pan: '', tan: '', cin: '', fssaiLicense: '', drugLicense: '',
   paymentTerms: '', customTerms: '', creditLimit: '', advanceRequired: '',
   tdsApplicable: '', preferredPaymentMode: '', paymentNotes: '',
   agreementType: '', agreementStatus: '', startDate: '', endDate: '',
   agreementLink: '', owner: '', agreementNotes: '',
   salesOwner: '', accountManager: '', leadSource: '', referredBy: '',
   clientStage: '', potentialValue: '', acquisitionDate: '',
  });
  setDocuments([]); setPocs([]); setBanks([]); setProductInterests([]);
  setCurrentStage(0);
  setIsSaving(false);
  onSaved?.();
 };

 const getProgressPercentage = () => ((currentStage + 1) / stages.length) * 100;

 const inputClass = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition";
 const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
 const sectionTitleClass = "text-xs font-bold text-gray-500 tracking-widest uppercase mb-4";

 return (
  <div className="p-6 max-w-5xl mx-auto">
   {/* Header with Progress */}
   <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
    <div className="flex justify-between items-start mb-4">
     <div>
      <h2 className="text-xl font-bold text-gray-800">{currentStage}) {stages[currentStage].title}</h2>
      <p className="text-sm text-gray-500 mt-1">{stages[currentStage].hint}</p>
     </div>
     <div className="flex gap-2">
      <button
       type="button"
       onClick={handlePrevStage}
       disabled={currentStage === 0}
       className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
      >
       ← Prev
      </button>
      <button
       type="button"
       onClick={handleNextStage}
       disabled={currentStage === stages.length - 1}
       className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
      >
       Next →
      </button>
     </div>
    </div>
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
     <div
      className="h-full bg-slate-800 transition-all duration-500"
      style={{ width: `${getProgressPercentage()}%` }}
     />
    </div>
    <div className="flex justify-between mt-2">
     <span className="text-xs text-gray-500">Step {currentStage + 1} of {stages.length}</span>
     <span className="text-xs text-gray-500">{Math.round(getProgressPercentage())}% Complete</span>
    </div>
   </div>

   <form onSubmit={handleSubmit}>
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
     
     {/* Stage 0: Setup & Coding */}
     {currentStage === 0 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Client Setup</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Entity Type</label>
         <select name="setupType" value={formData.setupType} onChange={handleInputChange} className={inputClass}>
          <option value="CLIENT">Client</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Client Category</label>
         <select name="setupCategory" value={formData.setupCategory} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>B2B Brand</option>
          <option>D2C Brand</option>
          <option>Retailer</option>
          <option>Distributor</option>
          <option>Reseller</option>
          <option>White Label</option>
          <option>Private Label</option>
          <option>Institutional</option>
          <option>Export Client</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Legal Name</label>
         <input type="text" name="legalName" value={formData.legalName} onChange={handleInputChange} placeholder="As per GST / PAN / Registration" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Display / Trade Name</label>
         <input type="text" name="tradeName" value={formData.tradeName} onChange={handleInputChange} placeholder="Short name for UI/Zoho" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Primary Email</label>
         <input type="email" name="primaryEmail" value={formData.primaryEmail} onChange={handleInputChange} placeholder="accounts@..." className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Primary Phone</label>
         <input type="tel" name="primaryPhone" value={formData.primaryPhone} onChange={handleInputChange} placeholder="+91..." className={inputClass} />
        </div>
       </div>
       
       <div className={sectionTitleClass}>Code Series</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Series Prefix</label>
         <input type="text" value="CLI" readOnly className={`${inputClass} bg-gray-50`} />
        </div>
        <div>
         <label className={labelClass}>Next Code Preview</label>
         <input type="text" value={formData.entityCode || `EI-CLI-${(parseInt(localStorage.getItem('client_counter') || '0') + 1).toString().padStart(5, '0')}`} readOnly className={`${inputClass} bg-gray-50`} />
        </div>
       </div>
       <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-mono"><b>Vendor:</b> EI-VEN-00001</span>
        <span className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-mono"><b>Client:</b> EI-CLI-00001</span>
       </div>
       <div className="flex gap-2">
        <button type="button" onClick={generateCode} className="px-4 py-2 bg-gray-100 text-amber-900 border border-amber-300 rounded-lg hover:bg-gray-200 transition font-medium text-sm">
         Generate Code
        </button>
        <button type="button" onClick={regenerateCode} className="px-4 py-2 bg-red-100 text-red-800 border border-red-300 rounded-lg hover:bg-red-200 transition font-medium text-sm">
         Regenerate
        </button>
       </div>
      </div>
     )}

     {/* Stage 1: Organization Details */}
     {currentStage === 1 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Organization Details</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Brand Name</label>
         <input type="text" name="brandName" value={formData.brandName} onChange={handleInputChange} placeholder="Client's brand name (if different)" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Business Type</label>
         <select name="businessType" value={formData.businessType} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Proprietorship</option>
          <option>Partnership</option>
          <option>LLP</option>
          <option>Private Limited</option>
          <option>Public Limited</option>
          <option>One Person Company</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Billing Address</label>
         <textarea name="billingAddress" value={formData.billingAddress} onChange={handleInputChange} placeholder="Street, city, state, pin" className={inputClass} rows={3} />
        </div>
        <div>
         <label className={labelClass}>Shipping Address</label>
         <textarea name="shippingAddress" value={formData.shippingAddress} onChange={handleInputChange} placeholder="If different from billing" className={inputClass} rows={3} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>State</label>
         <input type="text" name="state" value={formData.state} onChange={handleInputChange} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Country</label>
         <input type="text" name="country" value={formData.country} onChange={handleInputChange} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Website</label>
         <input type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://..." className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Industry</label>
         <select name="industry" value={formData.industry} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Cosmetics & Skincare</option>
          <option>Haircare</option>
          <option>Personal Care</option>
          <option>Pharma / Nutraceuticals</option>
          <option>FMCG</option>
          <option>Healthcare</option>
          <option>Beauty & Wellness</option>
          <option>Salon / Spa</option>
          <option>E-commerce</option>
          <option>Retail Chain</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Market Segment</label>
         <select name="segment" value={formData.segment} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Mass Market</option>
          <option>Mid-Premium</option>
          <option>Premium</option>
          <option>Luxury</option>
          <option>Professional</option>
          <option>Organic / Natural</option>
          <option>Medical / Clinical</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Notes</label>
         <input type="text" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Any additional notes" className={inputClass} />
        </div>
       </div>
      </div>
     )}

     {/* Stage 2: Tax, Compliance & Documents */}
     {currentStage === 2 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Tax & Compliance</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>GSTIN</label>
         <input type="text" name="gstin" value={formData.gstin} onChange={handleInputChange} placeholder="22AAAAA0000A1Z5" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>PAN</label>
         <input type="text" name="pan" value={formData.pan} onChange={handleInputChange} placeholder="AAAAA0000A" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>TAN</label>
         <input type="text" name="tan" value={formData.tan} onChange={handleInputChange} placeholder="AAAA00000A" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>CIN (if applicable)</label>
         <input type="text" name="cin" value={formData.cin} onChange={handleInputChange} placeholder="Company Identification Number" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>FSSAI License (if applicable)</label>
         <input type="text" name="fssaiLicense" value={formData.fssaiLicense} onChange={handleInputChange} placeholder="For food/nutra products" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Drug License (if applicable)</label>
         <input type="text" name="drugLicense" value={formData.drugLicense} onChange={handleInputChange} placeholder="For cosmetic/pharma" className={inputClass} />
        </div>
       </div>

       <div className={sectionTitleClass}>Document Register</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Doc Type</label>
         <select value={tempDoc.type} onChange={(e) => setTempDoc({...tempDoc, type: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>GST Certificate</option>
          <option>PAN Card</option>
          <option>TAN Certificate</option>
          <option>CIN Certificate</option>
          <option>FSSAI License</option>
          <option>Drug License</option>
          <option>Trade License</option>
          <option>Import-Export Code</option>
          <option>Company Registration</option>
          <option>Agreement / Contract</option>
          <option>NDA</option>
          <option>Purchase Order</option>
          <option>Other</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Doc Link</label>
         <input type="text" value={tempDoc.link} onChange={(e) => setTempDoc({...tempDoc, link: e.target.value})} placeholder="Drive/Share link" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Doc Date</label>
         <input type="date" value={tempDoc.date} onChange={(e) => setTempDoc({...tempDoc, date: e.target.value})} className={inputClass} />
        </div>
        <div className="flex items-end">
         <button type="button" onClick={addDocument} className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition font-medium text-sm">
          + Add Document
         </button>
        </div>
       </div>
       
       {documents.length > 0 && (
        <div className="overflow-x-auto">
         <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
           <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Doc</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Link</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Date</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600"></th>
           </tr>
          </thead>
          <tbody>
           {documents.map((doc, idx) => (
            <tr key={idx} className="border-t border-gray-200">
             <td className="px-4 py-3 text-sm font-medium">{doc.type}</td>
             <td className="px-4 py-3 text-sm text-slate-900 truncate max-w-xs">{doc.link}</td>
             <td className="px-4 py-3 text-sm">{doc.date}</td>
             <td className="px-4 py-3">
              <button type="button" onClick={() => removeDocument(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Del</button>
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       )}
      </div>
     )}

     {/* Stage 3: Multi-level POCs */}
     {currentStage === 3 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Multi-level Points of Contact (POCs)</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>POC Name</label>
         <input type="text" value={tempPoc.name} onChange={(e) => setTempPoc({...tempPoc, name: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Role / Department</label>
         <select value={tempPoc.role} onChange={(e) => setTempPoc({...tempPoc, role: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>Owner / Director</option>
          <option>CEO / MD</option>
          <option>Procurement / Purchase</option>
          <option>Product Development</option>
          <option>R&D</option>
          <option>Marketing</option>
          <option>Finance / Accounts</option>
          <option>Operations</option>
          <option>Quality / QA</option>
          <option>Logistics / Supply Chain</option>
          <option>Admin</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Email</label>
         <input type="email" value={tempPoc.email} onChange={(e) => setTempPoc({...tempPoc, email: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Phone</label>
         <input type="tel" value={tempPoc.phone} onChange={(e) => setTempPoc({...tempPoc, phone: e.target.value})} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Escalation Level</label>
         <select value={tempPoc.level} onChange={(e) => setTempPoc({...tempPoc, level: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>L1 (Primary)</option>
          <option>L2 (Escalation)</option>
          <option>L3 (Management)</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Preferred?</label>
         <select value={tempPoc.preferred} onChange={(e) => setTempPoc({...tempPoc, preferred: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>Yes</option>
          <option>No</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Notes</label>
         <input type="text" value={tempPoc.notes} onChange={(e) => setTempPoc({...tempPoc, notes: e.target.value})} placeholder="Working hours, WhatsApp only, etc." className={inputClass} />
        </div>
        <div>
         <button type="button" onClick={addPOC} className="w-full px-4 py-2.5 bg-slate-800 text-white border border-amber-600 rounded-lg hover:bg-slate-800 transition font-medium text-sm font-semibold">
          + Add POC
         </button>
        </div>
       </div>

       {pocs.length > 0 && (
        <div className="overflow-x-auto">
         <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
           <tr>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">#</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Name</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Role</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Email</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Phone</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Level</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Preferred</th>
            <th className="px-3 py-3"></th>
           </tr>
          </thead>
          <tbody>
           {pocs.map((poc, idx) => (
            <tr key={idx} className="border-t border-gray-200">
             <td className="px-3 py-3 text-sm">{idx + 1}</td>
             <td className="px-3 py-3 text-sm font-medium">{poc.name}</td>
             <td className="px-3 py-3 text-sm">{poc.role}</td>
             <td className="px-3 py-3 text-sm">{poc.email}</td>
             <td className="px-3 py-3 text-sm">{poc.phone}</td>
             <td className="px-3 py-3 text-sm">{poc.level}</td>
             <td className="px-3 py-3 text-sm">{poc.preferred}</td>
             <td className="px-3 py-3">
              <button type="button" onClick={() => removePOC(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Del</button>
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       )}
      </div>
     )}

     {/* Stage 4: Bank Details */}
     {currentStage === 4 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Bank Details (for refunds/payments to client)</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Beneficiary Name</label>
         <input type="text" value={tempBank.beneficiaryName} onChange={(e) => setTempBank({...tempBank, beneficiaryName: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Bank Name</label>
         <input type="text" value={tempBank.bankName} onChange={(e) => setTempBank({...tempBank, bankName: e.target.value})} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Account No.</label>
         <input type="text" value={tempBank.accountNo} onChange={(e) => setTempBank({...tempBank, accountNo: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>IFSC</label>
         <input type="text" value={tempBank.ifsc} onChange={(e) => setTempBank({...tempBank, ifsc: e.target.value})} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Branch</label>
         <input type="text" value={tempBank.branch} onChange={(e) => setTempBank({...tempBank, branch: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Account Type</label>
         <select value={tempBank.accountType} onChange={(e) => setTempBank({...tempBank, accountType: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>Current</option>
          <option>Savings</option>
          <option>OD</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>UPI ID (optional)</label>
         <input type="text" value={tempBank.upiId} onChange={(e) => setTempBank({...tempBank, upiId: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Default?</label>
         <select value={tempBank.isDefault} onChange={(e) => setTempBank({...tempBank, isDefault: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>Yes</option>
          <option>No</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Notes</label>
         <input type="text" value={tempBank.notes} onChange={(e) => setTempBank({...tempBank, notes: e.target.value})} placeholder="Any payment instructions" className={inputClass} />
        </div>
        <div className="flex items-end">
         <button type="button" onClick={addBank} className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition font-medium text-sm">
          + Add Bank
         </button>
        </div>
       </div>

       {banks.length > 0 && (
        <div className="overflow-x-auto">
         <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
           <tr>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">#</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Beneficiary</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Bank</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">A/c</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">IFSC</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Type</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Default</th>
            <th className="px-3 py-3"></th>
           </tr>
          </thead>
          <tbody>
           {banks.map((bank, idx) => (
            <tr key={idx} className="border-t border-gray-200">
             <td className="px-3 py-3 text-sm">{idx + 1}</td>
             <td className="px-3 py-3 text-sm font-medium">{bank.beneficiaryName}</td>
             <td className="px-3 py-3 text-sm">{bank.bankName}</td>
             <td className="px-3 py-3 text-sm font-mono">{bank.accountNo}</td>
             <td className="px-3 py-3 text-sm font-mono">{bank.ifsc}</td>
             <td className="px-3 py-3 text-sm">{bank.accountType}</td>
             <td className="px-3 py-3 text-sm">{bank.isDefault}</td>
             <td className="px-3 py-3">
              <button type="button" onClick={() => removeBank(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Del</button>
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       )}
      </div>
     )}

     {/* Stage 5: Payment Terms & Credit */}
     {currentStage === 5 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Payment Terms & Credit</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Payment Terms</label>
         <select name="paymentTerms" value={formData.paymentTerms} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>100% Advance</option>
          <option>50% Advance + 50% On Delivery</option>
          <option>On Delivery</option>
          <option>Net 7</option>
          <option>Net 15</option>
          <option>Net 30</option>
          <option>Net 45</option>
          <option>Net 60</option>
          <option>Custom</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Custom Terms (if any)</label>
         <input type="text" name="customTerms" value={formData.customTerms} onChange={handleInputChange} placeholder="e.g., 70% advance + 30% on dispatch" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Credit Limit (₹)</label>
         <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleInputChange} placeholder="Maximum outstanding allowed" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Advance Required (%)</label>
         <input type="number" name="advanceRequired" value={formData.advanceRequired} onChange={handleInputChange} placeholder="e.g., 50" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>TDS Applicable?</label>
         <select name="tdsApplicable" value={formData.tdsApplicable} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Yes</option>
          <option>No</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Preferred Payment Mode</label>
         <select name="preferredPaymentMode" value={formData.preferredPaymentMode} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>NEFT/RTGS</option>
          <option>IMPS</option>
          <option>UPI</option>
          <option>Cheque</option>
          <option>DD</option>
          <option>Cash</option>
          <option>Letter of Credit</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div>
        <label className={labelClass}>Internal Payment Notes</label>
        <textarea name="paymentNotes" value={formData.paymentNotes} onChange={handleInputChange} placeholder="Any special payment instructions or history notes" className={inputClass} rows={3} />
       </div>
      </div>
     )}

     {/* Stage 6: Product Interest & Requirements */}
     {currentStage === 6 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Product Interest & Requirements</div>
       <p className="text-sm text-gray-500 mb-4">Track products/services the client is interested in purchasing.</p>
       
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Product Category</label>
         <select value={tempProduct.productCategory} onChange={(e) => setTempProduct({...tempProduct, productCategory: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>Skincare</option>
          <option>Haircare</option>
          <option>Body Care</option>
          <option>Face Care</option>
          <option>Sun Care</option>
          <option>Anti-Aging</option>
          <option>Acne Care</option>
          <option>Men's Grooming</option>
          <option>Baby Care</option>
          <option>Oral Care</option>
          <option>Nutraceuticals</option>
          <option>Wellness</option>
          <option>Professional / Salon</option>
          <option>Private Label</option>
          <option>Contract Manufacturing</option>
          <option>Other</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Product Type</label>
         <input type="text" value={tempProduct.productType} onChange={(e) => setTempProduct({...tempProduct, productType: e.target.value})} placeholder="e.g., Face Serum, Shampoo, Cream" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Expected Volume</label>
         <input type="text" value={tempProduct.expectedVolume} onChange={(e) => setTempProduct({...tempProduct, expectedVolume: e.target.value})} placeholder="e.g., 5000 units/month" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Order Frequency</label>
         <select value={tempProduct.frequency} onChange={(e) => setTempProduct({...tempProduct, frequency: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>One-time</option>
          <option>Weekly</option>
          <option>Bi-weekly</option>
          <option>Monthly</option>
          <option>Quarterly</option>
          <option>As needed</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Target Price Range (₹)</label>
         <input type="text" value={tempProduct.targetPrice} onChange={(e) => setTempProduct({...tempProduct, targetPrice: e.target.value})} placeholder="e.g., 150-200 per unit" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Priority</label>
         <select value={tempProduct.priority} onChange={(e) => setTempProduct({...tempProduct, priority: e.target.value})} className={inputClass}>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Specifications / Requirements</label>
         <input type="text" value={tempProduct.specifications} onChange={(e) => setTempProduct({...tempProduct, specifications: e.target.value})} placeholder="Any specific requirements" className={inputClass} />
        </div>
        <div className="flex items-end">
         <button type="button" onClick={addProductInterest} className="w-full px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition font-medium text-sm">
          + Add Product Interest
         </button>
        </div>
       </div>

       {productInterests.length > 0 && (
        <div className="overflow-x-auto">
         <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
           <tr>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">#</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Category</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Type</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Volume</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Frequency</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Price</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Priority</th>
            <th className="px-2 py-3"></th>
           </tr>
          </thead>
          <tbody>
           {productInterests.map((product, idx) => (
            <tr key={idx} className="border-t border-gray-200">
             <td className="px-2 py-3 text-sm">{idx + 1}</td>
             <td className="px-2 py-3 text-sm">{product.productCategory}</td>
             <td className="px-2 py-3 text-sm font-medium">{product.productType}</td>
             <td className="px-2 py-3 text-sm">{product.expectedVolume}</td>
             <td className="px-2 py-3 text-sm">{product.frequency}</td>
             <td className="px-2 py-3 text-sm">{product.targetPrice}</td>
             <td className="px-2 py-3 text-sm">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
               product.priority === 'High' ? 'bg-red-100 text-red-700' :
               product.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
               'bg-green-100 text-green-700'
              }`}>{product.priority}</span>
             </td>
             <td className="px-2 py-3">
              <button type="button" onClick={() => removeProductInterest(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Del</button>
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       )}
      </div>
     )}

     {/* Stage 7: Agreements & Client Status */}
     {currentStage === 7 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Agreements</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Agreement Type</label>
         <select name="agreementType" value={formData.agreementType} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>NDA</option>
          <option>Master Service Agreement (MSA)</option>
          <option>Supply Agreement</option>
          <option>Manufacturing Agreement</option>
          <option>Distribution Agreement</option>
          <option>Quality Agreement</option>
          <option>Rate Contract</option>
          <option>MoU</option>
          <option>Other</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Agreement Status</label>
         <select name="agreementStatus" value={formData.agreementStatus} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Not Started</option>
          <option>In Discussion</option>
          <option>Draft Shared</option>
          <option>Under Review</option>
          <option>Sent for Signature</option>
          <option>Signed</option>
          <option>Expired</option>
          <option>Terminated</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Start Date</label>
         <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>End / Renewal Date</label>
         <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Agreement Link</label>
         <input type="text" name="agreementLink" value={formData.agreementLink} onChange={handleInputChange} placeholder="Drive/Portal link" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Agreement Owner (internal)</label>
         <input type="text" name="owner" value={formData.owner} onChange={handleInputChange} placeholder="BD / Legal / Finance" className={inputClass} />
        </div>
       </div>
       <div>
        <label className={labelClass}>Agreement Notes</label>
        <textarea name="agreementNotes" value={formData.agreementNotes} onChange={handleInputChange} className={inputClass} rows={2} />
       </div>

       <div className={sectionTitleClass}>Client Lifecycle & Ownership</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Sales Owner</label>
         <input type="text" name="salesOwner" value={formData.salesOwner} onChange={handleInputChange} placeholder="Sales rep name" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Account Manager</label>
         <input type="text" name="accountManager" value={formData.accountManager} onChange={handleInputChange} placeholder="Post-sale account manager" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Lead Source</label>
         <select name="leadSource" value={formData.leadSource} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Website Enquiry</option>
          <option>IndiaMart</option>
          <option>TradeIndia</option>
          <option>LinkedIn</option>
          <option>Referral</option>
          <option>Exhibition / Trade Show</option>
          <option>Cold Call</option>
          <option>Email Campaign</option>
          <option>Social Media</option>
          <option>Direct Walk-in</option>
          <option>Other</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Referred By</label>
         <input type="text" name="referredBy" value={formData.referredBy} onChange={handleInputChange} placeholder="Name of referrer (if any)" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Client Stage</label>
         <select name="clientStage" value={formData.clientStage} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Lead</option>
          <option>Qualified Lead</option>
          <option>Prospect</option>
          <option>Negotiation</option>
          <option>Won - New Client</option>
          <option>Active Client</option>
          <option>Repeat Client</option>
          <option>VIP / Key Account</option>
          <option>Dormant</option>
          <option>Churned</option>
          <option>Lost</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Potential Value (₹)</label>
         <input type="number" name="potentialValue" value={formData.potentialValue} onChange={handleInputChange} placeholder="Estimated annual value" className={inputClass} />
        </div>
       </div>
       <div>
        <label className={labelClass}>Client Acquisition Date</label>
        <input type="date" name="acquisitionDate" value={formData.acquisitionDate} onChange={handleInputChange} className={inputClass} />
       </div>
      </div>
     )}

    </div>

    {/* Bottom Navigation */}
    <div className="flex justify-between items-center mt-6">
     <button
      type="button"
      onClick={handlePrevStage}
      disabled={currentStage === 0}
      className="px-6 py-2.5 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
     >
      ← Previous
     </button>
     <div className="flex gap-3">
      {currentStage === stages.length - 1 ? (
       <button
        type="submit"
        disabled={isSaving}
        className="px-8 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-lg"
       >
        {isSaving ? 'Saving...' : 'Submit Client'}
       </button>
      ) : (
       <button
        type="button"
        onClick={handleNextStage}
        className="px-8 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition font-medium shadow-lg"
       >
        Next →
       </button>
      )}
     </div>
    </div>
   </form>
  </div>
 );
};

export default ClientForm;
