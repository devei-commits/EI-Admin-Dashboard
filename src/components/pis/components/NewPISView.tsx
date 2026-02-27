import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, FileText, Eye, Plus } from 'lucide-react';

import { usePIS } from '../context/PISContext';
import { PISRecord } from '../types/pis';
import { getRolePermissions } from '../utils/permissions';

import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { StageTemplatesForm, defaultStageTemplates } from './StageTemplatesForm';
import { PISDetailsDialog } from './PISDetailsDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

function generatePisCode() {
 const now = new Date();
 const month = now.toLocaleString('default', { month: 'short' }).toUpperCase();
 const year = now.getFullYear().toString().slice(-2);
 const random = Math.floor(Math.random() * 10000)
  .toString()
  .padStart(4, '0');

 return `EI/PIS/${month}/${year}/${random}`;
}

type ProductCategory = 'SKIN' | 'HAIR';
type PackOption = 'EXISTING' | 'NEW';
type ReferenceMode = 'RECOMMENDED' | 'CUSTOM';
type ArtworkChoice = 'YES' | 'NO';

const PRODUCT_OPTIONS: Record<ProductCategory, string[]> = {
 SKIN: ['Sunscreen', 'Moisturiser', 'Cleanser', 'Actives', 'Others'],
 HAIR: ['Shampoo', 'Conditioner', 'Actives', 'Others'],
};

const DEFAULT_DYNAMIC_QA = [{ question: '', answer: '' }];

export function NewPISView() {
 const { addPIS, currentUser, pisRecords, updatePIS, systemUsers } = usePIS();
 const permissions = currentUser?.role ? getRolePermissions(currentUser.role) : null;
 
 // For BD_MANAGER: Show unassigned CLIENT-requested PIS records
 const isBDManager = currentUser?.role === 'BD_MANAGER';
 const isClient = currentUser?.role === 'CLIENT';

 // All hooks must be called before any early returns
 const [created, setCreated] = useState<PISRecord | null>(null);
 const [isCreating, setIsCreating] = useState(false);
 const [selectedPIS, setSelectedPIS] = useState<PISRecord | null>(null);
 const [isDetailsOpen, setIsDetailsOpen] = useState(false);
 const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
 const [assignTargetPis, setAssignTargetPis] = useState<PISRecord | null>(null);
 const [selectedStaffId, setSelectedStaffId] = useState<string>('');
 const [showCreateForm, setShowCreateForm] = useState(false);

 const [projectCode, setProjectCode] = useState('');
 const [formulationCode, setFormulationCode] = useState('');
 const [clientName, setClientName] = useState(currentUser?.name ?? '');
 const [brand, setBrand] = useState('');
 const [bdOwner, setBdOwner] = useState('');
 const [rdLead, setRdLead] = useState('');
 const [dateInitiated, setDateInitiated] = useState(() => new Date().toISOString().slice(0, 10));
 const [notes, setNotes] = useState('');

 const [productCategory, setProductCategory] = useState<ProductCategory>('SKIN');
 const [productType, setProductType] = useState<string>(PRODUCT_OPTIONS.SKIN[0]);
 const [dynamicQa, setDynamicQa] = useState<{ question: string; answer: string }[]>(
  () => [...DEFAULT_DYNAMIC_QA]
 );
 const [activeIngredients, setActiveIngredients] = useState('');
 const [avoidIngredients, setAvoidIngredients] = useState('');
 const [otherIngredients, setOtherIngredients] = useState('');
 const [referenceMode, setReferenceMode] = useState<ReferenceMode>('RECOMMENDED');
 const [referenceFormulas, setReferenceFormulas] = useState('');
 const [customSelectionNotes, setCustomSelectionNotes] = useState('');
 const [packVolume, setPackVolume] = useState('30 ml');
 const [packingOption, setPackingOption] = useState<PackOption>('EXISTING');
 const [packingReference, setPackingReference] = useState('');
 const [packingUploadLink, setPackingUploadLink] = useState('');
 const [monoCartonOption, setMonoCartonOption] = useState<PackOption>('EXISTING');
 const [monoCartonReference, setMonoCartonReference] = useState('');
 const [monoCartonUploadLink, setMonoCartonUploadLink] = useState('');
 const [artworkNeeded, setArtworkNeeded] = useState<ArtworkChoice>('YES');
 const [artworkFormLink, setArtworkFormLink] = useState('');
 const [logoOption, setLogoOption] = useState<PackOption>('EXISTING');
 const [logoReference, setLogoReference] = useState('');
 const [logoUploadLink, setLogoUploadLink] = useState('');

 const effectivePisCode = useMemo(() => projectCode.trim() || generatePisCode(), [projectCode]);

 // For BD_MANAGER: Filter PIS records requested by CLIENT users that are not assigned to BD staff
 const unassignedClientPIS = useMemo(() => {
  if (!isBDManager) return [];
  
  return pisRecords.filter((pis) => {
   // Must be in BD_INTAKE stage (new requests)
   const isBdStage = pis.stage === 'BD_INTAKE' || pis.stage === 'ALIGNMENT' || pis.stage === 'AGREEMENT';
   
   // Must NOT be assigned to BD_STAFF
   const isUnassigned = pis.assignedBdRole !== 'BD_STAFF' && !pis.assignedBdStaffId;
   
   // Check if requested by CLIENT user
   const pisAny = pis as unknown as Record<string, unknown>;
   const clientAccess = pisAny.clientAccess as unknown[] | undefined;
   const createdBy = pisAny.createdBy as { role?: string } | undefined;
   const hasClientAccess = Array.isArray(clientAccess) && clientAccess.length > 0;
   const createdByClient = createdBy?.role === 'CLIENT';
   
   return isBdStage && isUnassigned && (hasClientAccess || createdByClient);
  });
 }, [pisRecords, isBDManager]);

 // Get BD staff users for assignment
 const bdStaffUsers = useMemo(() => {
  return systemUsers.filter(u => u.role === 'BD_STAFF' && u.status === 'ACTIVE');
 }, [systemUsers]);
 
 // Check if user can create PIS - moved after all hooks
 // Also accept admin panel roles as fallback when PIS context has no logged-in user
 const adminPanelRole = localStorage.getItem('adminUserRole') || '';
 const normalizedAdminRole = adminPanelRole.toLowerCase().trim();
 const isAdminPanelUser = [
  'super admin', 'superadmin', 'super_admin', 'admin',
  'bd manager', 'bd_manager', 'bd staff', 'bd_staff',
 ].some(r => normalizedAdminRole.includes(r.replace(' ', '')) || normalizedAdminRole === r);

 if (!permissions?.canCreatePIS && !isBDManager && !isAdminPanelUser) {
  return (
   <div className="space-y-6">
    <div>
     <h1 className="text-2xl font-semibold tracking-tight">New PIS</h1>
     <p className="text-sm text-muted-foreground">
      You don't have permission to create new PIS records.
     </p>
    </div>
    <Card className="p-6">
     <p className="text-gray-600">
      Please contact your administrator if you need access to create PIS records.
     </p>
    </Card>
   </div>
  );
 }

 const updateQaItem = (index: number, key: 'question' | 'answer', value: string) => {
  setDynamicQa((prev) => {
   const next = [...prev];
   next[index] = { ...next[index], [key]: value };
   return next;
  });
 };

 const addQaItem = () => setDynamicQa((prev) => [...prev, { question: '', answer: '' }]);

 const removeQaItem = (index: number) => {
  setDynamicQa((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
 };

 const handleAssignToStaff = (pis: PISRecord) => {
  setAssignTargetPis(pis);
  setIsAssignDialogOpen(true);
  setSelectedStaffId('');
 };

 const handleConfirmAssign = () => {
  if (!assignTargetPis || !selectedStaffId) {
   toast.error('Please select a BD staff member');
   return;
  }

  const selectedStaff = bdStaffUsers.find(u => u.id === selectedStaffId);
  if (!selectedStaff) {
   toast.error('Selected staff member not found');
   return;
  }

  updatePIS(assignTargetPis.id, {
   assignedBdRole: 'BD_STAFF',
   assignedBdStaffId: selectedStaffId,
  });

  toast.success(`PIS assigned to ${selectedStaff.name}`);
  setIsAssignDialogOpen(false);
  setAssignTargetPis(null);
  setSelectedStaffId('');
 };

 const handleViewDetails = (pis: PISRecord) => {
  setSelectedPIS(pis);
  setIsDetailsOpen(true);
 };

 const reset = () => {
  setCreated(null);
  setIsCreating(false);
  setShowCreateForm(false);
  setProjectCode('');
  setFormulationCode('');
  setClientName(currentUser?.name ?? '');
  setBrand('');
  setBdOwner('');
  setRdLead('');
  setDateInitiated(new Date().toISOString().slice(0, 10));
  setNotes('');
  setProductCategory('SKIN');
  setProductType(PRODUCT_OPTIONS.SKIN[0]);
  setDynamicQa([...DEFAULT_DYNAMIC_QA]);
  setActiveIngredients('');
  setAvoidIngredients('');
  setOtherIngredients('');
  setReferenceMode('RECOMMENDED');
  setReferenceFormulas('');
  setCustomSelectionNotes('');
  setPackVolume('30 ml');
  setPackingOption('EXISTING');
  setPackingReference('');
  setPackingUploadLink('');
  setMonoCartonOption('EXISTING');
  setMonoCartonReference('');
  setMonoCartonUploadLink('');
  setArtworkNeeded('YES');
  setArtworkFormLink('');
  setLogoOption('EXISTING');
  setLogoReference('');
  setLogoUploadLink('');
 };

 const handleCreate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formulationCode.trim()) {
   toast.error('Formulation Code is required');
   return;
  }

  if (!productType.trim()) {
   toast.error('Please pick a product type');
   return;
  }

  setIsCreating(true);
  try {
   const now = new Date();
   const qaEntries = dynamicQa
    .map((item) => ({
     question: item.question.trim(),
     answer: item.answer.trim(),
    }))
    .filter((item) => item.question || item.answer);
   const stageTemplates = defaultStageTemplates();
   stageTemplates.meta = {
    project_code: effectivePisCode,
    client_name: clientName.trim(),
    brand: brand.trim(),
    bd_owner: bdOwner.trim(),
    rd_lead: rdLead.trim(),
    date_initiated: dateInitiated,
   };
   stageTemplates.current = 'S0';
   stageTemplates.S0 = {
    newFormulationFlow: {
     category: productCategory === 'SKIN' ? 'Skin Care' : 'Hair Care',
     productType,
     dynamicQa: qaEntries,
     specs: {
      activeIngredients: activeIngredients.trim(),
      avoidIngredients: avoidIngredients.trim(),
      otherIngredients: otherIngredients.trim(),
      referenceMode,
      referenceFormulas: referenceFormulas.trim(),
      customSelectionNotes: customSelectionNotes.trim(),
     },
     packCatalog: {
      volume: packVolume.trim(),
      packing: {
       option: packingOption,
       reference: packingReference.trim(),
       uploadLink: packingUploadLink.trim(),
      },
      monoCarton: {
       option: monoCartonOption,
       reference: monoCartonReference.trim(),
       uploadLink: monoCartonUploadLink.trim(),
      },
      artwork: {
       required: artworkNeeded === 'YES',
       artworkFormLink: artworkFormLink.trim(),
       logo: {
        option: logoOption,
        reference: logoReference.trim(),
        uploadLink: logoUploadLink.trim(),
       },
      },
     },
    },
   };

   const newPIS: PISRecord = {
    id: `PIS-${Date.now()}`,
    pisCode: effectivePisCode,
    formulation: formulationCode.trim(),
    originType: 'CUSTOMER_ENQUIRY',
    customer: clientName.trim() || currentUser?.name || 'Client',
    costName: brand.trim() || 'TBD',
    rdStaff: rdLead.trim() || 'Pending Assignment',
    stage: 'BD_INTAKE',
    status: 'PENDING',
    m1: false,
    v1: false,
    rdO1: false,
    regulatory: false,
    inventory: false,
    formLabel: 'Client Request Capture',
    sop: false,
    ac: false,
    oc: false,
    mop: false,
    coa: false,
    pre: false,
    stabilityMatch: false,
    prs: false,
    sensory: false,
    bdTeam: 'BD Manager Queue',
    assignedBdRole: 'BD_MANAGER',
    rndLeadAssignment: rdLead.trim() || 'Not Assigned',
    rndStaffAssignment: 'Not Assigned',
    qaAssignment: 'Not Assigned',
    createdAt: now,
    updatedAt: now,
    stageTemplates,
    history: [
     {
      id: `HIS-${Date.now()}`,
      timestamp: now,
      actorName: currentUser?.name,
      actorRole: currentUser?.role,
      toStage: 'BD_INTAKE',
      action: 'Client submitted PIS via flowchart form',
      comments: notes.trim() || undefined,
     },
    ],
   };

   const createdRecord = await Promise.resolve(addPIS(newPIS) as any);
   setCreated((createdRecord as PISRecord) ?? newPIS);
   toast.success('PIS request submitted. Our team will take it forward.');
  } catch (err) {
   toast.error('Failed to create PIS');
  } finally {
   setIsCreating(false);
  }
 };

 const renderCreateForm = ({ showBackButton = false } = {}) => (
  <div className="space-y-6">
   <div className="flex items-center justify-between gap-3 flex-wrap">
    <div>
     <h1 className="text-2xl font-semibold tracking-tight">New PIS</h1>
     <p className="text-sm text-muted-foreground">
      Tell us what product you want to create and your preferences.
     </p>
    </div>
    {showBackButton ? (
     <Button
      variant="outline"
      onClick={() => {
       setShowCreateForm(false);
       reset();
      }}
     >
      Back to Requests
     </Button>
    ) : null}
   </div>

   <Card className="p-6 space-y-6">
    <form onSubmit={handleCreate} className="space-y-6">
     <div className="space-y-4">
      <div className="flex items-center justify-between">
       <div>
        <p className="text-sm font-medium">Step 1 – What do you want to create?</p>
        <p className="text-xs text-muted-foreground">First choose Skin Care or Hair Care, then the product type.</p>
       </div>
       <Badge variant="secondary">Start here</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Category</label>
        <Select
         value={productCategory}
         onValueChange={(val) => {
          const cast = val as ProductCategory;
          setProductCategory(cast);
          setProductType(PRODUCT_OPTIONS[cast][0]);
         }}
        >
         <SelectTrigger>
          <SelectValue placeholder="Select category" />
         </SelectTrigger>
         <SelectContent>
          <SelectItem value="SKIN">Skin Care</SelectItem>
          <SelectItem value="HAIR">Hair Care</SelectItem>
         </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
         Choose whether this brief is for Skin Care or Hair Care.
        </p>
       </div>

       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Product / Line</label>
        <Select value={productType} onValueChange={setProductType}>
         <SelectTrigger>
          <SelectValue placeholder="Select product" />
         </SelectTrigger>
         <SelectContent>
          {PRODUCT_OPTIONS[productCategory].map((opt) => (
           <SelectItem key={opt} value={opt}>
            {opt}
           </SelectItem>
          ))}
         </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
         For Skin Care choose Sunscreen, Moisturiser, Cleanser, Actives or Others.
         For Hair Care choose Shampoo, Conditioner, Actives or Others.
        </p>
       </div>

       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Pack Volume</label>
        <Input
         value={packVolume}
         onChange={(e) => setPackVolume(e.target.value)}
         placeholder="Example: 30 ml"
        />
        <p className="text-xs text-muted-foreground">
         Tell us the fill volume you want, for example 30 ml.
        </p>
       </div>
      </div>
     </div>

     <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
       <div>
        <p className="text-sm font-medium">Step 2 – Questions about your product</p>
        <p className="text-xs text-muted-foreground">Add any questions and your answers so we understand the brief.</p>
       </div>
       <Badge variant="outline">Optional but helpful</Badge>
      </div>

      <div className="rounded-lg border p-4 space-y-3 bg-muted/40">
       <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Dynamic Q&A</p>
        <Button type="button" size="sm" variant="outline" onClick={addQaItem}>
         Add question
        </Button>
       </div>
       <p className="text-xs text-muted-foreground">
        Use this section to capture any extra questions and answers that came up while discussing the brief.
       </p>
       {dynamicQa.map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start">
         <div className="md:col-span-3 space-y-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">Question</label>
          <Input
           value={item.question}
           onChange={(e) => updateQaItem(idx, 'question', e.target.value)}
           placeholder="e.g., SPF level / skin type"
          />
          <p className="text-xs text-muted-foreground">
           Type the question asked (for example SPF level, skin type, hair concern).
          </p>
         </div>
         <div className="md:col-span-3 space-y-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">Answer</label>
          <Textarea
           value={item.answer}
           onChange={(e) => updateQaItem(idx, 'answer', e.target.value)}
           placeholder="Client response"
           rows={2}
          />
          <p className="text-xs text-muted-foreground">
           Type your answer to this question in simple words.
          </p>
         </div>
         <div className="md:col-span-1 flex md:justify-end">
          <Button
           type="button"
           variant="ghost"
           disabled={dynamicQa.length === 1}
           onClick={() => removeQaItem(idx)}
          >
           Remove
          </Button>
         </div>
        </div>
       ))}
      </div>

      <div className="flex items-center justify-between pt-2">
       <div>
        <p className="text-sm font-medium">Step 3 – Ingredients & preferences</p>
        <p className="text-xs text-muted-foreground">Tell us what you want inside the formula and what to avoid.</p>
       </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Active ingredient selections</label>
        <Textarea
         value={activeIngredients}
         onChange={(e) => setActiveIngredients(e.target.value)}
         placeholder="List actives to include"
         rows={3}
        />
        <p className="text-xs text-muted-foreground">
         Write all active ingredients you would like us to use.
        </p>
       </div>
       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Avoid ingredients</label>
        <Textarea
         value={avoidIngredients}
         onChange={(e) => setAvoidIngredients(e.target.value)}
         placeholder="Allergens / exclusions"
         rows={3}
        />
        <p className="text-xs text-muted-foreground">
         List any ingredients you do not want in the formula (allergens, preferences, etc.).
        </p>
       </div>
      </div>

      <div className="space-y-2">
       <label className="text-xs font-medium uppercase text-muted-foreground">Other ingredients</label>
       <Textarea
        value={otherIngredients}
        onChange={(e) => setOtherIngredients(e.target.value)}
        placeholder="Base / carrier / additives"
        rows={3}
       />
       <p className="text-xs text-muted-foreground">
        Share any other ingredients or notes that are important for this product.
       </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Reference path</label>
        <Select value={referenceMode} onValueChange={(val) => setReferenceMode(val as ReferenceMode)}>
         <SelectTrigger>
          <SelectValue placeholder="Select" />
         </SelectTrigger>
         <SelectContent>
          <SelectItem value="RECOMMENDED">Recommended / Existing formulas</SelectItem>
          <SelectItem value="CUSTOM">Custom selection</SelectItem>
         </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
         Choose if you want us to work from our recommended / existing formulas or from your custom selections.
        </p>
       </div>
       <div className="space-y-2 sm:col-span-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Recommended / existing references</label>
        <Textarea
         value={referenceFormulas}
         onChange={(e) => setReferenceFormulas(e.target.value)}
         placeholder="Links or codes for recommended / existing formulas"
         rows={3}
        />
        <p className="text-xs text-muted-foreground">
         Add names, codes or links of any formulas or products you would like us to refer to.
        </p>
       </div>
      </div>

      <div className="space-y-2">
       <label className="text-xs font-medium uppercase text-muted-foreground">Custom selection notes</label>
       <Textarea
        value={customSelectionNotes}
        onChange={(e) => setCustomSelectionNotes(e.target.value)}
        placeholder="Capture decisions driven by avoid-ingredients / custom spec"
        rows={3}
       />
       <p className="text-xs text-muted-foreground">
        Explain how you chose the actives and any special requirements we should know.
       </p>
      </div>
     </div>

     {!isClient && (
      <div className="space-y-4 border-t pt-4">
       <div className="flex items-center justify-between">
        <div>
         <p className="text-sm font-medium">Internal project details</p>
         <p className="text-xs text-muted-foreground">Codes and owners for BD / R&D tracking.</p>
        </div>
        <Badge variant="outline">For internal use</Badge>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">Project Code</label>
         <Input
          value={projectCode}
          onChange={(e) => setProjectCode(e.target.value)}
          placeholder={effectivePisCode}
         />
         <p className="text-xs text-muted-foreground">Leave blank to auto-generate.</p>
        </div>

        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">Formulation Code *</label>
         <Input
          value={formulationCode}
          onChange={(e) => setFormulationCode(e.target.value)}
          placeholder="e.g., FORM-001"
          required
         />
        </div>

        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">Client Name</label>
         <Input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client"
         />
        </div>

        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">Brand</label>
         <Input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand"
         />
        </div>

        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">BD Owner</label>
         <Input
          value={bdOwner}
          onChange={(e) => setBdOwner(e.target.value)}
          placeholder="BD Manager"
         />
        </div>

        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">R&D Lead</label>
         <Input
          value={rdLead}
          onChange={(e) => setRdLead(e.target.value)}
          placeholder="R&D Lead"
         />
        </div>

        <div className="space-y-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">Date Initiated</label>
         <Input
          type="date"
          value={dateInitiated}
          onChange={(e) => setDateInitiated(e.target.value)}
         />
        </div>

        <div className="space-y-2 sm:col-span-2">
         <label className="text-xs font-medium uppercase text-muted-foreground">Internal notes</label>
         <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes for internal team…"
          rows={3}
         />
        </div>
       </div>
      </div>
     )}

     <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
       <div>
        <p className="text-sm font-medium">Step 4 – Packaging & artwork (optional)</p>
        <p className="text-xs text-muted-foreground">Share your preferred pack, mono carton and artwork details.</p>
       </div>
       <Badge variant="outline">Optional</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Packing</label>
        <Select
         value={packingOption}
         onValueChange={(val) => setPackingOption(val as PackOption)}
        >
         <SelectTrigger>
          <SelectValue placeholder="Existing or new" />
         </SelectTrigger>
         <SelectContent>
          <SelectItem value="EXISTING">Existing (show ref)</SelectItem>
          <SelectItem value="NEW">New ref upload</SelectItem>
         </SelectContent>
        </Select>
        {packingOption === 'EXISTING' ? (
         <Input
          className="mt-2"
          value={packingReference}
          onChange={(e) => setPackingReference(e.target.value)}
          placeholder="Existing pack reference"
         />
        ) : (
         <Input
          className="mt-2"
          value={packingUploadLink}
          onChange={(e) => setPackingUploadLink(e.target.value)}
          placeholder="Upload / link for new pack"
         />
        )}
        <p className="text-xs text-muted-foreground">
         Select an existing pack and share its reference, or upload / link a new pack you would like to use.
        </p>
       </div>

       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Mono carton</label>
        <Select
         value={monoCartonOption}
         onValueChange={(val) => setMonoCartonOption(val as PackOption)}
        >
         <SelectTrigger>
          <SelectValue placeholder="Existing or new" />
         </SelectTrigger>
         <SelectContent>
          <SelectItem value="EXISTING">Existing (show ref)</SelectItem>
          <SelectItem value="NEW">New ref upload</SelectItem>
         </SelectContent>
        </Select>
        {monoCartonOption === 'EXISTING' ? (
         <Input
          className="mt-2"
          value={monoCartonReference}
          onChange={(e) => setMonoCartonReference(e.target.value)}
          placeholder="Existing mono carton reference"
         />
        ) : (
         <Input
          className="mt-2"
          value={monoCartonUploadLink}
          onChange={(e) => setMonoCartonUploadLink(e.target.value)}
          placeholder="Upload / link for new mono carton"
         />
        )}
        <p className="text-xs text-muted-foreground">
         Tell us if you want to reuse an existing mono carton or share a new one.
        </p>
       </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border rounded-lg p-4 bg-muted/40">
       <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Artwork needed?</label>
        <Select value={artworkNeeded} onValueChange={(val) => setArtworkNeeded(val as ArtworkChoice)}>
         <SelectTrigger>
          <SelectValue placeholder="Yes / No" />
         </SelectTrigger>
         <SelectContent>
          <SelectItem value="YES">Yes</SelectItem>
          <SelectItem value="NO">No</SelectItem>
         </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
         Let us know if you need us to create or update artwork for this pack.
        </p>
       </div>

       {artworkNeeded === 'YES' ? (
        <>
         <div className="space-y-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">Artwork form</label>
          <Input
           value={artworkFormLink}
           onChange={(e) => setArtworkFormLink(e.target.value)}
           placeholder="Link or description of artwork form"
          />
          <p className="text-xs text-muted-foreground">
           Share the link or name of your artwork form, if you use one.
          </p>
         </div>
         <div className="space-y-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">Logo</label>
          <Select value={logoOption} onValueChange={(val) => setLogoOption(val as PackOption)}>
           <SelectTrigger>
            <SelectValue placeholder="Existing or new" />
           </SelectTrigger>
           <SelectContent>
            <SelectItem value="EXISTING">Existing reference</SelectItem>
            <SelectItem value="NEW">New upload</SelectItem>
           </SelectContent>
          </Select>
          {logoOption === 'EXISTING' ? (
           <Input
            className="mt-2"
            value={logoReference}
            onChange={(e) => setLogoReference(e.target.value)}
            placeholder="Existing logo reference"
           />
          ) : (
           <Input
            className="mt-2"
            value={logoUploadLink}
            onChange={(e) => setLogoUploadLink(e.target.value)}
            placeholder="Upload / link for new logo"
           />
          )}
          <p className="text-xs text-muted-foreground">
           Tell us which logo to use (existing reference) or share a new logo file / link.
          </p>
         </div>
        </>
       ) : (
        <div className="sm:col-span-2 flex items-center text-sm text-muted-foreground">
         Artwork not required for this request.
        </div>
       )}
      </div>
     </div>

     <div className="flex justify-end gap-2 pt-4 border-t">
      <Button type="submit" disabled={isCreating}>
       {isCreating ? 'Submitting…' : 'Submit PIS request'}
      </Button>
     </div>
    </form>
   </Card>
  </div>
 );

 // For BD_MANAGER: Show unassigned CLIENT-requested PIS records (unless creating new PIS)
 if (isBDManager && !created && !showCreateForm) {
  return (
   <div className="space-y-6">
    <div className="flex items-center justify-between gap-3 flex-wrap">
     <div>
      <h1 className="text-2xl font-semibold tracking-tight">New PIS Requests</h1>
      <p className="text-sm text-muted-foreground">
       PIS records requested by clients that need to be assigned to BD staff
      </p>
     </div>
     <Button onClick={() => setShowCreateForm(true)} className="gap-2" variant="outline">
      <Plus className="h-4 w-4" />
      Create New PIS
     </Button>
    </div>

    {unassignedClientPIS.length === 0 ? (
     <Card className="p-8 text-center">
      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-medium mb-2">No Unassigned Requests</h3>
      <p className="text-gray-600 mb-4">
       There are currently no PIS records requested by clients that need assignment.
      </p>
      <Button onClick={() => setShowCreateForm(true)} variant="outline" className="gap-2">
       <Plus className="h-4 w-4" />
       Create New PIS
      </Button>
     </Card>
    ) : (
     <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
       <h3 className="text-lg font-medium">Unassigned Client Requests</h3>
       <Badge variant="secondary">{unassignedClientPIS.length} pending</Badge>
      </div>
      <div className="space-y-3">
       {unassignedClientPIS.map((pis) => (
        <div
         key={pis.id}
         className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
        >
         <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
           <h4 className="font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => handleViewDetails(pis)}>
            {pis.pisCode}
           </h4>
           <Badge variant="outline">{pis.stage}</Badge>
           <Badge variant={pis.status === 'PENDING' ? 'secondary' : 'default'}>
            {pis.status}
           </Badge>
          </div>
          <p className="text-sm text-gray-700 mb-1">
           <span className="font-medium">Formulation:</span> {pis.formulation}
          </p>
          <p className="text-sm text-gray-600">
           <span className="font-medium">Customer:</span> {pis.customer}
          </p>
          {(pis as any).createdBy && (
           <p className="text-xs text-gray-500 mt-1">
            Requested by: {(pis as any).createdBy.firstName} {(pis as any).createdBy.lastName} ({(pis as any).createdBy.email})
           </p>
          )}
         </div>
         <div className="flex items-center gap-2">
          <Button
           variant="outline"
           size="sm"
           onClick={() => handleViewDetails(pis)}
           className="gap-2"
          >
           <Eye className="h-4 w-4" />
           View
          </Button>
          <Button
           size="sm"
           onClick={() => handleAssignToStaff(pis)}
           className="gap-2"
          >
           <UserPlus className="h-4 w-4" />
           Assign to BD Staff
          </Button>
         </div>
        </div>
       ))}
      </div>
     </Card>
    )}

    {/* Assign to BD Staff Dialog */}
    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
     <DialogContent className="max-w-xl">
      <DialogHeader>
       <DialogTitle>Assign to BD Staff</DialogTitle>
      </DialogHeader>
      {bdStaffUsers.length === 0 ? (
       <p className="text-gray-500 text-sm">
        No active BD Staff users found. Please create or activate BD Staff users first.
       </p>
      ) : (
       <div className="space-y-4 mt-2">
        <div className="space-y-2">
         <label className="text-sm font-medium">Select BD Staff Member</label>
         <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
          <SelectTrigger>
           <SelectValue placeholder="Choose a BD staff member..." />
          </SelectTrigger>
          <SelectContent>
           {bdStaffUsers.map((staff) => {
            const ongoingCount = pisRecords.filter(
             (p) =>
              p.assignedBdStaffId === staff.id &&
              (p.status === 'PENDING' || p.status === 'IN_PROGRESS')
            ).length;
            return (
             <SelectItem key={staff.id} value={staff.id}>
              <div className="flex items-center justify-between w-full">
               <span>{staff.name} ({staff.email})</span>
               {ongoingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                 {ongoingCount} ongoing
                </Badge>
               )}
              </div>
             </SelectItem>
            );
           })}
          </SelectContent>
         </Select>
        </div>
        {assignTargetPis && (
         <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Assigning PIS:</p>
          <p className="font-medium">{assignTargetPis.pisCode}</p>
          <p className="text-sm text-gray-600">{assignTargetPis.formulation}</p>
         </div>
        )}
        <div className="flex justify-end gap-2 pt-4">
         <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
          Cancel
         </Button>
         <Button onClick={handleConfirmAssign} disabled={!selectedStaffId}>
          Assign
         </Button>
        </div>
       </div>
      )}
     </DialogContent>
    </Dialog>

    {/* PIS Details Dialog */}
    <PISDetailsDialog
     pis={selectedPIS}
     currentRole={currentUser?.role || 'BD_MANAGER'}
     isOpen={isDetailsOpen}
     onClose={() => {
      setIsDetailsOpen(false);
      setTimeout(() => setSelectedPIS(null), 300);
     }}
    />
   </div>
  );
 }

 if (created) {
  return (
   <div className="space-y-6">
    <div className="flex items-center justify-between gap-3 flex-wrap">
     <div>
      <h1 className="text-2xl font-semibold tracking-tight">New PIS</h1>
      <p className="text-sm text-muted-foreground">
       Created: <span className="font-medium text-foreground">{created.pisCode}</span>
      </p>
     </div>
     <Button variant="outline" onClick={reset}>
      Create another
     </Button>
    </div>

    <StageTemplatesForm pis={created} disabled={false} />
   </div>
  );
 }

 return renderCreateForm({ showBackButton: isBDManager && showCreateForm });
}
