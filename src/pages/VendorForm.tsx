import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { fetchVendorClientById, createVendorClient, updateVendorClient as updateVendorClientApi, type VendorClientRecord } from '../services/vendorClient.service';
import { MasterSaveSuccessModal, type MasterSaveSuccessRow } from '../components/masters/MasterSaveSuccessModal';
import { fetchRawMaterialsList, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsList, type PackMaterialRecord } from '../services/packMaterials.service';

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

type ItemCodeSuggestion =
 | { kind: 'RM'; code: string; name: string; uom: string; gst?: number; hsn?: string | null }
 | { kind: 'PM'; code: string; name: string; uom: string; gst?: number; hsn?: string | null };

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
  /**
   * Payment split percentages.
   * Must add up to 100% (Advanced + Before dispatch + After dispatch/on delivery).
   */
  paymentCreditType: string;
  payablesAdvancedPct: string;
  payablesBeforeDispatchPct: string;
  payablesAfterDispatchPct: string;
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
 linkedUserId: string;
}

type VendorFormProps = {
 editingId?: string | null;
 onSaved?: () => void;
};

/** Simple email format check (HTML5-style). */
function isValidEmail(s: string): boolean {
 const t = s.trim();
 if (!t) return false;
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** Phone: require enough digits (10–15), allow +, spaces, hyphens. */
function isValidPhone(s: string): boolean {
 const d = String(s || '').replace(/\D/g, '');
 return d.length >= 10 && d.length <= 15;
}

/** Indian GSTIN when provided (15 chars, basic pattern). */
function isValidGstin(s: string): boolean {
 const t = s.trim().toUpperCase();
 if (!t) return true;
 return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(t);
}

/** PAN when provided (10 chars). */
function isValidPan(s: string): boolean {
 const t = s.trim().toUpperCase();
 if (!t) return true;
 return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(t);
}

function paymentSplitParts(fd: VendorFormData): { adv: number; before: number; after: number; sum: number } {
 const adv = Number(String(fd.payablesAdvancedPct ?? '').trim()) || 0;
 const before = Number(String(fd.payablesBeforeDispatchPct ?? '').trim()) || 0;
 const after = Number(String(fd.payablesAfterDispatchPct ?? '').trim()) || 0;
 return { adv, before, after, sum: adv + before + after };
}

function isValidOptionalUrl(s: string): boolean {
 const t = s.trim();
 if (!t) return true;
 try {
  const u = new URL(t.includes('://') ? t : `https://${t}`);
  return u.protocol === 'http:' || u.protocol === 'https:';
 } catch {
  return false;
 }
}

/** When shipping is left blank, treat it as the same as billing for save/sync. */
function resolveShippingAddress(fd: VendorFormData): string {
 const b = String(fd.billingAddress ?? '').trim();
 const s = String(fd.shippingAddress ?? '').trim();
 return s || b;
}

const FIELD_ERROR_STAGE: Record<string, number> = {
 setupCategory: 0,
 legalName: 0,
 tradeName: 0,
 primaryEmail: 0,
 primaryPhone: 0,
 billingAddress: 1,
 shippingAddress: 1,
 state: 1,
 country: 1,
 gstin: 2,
 pan: 2,
 website: 2,
 paymentCreditType: 5,
 paymentSplit: 5,
};

/** Full form validation for create/update submit (all required fields + formats). */
function validateVendorForm(fd: VendorFormData, options: { isNewVendor: boolean }): { errors: Record<string, string>; firstErrorStage: number } {
 const newErrors: Record<string, string> = {};
 const MIN_ADDR = 5;

 if (!fd.setupCategory.trim()) newErrors.setupCategory = 'Category is required';
 if (!fd.legalName.trim()) newErrors.legalName = 'Legal name is required';
 if (!fd.tradeName.trim()) newErrors.tradeName = 'Trade name is required';
 if (!fd.primaryEmail.trim()) newErrors.primaryEmail = 'Primary email is required';
 else if (!isValidEmail(fd.primaryEmail)) newErrors.primaryEmail = 'Enter a valid email address';
 if (!fd.primaryPhone.trim()) newErrors.primaryPhone = 'Primary phone is required';
 else if (!isValidPhone(fd.primaryPhone)) newErrors.primaryPhone = 'Enter a valid phone number (10–15 digits)';

 if (!fd.billingAddress.trim() || fd.billingAddress.trim().length < MIN_ADDR) {
  newErrors.billingAddress = `Billing address is required (at least ${MIN_ADDR} characters)`;
 }
 const shipOnly = fd.shippingAddress.trim();
 if (shipOnly && shipOnly.length < MIN_ADDR) {
  newErrors.shippingAddress = `If provided, shipping address must be at least ${MIN_ADDR} characters (or leave blank to use billing)`;
 }
 if (!fd.state.trim() || fd.state.trim().length < 2) newErrors.state = 'State is required';
 if (!fd.country.trim() || fd.country.trim().length < 2) newErrors.country = 'Country is required';

 if (fd.gstin.trim() && !isValidGstin(fd.gstin)) newErrors.gstin = 'Invalid GSTIN format (15 characters, e.g. 27AABCU9603R1ZM)';
 if (fd.pan.trim() && !isValidPan(fd.pan)) newErrors.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
 if (fd.website.trim() && !isValidOptionalUrl(fd.website)) newErrors.website = 'Enter a valid website URL';

 if (!String(fd.paymentCreditType ?? '').trim()) {
  newErrors.paymentCreditType = 'Credit type is required';
 }
 const { sum } = paymentSplitParts(fd);
 if (Math.abs(sum - 100) > 0.001) {
  newErrors.paymentSplit = 'Advance + Before dispatch + After delivery must total exactly 100%';
 }

 let firstErrorStage = 999;
 for (const k of Object.keys(newErrors)) {
  firstErrorStage = Math.min(firstErrorStage, FIELD_ERROR_STAGE[k] ?? 5);
 }
 if (Object.keys(newErrors).length === 0) firstErrorStage = 0;

 return { errors: newErrors, firstErrorStage };
}

/** Payment split + credit type only (e.g. saving price list from edit). */
function validatePaymentTermsOnly(fd: VendorFormData): { errors: Record<string, string> } {
 const errors: Record<string, string> = {};
 if (!String(fd.paymentCreditType ?? '').trim()) {
  errors.paymentCreditType = 'Credit type is required';
 }
 const { sum } = paymentSplitParts(fd);
 if (Math.abs(sum - 100) > 0.001) {
  errors.paymentSplit = 'Advance + Before dispatch + After delivery must total exactly 100%';
 }
 return { errors };
}

const VendorForm: React.FC<VendorFormProps> = ({ editingId = null, onSaved }) => {
 const queryClient = useQueryClient();
 const { addToast } = useToast();
 const [currentStage, setCurrentStage] = useState(0);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [isSaving, setIsSaving] = useState(false);
 const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
 const [saveSuccessCode, setSaveSuccessCode] = useState('');
 const [saveSuccessRows, setSaveSuccessRows] = useState<MasterSaveSuccessRow[]>([]);
 const [saveSuccessZohoNote, setSaveSuccessZohoNote] = useState<string | null>(null);
 const [savingPriceList, setSavingPriceList] = useState(false);
 const [fetchedRecord, setFetchedRecord] = useState<Record<string, unknown> | null>(null);

 useEffect(() => {
  if (!editingId) {
   setFetchedRecord(null);
   return;
  }
  let cancelled = false;
  fetchVendorClientById(editingId).then((res) => {
   if (!cancelled && res.success && res.data) setFetchedRecord(res.data as unknown as Record<string, unknown>);
  });
  return () => {
   cancelled = true;
  };
 }, [editingId]);

 /** When opening/closing edit (or switching vendor), reset wizard state so we don't mix sessions. */
 useEffect(() => {
  setVendorItems([]);
  setCurrentStage(0);
 }, [editingId]);

 /** Hydrate edit form once per GET response — never use list/context rows here (they can omit data.vendorItems). */
 const hydratedFetchKeyRef = useRef<string>('');
 useEffect(() => {
  if (!editingId) {
   hydratedFetchKeyRef.current = '';
   return;
  }
  if (!fetchedRecord || (fetchedRecord as { type?: string }).type !== 'vendor') return;

  const lastMod = String((fetchedRecord as { lastModified?: string }).lastModified ?? '');
  const fetchKey = `${editingId}:${lastMod}`;
  if (hydratedFetchKeyRef.current === fetchKey) return;
  hydratedFetchKeyRef.current = fetchKey;

  const v = fetchedRecord as Record<string, unknown>;
  const data = (v.data || {}) as Record<string, any>;

  const entityCode =
   data.entityCode ||
   data.customerNumber ||
   data.cfContactId ||
   data.contactId ||
   v.id;

  const termsStr = String(data.paymentTerms ?? v.paymentTerms ?? '');
  const isAdvance = /advance/i.test(termsStr) && !/on delivery/i.test(termsStr);
  const isOnDelivery = /on delivery/i.test(termsStr) || /after dispatch/i.test(termsStr);

  const baseFormData = {
   legalName: data.legalName || v.name,
   tradeName: data.tradeName || v.name,
   primaryEmail: data.primaryEmail || v.email,
   primaryPhone: data.primaryPhone || v.phone,
   state: data.state || v.location,
   country: data.country || v.country,
   setupCategory: data.setupCategory || v.category,
   paymentTerms: data.paymentTerms || v.paymentTerms,
   notes: data.notes || v.notes,
   entityCode: String(entityCode || ''),
   zohoId: data.zohoId ?? (v as { zohoId?: string }).zohoId ?? '',
   linkedUserId: String((v as { userId?: string | null }).userId ?? ''),
   paymentCreditType: data.paymentCreditType ?? (isAdvance ? 'Advance' : 'Credit'),
   payablesAdvancedPct:
    data.payablesAdvancedPct != null && String(data.payablesAdvancedPct).trim() !== ''
     ? String(data.payablesAdvancedPct)
     : isAdvance
       ? '100'
       : '0',
   payablesBeforeDispatchPct:
    data.payablesBeforeDispatchPct != null && String(data.payablesBeforeDispatchPct).trim() !== ''
     ? String(data.payablesBeforeDispatchPct)
     : '0',
   payablesAfterDispatchPct:
    data.payablesAfterDispatchPct != null && String(data.payablesAfterDispatchPct).trim() !== ''
     ? String(data.payablesAfterDispatchPct)
     : isAdvance
       ? '0'
       : isOnDelivery
         ? '100'
         : '100',
  };

  setFormData((prev) => ({
   ...prev,
   ...baseFormData,
   ...data,
   setupType: 'VENDOR',
   setupPrefix: 'VEN',
  }));
  setDocuments(Array.isArray(data.documents) ? data.documents : []);
  setPocs(Array.isArray(data.pocs) ? data.pocs : []);
  setBanks(Array.isArray(data.banks) ? data.banks : []);
  setVendorItems((prev) => {
   const fromServer = Array.isArray(data.vendorItems) ? data.vendorItems : [];
   if (prev.length > 0) return prev;
   return fromServer;
  });
 }, [editingId, fetchedRecord]);

 const [documents, setDocuments] = useState<Document[]>([]);
 const [pocs, setPocs] = useState<POC[]>([]);
 const [banks, setBanks] = useState<BankDetail[]>([]);
 const [vendorItems, setVendorItems] = useState<VendorItem[]>([]);

 const [tempDoc, setTempDoc] = useState({ type: '', link: '', date: '' });
 const [tempPoc, setTempPoc] = useState({ name: '', role: '', email: '', phone: '', level: '', preferred: '', notes: '' });
 const [tempBank, setTempBank] = useState({ beneficiaryName: '', bankName: '', accountNo: '', ifsc: '', branch: '', accountType: '', upiId: '', isDefault: '', notes: '' });
 const [tempItem, setTempItem] = useState({ itemType: '', itemCode: '', itemName: '', uom: 'KG', moq: '', unitPrice: '', leadTime: '', priceValidTill: '', gst: '', hsn: '', paymentTermsOverride: '' });

 const [itemCodeSuggestions, setItemCodeSuggestions] = useState<ItemCodeSuggestion[]>([]);
 const [itemCodeLoading, setItemCodeLoading] = useState(false);
 const [itemCodeOpen, setItemCodeOpen] = useState(false);
 const itemCodeBlurTimeoutRef = useRef<number | null>(null);
 const lastSuggestReqRef = useRef(0);

 useEffect(() => {
  // Only autocomplete for RM/PM.
  const t = String(tempItem.itemType || '').trim().toUpperCase();
  if (t !== 'RM' && t !== 'PM') {
   setItemCodeSuggestions([]);
   setItemCodeLoading(false);
   setItemCodeOpen(false);
   return;
  }

  const q = String(tempItem.itemCode || '').trim();
  if (q.length < 2) {
   setItemCodeSuggestions([]);
   setItemCodeLoading(false);
   return;
  }

  const reqId = Date.now();
  lastSuggestReqRef.current = reqId;
  setItemCodeLoading(true);

  const timer = window.setTimeout(() => {
   const run = async () => {
    try {
     if (t === 'RM') {
      const list = await fetchRawMaterialsList(q);
      if (lastSuggestReqRef.current !== reqId) return;
      const mapped: ItemCodeSuggestion[] = (list ?? [])
       .slice(0, 10)
       .map((rm: RawMaterialRecord) => ({
        kind: 'RM',
        code: rm.code,
        name: rm.name,
        uom: rm.uom || 'KG',
        gst: rm.gst,
        hsn: rm.hsnCode,
       }));
      setItemCodeSuggestions(mapped);
      setItemCodeOpen(true);
     } else {
      const list = await fetchPackMaterialsList(q);
      if (lastSuggestReqRef.current !== reqId) return;
      const mapped: ItemCodeSuggestion[] = (list ?? [])
       .slice(0, 10)
       .map((pm: PackMaterialRecord) => ({
        kind: 'PM',
        code: pm.code,
        name: pm.description,
        uom: pm.unit || 'PCS',
        hsn: pm.hsnCode,
       }));
      setItemCodeSuggestions(mapped);
      setItemCodeOpen(true);
     }
    } catch {
     if (lastSuggestReqRef.current !== reqId) return;
     setItemCodeSuggestions([]);
     setItemCodeOpen(false);
    } finally {
     if (lastSuggestReqRef.current === reqId) setItemCodeLoading(false);
    }
   };
   void run();
  }, 250);

  return () => {
   window.clearTimeout(timer);
  };
 }, [tempItem.itemType, tempItem.itemCode]);

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
    paymentCreditType: 'Credit',
    payablesAdvancedPct: '0',
    payablesBeforeDispatchPct: '0',
    payablesAfterDispatchPct: '100',
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
  linkedUserId: '',
 });

 const stages = [
  { title: 'Setup & Coding', hint: 'Pick entity type and generate code series.' },
  { title: 'Organization Details', hint: 'Addresses, website, segment and notes.' },
  { title: 'Tax, Compliance & Documents', hint: 'GST/PAN + document register.' },
  { title: 'Multi-level POCs', hint: 'Multiple contacts with escalation levels and departments.' },
  { title: 'Bank Details', hint: 'Multiple bank accounts + default account.' },
  { title: 'Payment Terms & Credit', hint: 'Terms, credit limit, TDS, payment mode.' },
  { title: 'Agreements & Status', hint: 'NDA/MSA/Rate Contract status and links.' },
 ];

 const payAdv = formData.payablesAdvancedPct;
 const payBefore = formData.payablesBeforeDispatchPct;
 const payAfter = formData.payablesAfterDispatchPct;
 const paymentSplitSum = useMemo(() => {
  const adv = Number(String(payAdv ?? '').trim()) || 0;
  const before = Number(String(payBefore ?? '').trim()) || 0;
  const after = Number(String(payAfter ?? '').trim()) || 0;
  return adv + before + after;
 }, [payAdv, payBefore, payAfter]);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  if (name === 'zohoId') return;
  setFormData(prev => ({ ...prev, [name]: value }));
  setErrors(prev => {
   const next = { ...prev };
   if (next[name]) next[name] = '';
   if (
    name === 'payablesAdvancedPct' ||
    name === 'payablesBeforeDispatchPct' ||
    name === 'payablesAfterDispatchPct'
   ) {
    if (next.paymentSplit) next.paymentSplit = '';
   }
   return next;
  });
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

 const entityCodeFromRecord = (record: VendorClientRecord) =>
  String(record.entityCode ?? (record.data as { entityCode?: string })?.entityCode ?? '').trim();

 const closeSaveSuccessModal = () => {
  setSaveSuccessOpen(false);
  setSaveSuccessCode('');
  setSaveSuccessRows([]);
  setSaveSuccessZohoNote(null);
  setFormData({
   setupType: 'VENDOR', setupCategory: '', setupPrefix: 'VEN', entityCode: '', zohoId: '',
   legalName: '', tradeName: '', primaryEmail: '', primaryPhone: '',
   billingAddress: '', shippingAddress: '', state: '', country: 'India',
   website: '', segment: '', notes: '', gstin: '', pan: '', msme: '', iec: '',
   paymentTerms: '', customTerms: '', creditLimit: '', penalty: '',
   paymentCreditType: 'Credit',
   payablesAdvancedPct: '0',
   payablesBeforeDispatchPct: '0',
   payablesAfterDispatchPct: '100',
   tdsApplicable: '', preferredPaymentMode: '', paymentNotes: '',
   agreementType: '', agreementStatus: '', startDate: '', endDate: '',
   agreementLink: '', owner: '', agreementNotes: '',
   linkedUserId: '',
  });
  setDocuments([]); setPocs([]); setBanks([]); setVendorItems([]);
  setCurrentStage(0);
  onSaved?.();
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
  const t = String(tempItem.itemType).trim().toUpperCase();
  if ((t === 'RM' || t === 'PM') && !String(tempItem.itemCode || '').trim()) {
   addToast('error', 'Item code is required for RM/PM so prices can sync to Items List');
   return;
  }
  if ((t === 'RM' || t === 'PM') && !String(tempItem.unitPrice || '').trim()) {
   addToast('error', 'Unit price is required for RM/PM lines');
   return;
  }
  setVendorItems([...vendorItems, tempItem]);
  setTempItem({ itemType: '', itemCode: '', itemName: '', uom: 'KG', moq: '', unitPrice: '', leadTime: '', priceValidTill: '', gst: '', hsn: '', paymentTermsOverride: '' });
  addToast('success', 'Vendor item added');
 };

 const removeVendorItem = (index: number) => {
  setVendorItems(vendorItems.filter((_, i) => i !== index));
  addToast('success', 'Vendor item removed');
 };

 const invalidateItemsListAfterVendorSave = async () => {
  await queryClient.invalidateQueries({
   predicate: (q) =>
    Array.isArray(q.queryKey) &&
    typeof q.queryKey[0] === 'string' &&
    q.queryKey[0].startsWith('items-list'),
   refetchType: 'all',
  });
 };

 const buildVendorDataBlob = () => {
  const adv = Number(String(formData.payablesAdvancedPct ?? '').trim()) || 0;
  const before = Number(String(formData.payablesBeforeDispatchPct ?? '').trim()) || 0;
  const after = Number(String(formData.payablesAfterDispatchPct ?? '').trim()) || 0;
  const computedPaymentTerms = `Advanced ${adv}% + Before dispatch ${before}% + After dispatch/On delivery ${after}%`;
  const shippingResolved = resolveShippingAddress(formData);
  return {
   computedPaymentTerms,
   data: {
    ...formData,
    shippingAddress: shippingResolved,
    paymentTerms: computedPaymentTerms,
    documents,
    pocs,
    banks,
    vendorItems,
   },
  };
 };

 const validateVendorItemsForPriceSave = (): boolean => {
  for (const it of vendorItems) {
   const t = String(it.itemType || '').trim().toUpperCase();
   if (t === 'RM' || t === 'PM') {
    if (!String(it.itemCode || '').trim()) {
     addToast('error', 'RM/PM lines need an item code before saving');
     return false;
    }
    if (!String(it.unitPrice || '').trim()) {
     addToast('error', 'RM/PM lines need a unit price before saving');
     return false;
    }
   }
  }
  return true;
 };

 const handleSaveVendorPriceList = async () => {
  if (!editingId) {
   addToast('error', 'Save the vendor once from the final step first, then open Edit to save the price list to the server.');
   return;
  }
  const ptErrs = validatePaymentTermsOnly(formData);
  if (Object.keys(ptErrs.errors).length > 0) {
   setErrors(prev => ({ ...prev, ...ptErrs.errors }));
   setCurrentStage(5);
   addToast('error', Object.values(ptErrs.errors)[0] ?? 'Fix payment terms');
   return;
  }
  if (!validateVendorItemsForPriceSave()) return;
  setSavingPriceList(true);
  try {
   const { computedPaymentTerms, data } = buildVendorDataBlob();
   const res = await updateVendorClientApi(editingId, {
    name: formData.tradeName || formData.legalName,
    email: formData.primaryEmail,
    phone: formData.primaryPhone,
    location: formData.state,
    country: formData.country,
    category: formData.setupCategory,
    paymentTerms: computedPaymentTerms,
    notes: formData.notes,
    zohoId: formData.zohoId || undefined,
    userId: formData.linkedUserId.trim() === '' ? null : formData.linkedUserId.trim(),
    data: data as Record<string, unknown>,
   });
   if (res.success && res.data) {
    const row = res.data as VendorClientRecord;
    const d = (row.data || {}) as Record<string, unknown>;
    if (Array.isArray(d.vendorItems)) {
     setVendorItems(d.vendorItems as VendorItem[]);
    }
    const lastMod = String(row.lastModified ?? '');
    hydratedFetchKeyRef.current = `${editingId}:${lastMod}`;
    setFetchedRecord(row as unknown as Record<string, unknown>);
    addToast('success', 'Price list saved to server.');
    const sync = row.priceListSync;
    if (sync && sync.skipped.length > 0) {
     const hint = sync.skipped[0]
      ? `${sync.skipped[0].code}: ${sync.skipped[0].reason}`
      : 'check RM/PM codes in masters';
     addToast(
      'warning',
      `Price list: ${sync.skipped.length} line(s) not synced (${hint}${sync.skipped.length > 1 ? '…' : ''})`,
     );
    }
    void invalidateItemsListAfterVendorSave();
    void queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
    return;
   }
   addToast('error', getErrorMessage(res.error, 'Failed to save price list'));
  } finally {
   setSavingPriceList(false);
  }
 };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const { errors: ve, firstErrorStage } = validateVendorForm(formData, { isNewVendor: !editingId });
  if (Object.keys(ve).length > 0) {
   setErrors(ve);
   setCurrentStage(firstErrorStage);
   addToast('error', Object.values(ve)[0] ?? 'Please fix the highlighted fields');
   return;
  }
  setIsSaving(true);

  const { computedPaymentTerms, data } = buildVendorDataBlob();

  const payload = {
   name: formData.tradeName || formData.legalName,
   email: formData.primaryEmail,
   phone: formData.primaryPhone,
   location: formData.state,
   country: formData.country,
   category: formData.setupCategory,
   paymentTerms: computedPaymentTerms,
   notes: formData.notes,
   data,
  };

  if (editingId) {
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
    userId: formData.linkedUserId.trim() === '' ? null : formData.linkedUserId.trim(),
    data: payload.data as Record<string, unknown>,
   });
   if (res.success) {
    addToast('success', 'Vendor updated successfully!');
    const sync = res.data?.priceListSync;
    if (sync && sync.skipped.length > 0) {
     const hint = sync.skipped[0]
      ? `${sync.skipped[0].code}: ${sync.skipped[0].reason}`
      : 'check RM/PM codes in masters';
     addToast(
      'warning',
      `Price list: ${sync.skipped.length} line(s) not synced (${hint}${sync.skipped.length > 1 ? '…' : ''})`,
     );
    }
    void invalidateItemsListAfterVendorSave();
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
   ...(formData.linkedUserId.trim() ? { userId: formData.linkedUserId.trim() } : {}),
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

  if (res.success && res.data) {
   const sync = res.data.priceListSync;
   if (sync && sync.skipped.length > 0) {
    const hint = sync.skipped[0]
     ? `${sync.skipped[0].code}: ${sync.skipped[0].reason}`
     : 'check RM/PM codes in masters';
    addToast(
     'warning',
     `Price list: ${sync.skipped.length} line(s) not synced (${hint}${sync.skipped.length > 1 ? '…' : ''})`,
    );
   }
   void invalidateItemsListAfterVendorSave();
   const code = entityCodeFromRecord(res.data);
   setSaveSuccessCode(code);
   setSaveSuccessRows([
    { label: 'Legal name', value: res.data.name || formData.legalName || '' },
    { label: 'Trade name', value: formData.tradeName || '' },
    { label: 'Category', value: res.data.category || formData.setupCategory || '' },
    { label: 'Email', value: res.data.email || formData.primaryEmail || '' },
   ]);
   const zohoSynced = res.data.zoho_sync?.synced === true;
   setSaveSuccessZohoNote(
    zohoSynced && res.data.zoho_sync?.contact_id
      ? `Synced to Zoho Books (contact ${res.data.zoho_sync.contact_id}).`
      : zohoSynced
        ? 'Synced to Zoho Books.'
        : res.data.zoho_sync?.error
          ? `Saved locally; Zoho sync failed: ${res.data.zoho_sync.error}`
          : null
   );
   setSaveSuccessOpen(true);
   setIsSaving(false);
   return;
  }
   addToast('error', getErrorMessage(res.error, 'Failed to create vendor'));
  setIsSaving(false);
 };

 const getProgressPercentage = () => ((currentStage + 1) / stages.length) * 100;

 const inputClass = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition";
 const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
 const sectionTitleClass = "text-xs font-bold text-gray-500 tracking-widest uppercase mb-4";
 const req = <span className="text-red-600" aria-hidden>*</span>;
 const fieldClass = (name: string) =>
  `${inputClass} ${errors[name] ? 'border-red-500 ring-1 ring-red-200' : ''}`;
 const pctFieldClass =
  `${inputClass} ${errors.paymentSplit ? 'border-red-500 ring-1 ring-red-200' : ''}`;
 const errMsg = (k: string) =>
  errors[k] ? <p className="text-xs text-red-600 mt-1">{errors[k]}</p> : null;

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
         <label className={labelClass}>Category {req}</label>
         <select name="setupCategory" value={formData.setupCategory} onChange={handleInputChange} className={fieldClass('setupCategory')}>
          <option value="">Select</option>
          <option>RM Vendor</option>
          <option>PM Vendor</option>
          <option>Lab / Testing</option>
          <option>Logistics</option>
          <option>Consultant</option>
          <option>Other</option>
         </select>
         {errMsg('setupCategory')}
        </div>
       </div>
       <div className={sectionTitleClass}>Vendor identity</div>
       {!editingId ? (
        <p className="text-sm text-gray-600 -mt-2 mb-2">
          Fill category, names, and contact details. On submit the server assigns an entity code (EI-VEN-#####), creates the
          Zoho Books contact when sync is enabled, and shows the generated code in a confirmation dialog.
        </p>
       ) : null}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Legal Name {req}</label>
         <input type="text" name="legalName" id="legalName" value={formData.legalName} onChange={handleInputChange} placeholder="As per GST / PAN" className={fieldClass('legalName')} />
         {errMsg('legalName')}
        </div>
        <div>
         <label className={labelClass}>Display / Trade Name {req}</label>
         <input type="text" name="tradeName" value={formData.tradeName} onChange={handleInputChange} placeholder="Short name for UI/Zoho" className={fieldClass('tradeName')} />
         {errMsg('tradeName')}
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Primary Email {req}</label>
         <input type="email" name="primaryEmail" value={formData.primaryEmail} onChange={handleInputChange} placeholder="accounts@..." className={fieldClass('primaryEmail')} />
         {errMsg('primaryEmail')}
        </div>
        <div>
         <label className={labelClass}>Primary Phone {req}</label>
         <input type="tel" name="primaryPhone" value={formData.primaryPhone} onChange={handleInputChange} placeholder="+91..." className={fieldClass('primaryPhone')} />
         {errMsg('primaryPhone')}
        </div>
       </div>

       {editingId && String(formData.entityCode || '').trim() ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
         <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Entity code</p>
         <p className="text-sm font-mono text-gray-800 mt-0.5">{formData.entityCode}</p>
        </div>
       ) : null}

       {editingId && String(formData.zohoId || '').trim() ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
         <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Zoho Books contact ID</p>
         <p className="text-sm font-mono text-slate-800 mt-0.5">{formData.zohoId}</p>
         <p className="text-xs text-slate-500 mt-1">Assigned automatically by the server; not editable here.</p>
        </div>
       ) : null}
       <div>
        <label className={labelClass}>Linked User Management ID</label>
        <input type="text" inputMode="numeric" name="linkedUserId" value={formData.linkedUserId} onChange={handleInputChange} placeholder="Portal user id (optional)" className={inputClass} />
        <p className="text-xs text-slate-500 mt-1">Optional link to a user account. Clear to unlink.</p>
       </div>
      </div>
     )}

     {/* Stage 1: Organization Details */}
     {currentStage === 1 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Organization Details</div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Billing Address {req}</label>
         <textarea name="billingAddress" value={formData.billingAddress} onChange={handleInputChange} placeholder="Street, city, state, pin" className={fieldClass('billingAddress')} rows={3} />
         {errMsg('billingAddress')}
        </div>
        <div>
         <label className={labelClass}>Shipping Address {req}</label>
         <textarea name="shippingAddress" value={formData.shippingAddress} onChange={handleInputChange} placeholder="Leave blank to use billing address" className={fieldClass('shippingAddress')} rows={3} />
         {errMsg('shippingAddress')}
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>State {req}</label>
         <input type="text" name="state" value={formData.state} onChange={handleInputChange} className={fieldClass('state')} />
         {errMsg('state')}
        </div>
        <div>
         <label className={labelClass}>Country {req}</label>
         <input type="text" name="country" value={formData.country} onChange={handleInputChange} className={fieldClass('country')} />
         {errMsg('country')}
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Website</label>
         <input type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://..." className={fieldClass('website')} />
         {errMsg('website')}
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
         <input type="text" name="gstin" value={formData.gstin} onChange={handleInputChange} className={fieldClass('gstin')} placeholder="15-character GSTIN if applicable" />
         {errMsg('gstin')}
        </div>
        <div>
         <label className={labelClass}>PAN</label>
         <input type="text" name="pan" value={formData.pan} onChange={handleInputChange} className={fieldClass('pan')} placeholder="ABCDE1234F if applicable" />
         {errMsg('pan')}
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
       <p className="text-sm text-gray-600 mb-2">
        Split must total <strong>100%</strong>: Advance + Before dispatch + After delivery/on delivery. Current total:{' '}
        <span className={Math.abs(paymentSplitSum - 100) < 0.001 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
         {paymentSplitSum.toFixed(2)}%
        </span>
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>Advanced (%) {req}</label>
         <input
          type="number"
          name="payablesAdvancedPct"
          value={formData.payablesAdvancedPct}
          onChange={handleInputChange}
          step="0.01"
          min="0"
          className={pctFieldClass}
         />
        </div>
        <div>
         <label className={labelClass}>Before dispatch (%) {req}</label>
         <input
          type="number"
          name="payablesBeforeDispatchPct"
          value={formData.payablesBeforeDispatchPct}
          onChange={handleInputChange}
          step="0.01"
          min="0"
          className={pctFieldClass}
         />
        </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelClass}>After dispatch / On delivery (%) {req}</label>
         <input
          type="number"
          name="payablesAfterDispatchPct"
          value={formData.payablesAfterDispatchPct}
          onChange={handleInputChange}
          step="0.01"
          min="0"
          className={pctFieldClass}
         />
        </div>
        <div>
         <label className={labelClass}>Credit Type {req}</label>
         <select name="paymentCreditType" value={formData.paymentCreditType} onChange={handleInputChange} className={fieldClass('paymentCreditType')}>
          <option value="">Select</option>
          <option>Credit</option>
          <option>Advance</option>
          <option>LC</option>
          <option>Mixed</option>
         </select>
         {errMsg('paymentCreditType')}
        </div>
       </div>
       {errors.paymentSplit ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errors.paymentSplit}</div>
       ) : null}
       <div>
        <label className={labelClass}>Custom Terms (optional)</label>
        <input
         type="text"
         name="customTerms"
         value={formData.customTerms}
         onChange={handleInputChange}
         placeholder="e.g., 50% advance + 50% on delivery"
         className={inputClass}
        />
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

    {/* Vendor Items & Price List step removed from the wizard */}
    {currentStage === 9999 && (
      <div className="space-y-6">
       <div className={sectionTitleClass}>Vendor Items & Price List (Vendor Only)</div>
       <p className="text-sm text-gray-500 mb-4">
        This section is visible only for Vendor master. Lines with type <strong>RM</strong> or <strong>PM</strong> must use an{' '}
        <strong>item code</strong> that exists in Raw Materials or Pack Materials masters. On save, those lines sync to{' '}
        <strong>Items List → Price list</strong> (vendor rates and MOQ tiers). Service/Other lines are stored on the vendor only.
       </p>

       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
        <p className="text-sm text-gray-600">
         {editingId
          ? 'Save the lines below to the server now and verify the request/response in the network tab (or Items List after sync).'
          : 'A vendor record must exist before the price list can be saved. Submit the full form once, then edit the vendor to use Save price list.'}
        </p>
        <button
         type="button"
         onClick={handleSaveVendorPriceList}
         disabled={!editingId || savingPriceList}
         className="shrink-0 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
        >
         {savingPriceList ? 'Saving…' : 'Save price list'}
        </button>
       </div>
       
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
         <div className="relative">
          <input
           type="text"
           value={tempItem.itemCode}
           onChange={(e) => {
            setTempItem({ ...tempItem, itemCode: e.target.value });
            setItemCodeOpen(true);
           }}
           onFocus={() => {
            if (itemCodeBlurTimeoutRef.current) window.clearTimeout(itemCodeBlurTimeoutRef.current);
            if (itemCodeSuggestions.length > 0) setItemCodeOpen(true);
           }}
           onBlur={() => {
            // Delay so clicking a suggestion still works.
            itemCodeBlurTimeoutRef.current = window.setTimeout(() => setItemCodeOpen(false), 150);
           }}
           placeholder="Type to search RM/PM master codes…"
           className={inputClass}
           autoComplete="off"
          />
          {itemCodeLoading && (
           <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">Searching…</div>
          )}

          {itemCodeOpen && itemCodeSuggestions.length > 0 && (
           <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="max-h-64 overflow-auto">
             {itemCodeSuggestions.map((sug, i) => (
              <button
               key={`${sug.kind}-${sug.code}-${i}`}
               type="button"
               onMouseDown={(e) => e.preventDefault()}
               onClick={() => {
                setTempItem((prev) => ({
                 ...prev,
                 itemType: sug.kind,
                 itemCode: sug.code,
                 itemName: sug.name,
                 uom: sug.uom || prev.uom,
                 gst: sug.gst != null ? String(sug.gst) : prev.gst,
                 hsn: sug.hsn != null ? String(sug.hsn) : prev.hsn,
                }));
                setItemCodeOpen(false);
               }}
               className="w-full text-left px-3 py-2 hover:bg-slate-50"
              >
               <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                 <div className="text-sm font-mono text-gray-900 truncate">{sug.code}</div>
                 <div className="text-xs text-gray-600 truncate">{sug.name}</div>
                </div>
                <div className="text-xs text-gray-500 shrink-0">{sug.kind} • {sug.uom}</div>
               </div>
              </button>
             ))}
            </div>
           </div>
          )}
         </div>
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

    {/* Stage 6: Agreements & Status */}
    {currentStage === 6 && (
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
        className="px-8 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-lg"
       >
        Next
       </button>
      )}
     </div>
    </div>
   </form>
   <MasterSaveSuccessModal
    isOpen={saveSuccessOpen}
    onClose={closeSaveSuccessModal}
    title="Vendor created"
    subtitle="Your vendor is saved. Details and the generated entity code are below."
    generatedCode={saveSuccessCode}
    codeLabel="Generated entity code"
    rows={saveSuccessRows}
    zohoNote={saveSuccessZohoNote}
   />
  </div>
 );
};

export default VendorForm;
