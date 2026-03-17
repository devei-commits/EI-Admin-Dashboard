import React, { useEffect, useMemo, useState } from 'react';
import { useVendorClient } from '../context/VendorClientContext';
import { useToast } from '../context/ToastContext';
import { fetchVendorClientById, createVendorClient, updateVendorClient as updateVendorClientApi, fetchNextCode } from '../services/vendorClient.service';

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

interface VendorItem {
 itemType: string;
 itemCode: string;
 itemName: string;
 uom: string;
 moq: string;
 unitPrice: string;
 leadTime: string;
 priceValidTill: string;
 gst: string;
 hsn: string;
 paymentTermsOverride: string;
}

interface VendorFormData {
 setupType: 'VENDOR' | 'CLIENT';
 setupCategory: string;
  setupPrefix: string;
  entityCode: string;
  zohoId: string;
  legalName: string;
  tradeName: string;
 primaryEmail: string;
 primaryPhone: string;
 billingAddress: string;
 shippingAddress: string;
 state: string;
 country: string;
 website: string;
 segment: string;
 notes: string;
 gstin: string;
 pan: string;
 msme: string;
 iec: string;
 paymentTerms: string;
 customTerms: string;
 creditLimit: string;
 penalty: string;
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
}

type VendorFormProps = {
 editingId?: string | null;
 onSaved?: () => void;
};

const VendorForm: React.FC<VendorFormProps> = ({ editingId = null, onSaved }) => {
 const { vendorClients } = useVendorClient();
 const { addToast } = useToast();
 const [currentStage, setCurrentStage] = useState(0);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [isSaving, setIsSaving] = useState(false);
 const [fetchedRecord, setFetchedRecord] = useState<Record<string, unknown> | null>(null);

 const existingVendor = useMemo(() => {
  if (!editingId) return null;
  const fromContext = vendorClients.find(v => v.id === editingId && v.type === 'vendor');
  if (fromContext) return fromContext;
  if (fetchedRecord && (fetchedRecord as { type?: string }).type === 'vendor') return fetchedRecord as any;
  return null;
 }, [editingId, vendorClients, fetchedRecord]);

 useEffect(() => {
  if (!editingId) { setFetchedRecord(null); return; }
  if (vendorClients.some(v => v.id === editingId && v.type === 'vendor')) { setFetchedRecord(null); return; }
  let cancelled = false;
  fetchVendorClientById(editingId).then((res) => {
   if (!cancelled && res.success && res.data) setFetchedRecord(res.data as unknown as Record<string, unknown>);
  });
  return () => { cancelled = true; };
 }, [editingId, vendorClients]);

 const [documents, setDocuments] = useState<Document[]>([]);
 const [pocs, setPocs] = useState<POC[]>([]);
 const [banks, setBanks] = useState<BankDetail[]>([]);
 const [vendorItems, setVendorItems] = useState<VendorItem[]>([]);

 const [tempDoc, setTempDoc] = useState({ type: '', link: '', date: '' });
 const [tempPoc, setTempPoc] = useState({ name: '', role: '', email: '', phone: '', level: '', preferred: '', notes: '' });
 const [tempBank, setTempBank] = useState({ beneficiaryName: '', bankName: '', accountNo: '', ifsc: '', branch: '', accountType: '', upiId: '', isDefault: '', notes: '' });
 const [tempItem, setTempItem] = useState({ itemType: '', itemCode: '', itemName: '', uom: 'KG', moq: '', unitPrice: '', leadTime: '', priceValidTill: '', gst: '', hsn: '', paymentTermsOverride: '' });

 const [formData, setFormData] = useState<VendorFormData>({
  setupType: 'VENDOR',
  setupCategory: '',
  setupPrefix: 'VEN',
  entityCode: '',
  zohoId: '',
  legalName: '',
  tradeName: '',
  primaryEmail: '',
  primaryPhone: '',
  billingAddress: '',
  shippingAddress: '',
  state: '',
  country: 'India',
  website: '',
  segment: '',
  notes: '',
  gstin: '',
  pan: '',
  msme: '',
  iec: '',
  paymentTerms: '',
  customTerms: '',
  creditLimit: '',
  penalty: '',
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
 });

 const stages = [
  { title: 'Setup & Coding', hint: 'Pick entity type and generate code series.' },
  { title: 'Organization Details', hint: 'Addresses, website, segment and notes.' },
  { title: 'Tax, Compliance & Documents', hint: 'GST/PAN + document register.' },
  { title: 'Multi-level POCs', hint: 'Multiple contacts with escalation levels and departments.' },
  { title: 'Bank Details', hint: 'Multiple bank accounts + default account.' },
  { title: 'Payment Terms & Credit', hint: 'Terms, credit limit, TDS, payment mode.' },
  { title: 'Vendor Items & Price List', hint: 'Map vendor items and negotiated prices.' },
  { title: 'Agreements & Status', hint: 'NDA/MSA/Rate Contract status and links.' },
 ];

 const draftKey = useMemo(() => {
  return editingId ? `vendor_form_draft_${editingId}` : 'vendor_form_draft';
 }, [editingId]);

 useEffect(() => {
  if (existingVendor) {
   const data = (existingVendor.data || {}) as any;
     const entityCode =
        data.entityCode ||
        data.customerNumber ||
        data.cfContactId ||
        data.contactId ||
        existingVendor.id;

     const baseFormData = {
        legalName: data.legalName || existingVendor.name,
        tradeName: data.tradeName || existingVendor.name,
        primaryEmail: data.primaryEmail || existingVendor.email,
        primaryPhone: data.primaryPhone || existingVendor.phone,
        state: data.state || existingVendor.location,
        country: data.country || existingVendor.country,
        setupCategory: data.setupCategory || existingVendor.category,
        paymentTerms: data.paymentTerms || existingVendor.paymentTerms,
        notes: data.notes || existingVendor.notes,
        entityCode: String(entityCode || ''),
        zohoId: data.zohoId ?? (existingVendor as { zohoId?: string }).zohoId ?? '',
     };

     setFormData(prev => ({
        ...prev,
        ...baseFormData,
        ...(data as any),
        setupType: 'VENDOR',
        setupPrefix: 'VEN',
     }));
   setDocuments(Array.isArray(data.documents) ? data.documents : []);
   setPocs(Array.isArray(data.pocs) ? data.pocs : []);
   setBanks(Array.isArray(data.banks) ? data.banks : []);
   setVendorItems(Array.isArray(data.vendorItems) ? data.vendorItems : []);
   setCurrentStage(0);
   return;
  }
 }, [existingVendor]);

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

 const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
   return (error as { message: string }).message;
  }
  return fallback;
 };

 const generateCode = async () => {
  const res = await fetchNextCode('vendor');
  if (res.success && res.data) {
   setFormData(prev => ({ ...prev, entityCode: res.data }));
   addToast('success', `Entity code generated: ${res.data}`);
  } else {
    addToast('error', getErrorMessage(res.error, 'Failed to generate code'));
  }
 };

 const regenerateCode = async () => {
  const res = await fetchNextCode('vendor');
  if (res.success && res.data) {
   setFormData(prev => ({ ...prev, entityCode: res.data }));
   addToast('success', `Entity code regenerated: ${res.data}`);
  } else {
    addToast('error', getErrorMessage(res.error, 'Failed to generate code'));
  }
 };

 const handleFillMockValues = async () => {
  const res = await fetchNextCode('vendor');
  const code = res.success && res.data ? res.data : `EI-VEN-${Date.now().toString(36).toUpperCase()}`;
  setFormData(prev => ({
   ...prev,
   entityCode: code,
   legalName: 'Mock Vendor Ltd',
   tradeName: 'Mock Vendor',
   primaryEmail: 'vendor@mock.com',
   primaryPhone: '+91-9876543210',
   billingAddress: '123 Mock Street, Industrial Area',
   shippingAddress: '123 Mock Street, Industrial Area',
   state: 'Maharashtra',
   country: 'India',
   website: 'https://mock-vendor.example.com',
   segment: 'RAW MATERIAL',
   notes: 'Mock data for testing',
   gstin: '27AABCM1234A1Z1',
   pan: 'AABCM1234A',
   paymentTerms: '30',
  }));
  setDocuments([{ type: 'GST Certificate', link: 'https://example.com/doc', date: new Date().toISOString().slice(0, 10) }]);
  setPocs([{ name: 'John Doe', role: 'Manager', email: 'john@mock.com', phone: '+91-9876543210', level: 'Primary', preferred: 'Email', notes: '' }]);
  setBanks([]);
  setVendorItems([]);
  addToast('success', 'Mock values filled. Edit as needed and submit.');
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

 const addVendorItem = () => {
  if (!tempItem.itemType || !tempItem.itemName) { addToast('error', 'Item type and name are required'); return; }
  setVendorItems([...vendorItems, tempItem]);
  setTempItem({ itemType: '', itemCode: '', itemName: '', uom: 'KG', moq: '', unitPrice: '', leadTime: '', priceValidTill: '', gst: '', hsn: '', paymentTermsOverride: '' });
  addToast('success', 'Vendor item added');
 };

 const removeVendorItem = (index: number) => {
  setVendorItems(vendorItems.filter((_, i) => i !== index));
  addToast('success', 'Vendor item removed');
 };

 const handleSubmit = async (e: React.FormEvent) => {
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
   data: { ...formData, documents, pocs, banks, vendorItems },
  };

  if (editingId && existingVendor) {
   const res = await updateVendorClientApi(editingId, {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    location: payload.location,
    country: payload.country,
    category: payload.category,
    paymentTerms: payload.paymentTerms,
    notes: payload.notes,
    zohoId: formData.zohoId || undefined,
    data: payload.data as Record<string, unknown>,
   });
   if (res.success) {
    addToast('success', 'Vendor updated successfully!');
    setIsSaving(false);
    onSaved?.();
    return;
   }
   addToast('error', getErrorMessage(res.error, 'Failed to update vendor'));
   setIsSaving(false);
   return;
  }

  const res = await createVendorClient({
   type: 'vendor',
   entityCode: formData.entityCode || '',
   zohoId: formData.zohoId || undefined,
   name: payload.name,
   email: payload.email,
   phone: payload.phone,
   location: payload.location,
   country: payload.country,
   category: payload.category,
   status: 'pending',
   paymentTerms: payload.paymentTerms,
   notes: payload.notes,
   data: payload.data as Record<string, unknown>,
  });

  if (res.success) {
   addToast('success', 'Vendor created successfully!');
   setFormData({
    setupType: 'VENDOR', setupCategory: '', setupPrefix: 'VEN', entityCode: '', zohoId: '',
    legalName: '', tradeName: '', primaryEmail: '', primaryPhone: '',
    billingAddress: '', shippingAddress: '', state: '', country: 'India',
    website: '', segment: '', notes: '', gstin: '', pan: '', msme: '', iec: '',
    paymentTerms: '', customTerms: '', creditLimit: '', penalty: '',
    tdsApplicable: '', preferredPaymentMode: '', paymentNotes: '',
    agreementType: '', agreementStatus: '', startDate: '', endDate: '',
    agreementLink: '', owner: '', agreementNotes: '',
   });
   setDocuments([]); setPocs([]); setBanks([]); setVendorItems([]);
   setCurrentStage(0);
   setIsSaving(false);
   onSaved?.();
   return;
  }
   addToast('error', getErrorMessage(res.error, 'Failed to create vendor'));
  setIsSaving(false);
 };

 const getProgressPercentage = () => ((currentStage + 1) / stages.length) * 100;

 const inputClass = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition";
 const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
 const sectionTitleClass = "text-xs font-bold text-gray-500 tracking-widest uppercase mb-4";

 return (
  <div className="p-6 w-full">
   {/* Header with Progress */}
   <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
    <div className="flex justify-between items-start mb-4">
     <div>
      <h2 className="text-xl font-bold text-gray-800">{currentStage}) {stages[currentStage].title}</h2>
      <p className="text-sm text-gray-500 mt-1">{stages[currentStage].hint}</p>
     </div>
     <div className="flex gap-2 flex-wrap">
      {!editingId && (
       <button
        type="button"
        onClick={handleFillMockValues}
        className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 transition font-medium text-sm"
       >
        Fill mock values
       </button>
      )}
      <button
       type="button"
       onClick={handlePrevStage}
       disabled={currentStage === 0}
       className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
      >
       Prev
      </button>
      <button
       type="button"
       onClick={handleNextStage}
       disabled={currentStage === stages.length - 1}
       className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
      >
       Next
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
       <div className={sectionTitleClass}>Entity Setup</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Entity Type</label>
         <select name="setupType" value={formData.setupType} onChange={handleInputChange} className={inputClass}>
          <option value="VENDOR">Vendor</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Category</label>
         <select name="setupCategory" value={formData.setupCategory} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>RM Vendor</option>
          <option>PM Vendor</option>
          <option>Lab / Testing</option>
          <option>Logistics</option>
          <option>Consultant</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Legal Name</label>
         <input type="text" name="legalName" value={formData.legalName} onChange={handleInputChange} placeholder="As per GST / PAN" className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Display / Trade Name</label>
         <input type="text" name="tradeName" value={formData.tradeName} onChange={handleInputChange} placeholder="Short name for UI/Zoho" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Zoho ID</label>
         <input type="text" name="zohoId" value={formData.zohoId} onChange={handleInputChange} placeholder="Zoho contact/org id (for sync)" className={inputClass} />
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
         <input type="text" value="VEN" readOnly className={`${inputClass} bg-gray-50`} />
        </div>
        <div>
         <label className={labelClass}>Next Code Preview</label>
         <input type="text" value={formData.entityCode || '— Generate to get code —'} readOnly className={`${inputClass} bg-gray-50`} />
        </div>
       </div>
       <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-mono"><b>Vendor:</b> EI-VEN-00001</span>
        <span className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-mono"><b>Client:</b> EI-CLI-00001</span>
       </div>
       <div className="flex gap-2">
        <button type="button" onClick={generateCode} className="px-4 py-2 bg-green-100 text-green-800 border border-green-300 rounded-lg hover:bg-green-200 transition font-medium text-sm">
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
         <label className={labelClass}>Billing Address</label>
         <textarea name="billingAddress" value={formData.billingAddress} onChange={handleInputChange} placeholder="Street, city, state, pin" className={inputClass} rows={3} />
        </div>
        <div>
         <label className={labelClass}>Shipping Address</label>
         <textarea name="shippingAddress" value={formData.shippingAddress} onChange={handleInputChange} placeholder="If different" className={inputClass} rows={3} />
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
         <label className={labelClass}>Industry / Segment</label>
         <input type="text" name="segment" value={formData.segment} onChange={handleInputChange} placeholder="Cosmetics, Pharma, Packaging, etc." className={inputClass} />
        </div>
       </div>
       <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleInputChange} className={inputClass} rows={3} />
       </div>
      </div>
     )}

     {/* Stage 2: Tax, Compliance & Documents */}
     {currentStage === 2 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Tax, Compliance & Documents</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>GSTIN</label>
         <input type="text" name="gstin" value={formData.gstin} onChange={handleInputChange} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>PAN</label>
         <input type="text" name="pan" value={formData.pan} onChange={handleInputChange} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>MSME (if any)</label>
         <input type="text" name="msme" value={formData.msme} onChange={handleInputChange} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>IEC (if import/export)</label>
         <input type="text" name="iec" value={formData.iec} onChange={handleInputChange} className={inputClass} />
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
          <option>Cancelled Cheque</option>
          <option>MSME Certificate</option>
          <option>IEC Certificate</option>
          <option>Agreement / Contract</option>
          <option>NDA</option>
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
          <option>Sales</option>
          <option>Accounts</option>
          <option>Procurement</option>
          <option>Quality / QA</option>
          <option>Operations</option>
          <option>Logistics</option>
          <option>Client Success</option>
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
         <button type="button" onClick={addPOC} className="w-full px-4 py-2.5 bg-slate-800 text-white border border-amber-600 rounded-lg hover:bg-slate-800 transition font-semibold text-sm">
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
       <div className={sectionTitleClass}>Bank Details</div>
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
         <input type="text" value={tempBank.notes} onChange={(e) => setTempBank({...tempBank, notes: e.target.value})} placeholder="Any payment restrictions" className={inputClass} />
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
          <option>Advance</option>
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
         <input type="text" name="customTerms" value={formData.customTerms} onChange={handleInputChange} placeholder="e.g., 50% advance + 50% on delivery" className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Credit Limit (₹)</label>
         <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleInputChange} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Interest / Penalty (if applicable)</label>
         <input type="text" name="penalty" value={formData.penalty} onChange={handleInputChange} placeholder="e.g., 2% per month" className={inputClass} />
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
          <option>Cheque</option>
          <option>UPI</option>
          <option>Other</option>
         </select>
        </div>
       </div>
       <div>
        <label className={labelClass}>Internal Notes</label>
        <textarea name="paymentNotes" value={formData.paymentNotes} onChange={handleInputChange} className={inputClass} rows={3} />
       </div>
      </div>
     )}

     {/* Stage 6: Vendor Items & Price List */}
     {currentStage === 6 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Vendor Items & Price List (Vendor Only)</div>
       <p className="text-sm text-gray-500 mb-4">This section is visible only for Vendor master.</p>
       
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Item Type</label>
         <select value={tempItem.itemType} onChange={(e) => setTempItem({...tempItem, itemType: e.target.value})} className={inputClass}>
          <option value="">Select</option>
          <option>RM</option>
          <option>PM</option>
          <option>Service</option>
          <option>Other</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Item Code</label>
         <input type="text" value={tempItem.itemCode} onChange={(e) => setTempItem({...tempItem, itemCode: e.target.value})} placeholder="EI-RM-... / EI-PM-..." className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Item Name</label>
         <input type="text" value={tempItem.itemName} onChange={(e) => setTempItem({...tempItem, itemName: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>UoM</label>
         <select value={tempItem.uom} onChange={(e) => setTempItem({...tempItem, uom: e.target.value})} className={inputClass}>
          <option>KG</option>
          <option>GM</option>
          <option>L</option>
          <option>ML</option>
          <option>PCS</option>
          <option>SET</option>
          <option>PACK</option>
         </select>
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>MOQ</label>
         <input type="number" value={tempItem.moq} onChange={(e) => setTempItem({...tempItem, moq: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Unit Price (₹)</label>
         <input type="number" value={tempItem.unitPrice} onChange={(e) => setTempItem({...tempItem, unitPrice: e.target.value})} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Lead Time (days)</label>
         <input type="number" value={tempItem.leadTime} onChange={(e) => setTempItem({...tempItem, leadTime: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>Price Valid Till</label>
         <input type="date" value={tempItem.priceValidTill} onChange={(e) => setTempItem({...tempItem, priceValidTill: e.target.value})} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Tax (GST %)</label>
         <input type="number" value={tempItem.gst} onChange={(e) => setTempItem({...tempItem, gst: e.target.value})} className={inputClass} />
        </div>
        <div>
         <label className={labelClass}>HSN/SAC</label>
         <input type="text" value={tempItem.hsn} onChange={(e) => setTempItem({...tempItem, hsn: e.target.value})} className={inputClass} />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Payment Terms Override (optional)</label>
         <input type="text" value={tempItem.paymentTermsOverride} onChange={(e) => setTempItem({...tempItem, paymentTermsOverride: e.target.value})} placeholder="If different from vendor terms" className={inputClass} />
        </div>
        <div className="flex items-end">
         <button type="button" onClick={addVendorItem} className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium text-sm">
          + Add Line
         </button>
        </div>
       </div>

       {vendorItems.length > 0 && (
        <div className="overflow-x-auto">
         <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
           <tr>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">#</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Type</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Item Code</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Name</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">UoM</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">MOQ</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Price</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">LT</th>
            <th className="px-2 py-3 text-left text-xs font-bold text-gray-600">Valid</th>
            <th className="px-2 py-3"></th>
           </tr>
          </thead>
          <tbody>
           {vendorItems.map((item, idx) => (
            <tr key={idx} className="border-t border-gray-200">
             <td className="px-2 py-3 text-sm">{idx + 1}</td>
             <td className="px-2 py-3 text-sm">{item.itemType}</td>
             <td className="px-2 py-3 text-sm font-mono">{item.itemCode}</td>
             <td className="px-2 py-3 text-sm">{item.itemName}</td>
             <td className="px-2 py-3 text-sm">{item.uom}</td>
             <td className="px-2 py-3 text-sm font-mono">{item.moq}</td>
             <td className="px-2 py-3 text-sm font-mono">{item.unitPrice}</td>
             <td className="px-2 py-3 text-sm font-mono">{item.leadTime}</td>
             <td className="px-2 py-3 text-sm">{item.priceValidTill}</td>
             <td className="px-2 py-3">
              <button type="button" onClick={() => removeVendorItem(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Del</button>
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       )}
      </div>
     )}

     {/* Stage 7: Agreements & Status */}
     {currentStage === 7 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Agreements & Status</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Agreement Type</label>
         <select name="agreementType" value={formData.agreementType} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>NDA</option>
          <option>Master Service Agreement (MSA)</option>
          <option>Supply Agreement</option>
          <option>Quality Agreement</option>
          <option>Rate Contract</option>
          <option>Other</option>
         </select>
        </div>
        <div>
         <label className={labelClass}>Status</label>
         <select name="agreementStatus" value={formData.agreementStatus} onChange={handleInputChange} className={inputClass}>
          <option value="">Select</option>
          <option>Not Started</option>
          <option>In Discussion</option>
          <option>Sent for Signature</option>
          <option>Signed</option>
          <option>Expired</option>
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
         <label className={labelClass}>Owner (internal)</label>
         <input type="text" name="owner" value={formData.owner} onChange={handleInputChange} placeholder="BD / Finance / Legal" className={inputClass} />
        </div>
       </div>
       <div>
        <label className={labelClass}>Agreement Notes</label>
        <textarea name="agreementNotes" value={formData.agreementNotes} onChange={handleInputChange} className={inputClass} rows={3} />
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
      Previous
     </button>
     <div className="flex gap-3">
      {currentStage === stages.length - 1 ? (
       <button
        type="submit"
        disabled={isSaving}
        className="px-8 py-2.5 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-lg"
       >
        {isSaving ? 'Saving...' : 'Submit Vendor'}
       </button>
      ) : (
       <button
        type="button"
        onClick={handleNextStage}
        className="px-8 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition font-medium shadow-lg"
       >
        Next
       </button>
      )}
     </div>
    </div>
   </form>
  </div>
 );
};

export default VendorForm;
