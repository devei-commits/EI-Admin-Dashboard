import { useEffect, useState } from 'react';
import { PISRecord, UserRole, Customer, Product } from '../types/pis';
import { getStageLabel } from '../utils/permissions';
import { usePIS } from '../context/PISContext';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
 Calendar,
 User,
 FileText,
 CheckCircle2,
 Clock,
 TrendingUp
} from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { StageTemplatesForm } from './StageTemplatesForm';
import { PISChat } from './PISChat';
import { getServerBaseUrl, pisApi, USE_MOCK_DATA } from '../utils/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

// Type definitions for internal use
interface ClientFormData {
 category: string;
 productType: string;
 dynamicQa: Array<{ question: string; answer: string }>;
 specs: {
  activeIngredients: string;
  avoidIngredients: string;
  otherIngredients: string;
  referenceMode: string;
  referenceFormulas: string;
  customSelectionNotes: string;
 };
 packCatalog: {
  volume: string;
  packing: { option: string; reference: string; uploadLink: string };
  monoCarton: { option: string; reference: string; uploadLink: string };
  artwork: {
   required: boolean;
   artworkFormLink: string;
   logo: { option: string; reference: string; uploadLink: string };
  };
 };
}

interface AttachmentData {
 id: string;
 fileName?: string;
 fileUrl?: string;
 description?: string;
 createdAt?: string;
 uploadedBy?: { name?: string };
 status?: string;
}

interface PISDetailsDialogProps {
 pis: PISRecord | null;
 currentRole: UserRole;
 isOpen: boolean;
 onClose: () => void;
 isEmbedded?: boolean;
}

export function PISDetailsDialog({ pis, currentRole, isOpen, onClose, isEmbedded = false }: PISDetailsDialogProps) {
 const serverBaseUrl = getServerBaseUrl();

 const { updatePIS, customers, products, currentUser } = usePIS();

 // All hooks must be called before any conditional returns
 const [isEditingClient, setIsEditingClient] = useState(false);
 const [customer, setCustomer] = useState(pis?.customer ?? '');
 const [formulation, setFormulation] = useState(pis?.formulation ?? '');
 const [costName, setCostName] = useState(pis?.costName ?? '');
 const [formLabel, setFormLabel] = useState(pis?.formLabel ?? '');
 const [clientForm, setClientForm] = useState<ClientFormData | null>(null);

 const [isDecisionOpen, setIsDecisionOpen] = useState(false);
 const [decisionTitle, setDecisionTitle] = useState('Confirm action');
 const [decisionDefault, setDecisionDefault] = useState('Action confirmed from details view');
 const [decisionMandatoryComment, setDecisionMandatoryComment] = useState(false);
 const [decisionValue, setDecisionValue] = useState('');
 const [decisionComments, setDecisionComments] = useState('');

 const [attachments, setAttachments] = useState<AttachmentData[]>([]);
 const [isAttachmentsLoading, setIsAttachmentsLoading] = useState(false);
 const [uploadFile, setUploadFile] = useState<File | null>(null);
 const [uploadDescription, setUploadDescription] = useState('');
 const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

 // Stage checklist state - moved here to ensure hooks are called unconditionally
 const [localChecklist, setLocalChecklist] = useState<Record<string, boolean>>({});
 const [checklistError, setChecklistError] = useState('');

 // Sync state when pis changes
 useEffect(() => {
  if (pis) {
   setCustomer(pis.customer);
   setFormulation(pis.formulation);
   setCostName(pis.costName);
   setFormLabel(pis.formLabel);
   setIsEditingClient(false);
  }
 }, [pis?.id, pis?.customer, pis?.formulation, pis?.costName, pis?.formLabel]);

 // Parse client form from stageTemplates
 useEffect(() => {
  if (!pis) {
   setClientForm(null);
   return;
  }

  const pisAny = pis as unknown as Record<string, unknown>;
  const stageTemplates = pisAny.stageTemplates as unknown as Record<string, unknown> | undefined;
  const s0 = stageTemplates?.S0 as unknown as Record<string, unknown> | undefined;
  const raw = s0?.newFormulationFlow as unknown as Record<string, unknown> | undefined;

  if (raw) {
   const specs = raw.specs as unknown as Record<string, unknown> | undefined;
   const packCatalog = raw.packCatalog as unknown as Record<string, unknown> | undefined;
   const packing = packCatalog?.packing as unknown as Record<string, unknown> | undefined;
   const monoCarton = packCatalog?.monoCarton as unknown as Record<string, unknown> | undefined;
   const artwork = packCatalog?.artwork as unknown as Record<string, unknown> | undefined;
   const logo = artwork?.logo as unknown as Record<string, unknown> | undefined;

   const safe: ClientFormData = {
    category: String(raw.category || ''),
    productType: String(raw.productType || ''),
    dynamicQa:
     Array.isArray(raw.dynamicQa) && raw.dynamicQa.length
      ? (raw.dynamicQa as Array<{ question: string; answer: string }>)
      : [{ question: '', answer: '' }],
    specs: {
     activeIngredients: String(specs?.activeIngredients || ''),
     avoidIngredients: String(specs?.avoidIngredients || ''),
     otherIngredients: String(specs?.otherIngredients || ''),
     referenceMode: String(specs?.referenceMode || 'RECOMMENDED'),
     referenceFormulas: String(specs?.referenceFormulas || ''),
     customSelectionNotes: String(specs?.customSelectionNotes || ''),
    },
    packCatalog: {
     volume: String(packCatalog?.volume || ''),
     packing: {
      option: String(packing?.option || 'EXISTING'),
      reference: String(packing?.reference || ''),
      uploadLink: String(packing?.uploadLink || ''),
     },
     monoCarton: {
      option: String(monoCarton?.option || 'EXISTING'),
      reference: String(monoCarton?.reference || ''),
      uploadLink: String(monoCarton?.uploadLink || ''),
     },
     artwork: {
      required:
       typeof artwork?.required === 'boolean'
        ? artwork.required
        : true,
      artworkFormLink: String(artwork?.artworkFormLink || ''),
      logo: {
       option: String(logo?.option || 'EXISTING'),
       reference: String(logo?.reference || ''),
       uploadLink: String(logo?.uploadLink || ''),
      },
     },
    },
   };
   setClientForm(safe);
  } else {
   setClientForm(null);
  }
 }, [pis?.id]);

 const fetchAttachments = async () => {
  if (!pis) return;

  // Skip API call in mock data mode
  if (USE_MOCK_DATA) {
   setAttachments([]);
   return;
  }

  try {
   setIsAttachmentsLoading(true);
   const resp = await pisApi.listAttachments(pis.id);
   if (resp.success && resp.data) {
    setAttachments(resp.data as AttachmentData[]);
   }
  } catch (e: unknown) {
   toast.error('Failed to load attachments');
  } finally {
   setIsAttachmentsLoading(false);
  }
 };

 useEffect(() => {
  void fetchAttachments();
  setUploadFile(null);
  setUploadDescription('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [pis?.id]);

 // Sync checklist state based on pis stage
 useEffect(() => {
  if (!pis) {
   setLocalChecklist({});
   return;
  }

  // Get the checklist key based on stage
  let checklistKey: string | null = null;
  switch (pis.stage) {
   case 'BD_INTAKE':
    checklistKey = 'bdIntakeChecklist';
    break;
   case 'RND_DEVELOPMENT':
    checklistKey = 'rndDevelopmentChecklist';
    break;
   case 'QUALITY_REVIEW':
    checklistKey = 'qaChecklist';
    break;
   case 'PACKAGING':
    checklistKey = 'packagingChecklist';
    break;
   default:
    checklistKey = null;
  }

  if (!checklistKey) {
   setLocalChecklist({});
   return;
  }

  const pisAny = pis as unknown as Record<string, unknown>;
  const existing = (pisAny[checklistKey] as Record<string, boolean>) || {};
  setLocalChecklist(existing);
 }, [pis?.id, pis?.stage]);

 // Early return after all hooks
 if (!pis) return null;

 // Computed values - must be after hooks but can be before/after early return
 const canEditClientDetails = currentRole === 'BD_MANAGER' || currentRole === 'BD_STAFF';
 const canEditFormFields =
  currentRole === 'BD_MANAGER' ||
  currentRole === 'BD_STAFF' ||
  currentRole === 'RND_LEAD' ||
  currentRole === 'RND_STAFF';

 const isTerminated = pis.status === 'TERMINATED' || pis.stage === 'TERMINATED';

 const resolvedCustomer: Customer | undefined =
  pis.customerId ? customers.find((c: Customer) => c.id === pis.customerId) : undefined;

 const resolvedProduct: Product | undefined =
  pis.productCode ? products.find((p: Product) => p.code === pis.productCode) : undefined;

 const getAssignedSummary = () => {
  const parts: string[] = [];
  const pisRecord = pis as unknown as Record<string, unknown>;
  if (pisRecord.assignedBdStaffId) {
   parts.push('BD Staff assigned');
  }
  if (pisRecord.rndStaffAssignment) {
   parts.push('R&D Staff assigned');
  }
  if (pisRecord.qaAssignment) {
   parts.push('QA Staff assigned');
  }
  if (
   pisRecord.pkgDesignAssignment ||
   pisRecord.pkgProductSubmission ||
   pisRecord.pkgLabelSubmission ||
   pisRecord.sampleDispatchPreparation
  ) {
   parts.push('Packaging tasks assigned');
  }
  if (!parts.length) return 'No internal assignments recorded yet';
  return parts.join(' • ');
 };

 const getStatusBadge = (status: string | undefined) => {
  if (!status) {
   return (
    <Badge className="bg-gray-100 text-gray-800">
     Unknown
    </Badge>
   );
  }
  const variants: Record<string, string> = {
   IN_PROGRESS: 'bg-blue-100 text-blue-800',
   PENDING: 'bg-yellow-100 text-yellow-800',
   APPROVED: 'bg-green-100 text-green-800',
   REJECTED: 'bg-red-100 text-red-800',
   COMPLETED: 'bg-green-100 text-green-800',
   TERMINATED: 'bg-gray-100 text-gray-800',
  };

  return (
   <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
    {status.replace('_', ' ')}
   </Badge>
  );
 };

 const formatTimestamp = (value: unknown) => {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
 };

 const formatDate = (value: unknown) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
 };

 const canClientUpload = currentRole === 'CLIENT';
 const canClientConfirm = currentRole === 'CLIENT';

 const handleClientUpload = async () => {
  if (!uploadFile) {
   toast.error('Please choose a file');
   return;
  }

  try {
   setIsUploadingAttachment(true);
   await pisApi.uploadClientAttachment(pis.id, uploadFile, uploadDescription || undefined);
   toast.success('Upload submitted for approval');
   setUploadFile(null);
   setUploadDescription('');
   await fetchAttachments();
  } catch (e: any) {
   toast.error(e?.message || 'Upload failed');
  } finally {
   setIsUploadingAttachment(false);
  }
 };

 const handleConfirmMilestone = async (
  milestone: 'BRIEF_ACCEPTED' | 'SAMPLE_RECEIVED' | 'ARTWORK_APPROVED'
 ) => {
  try {
   await pisApi.confirmClientMilestone(pis.id, milestone);
   toast.success('Confirmation recorded');
  } catch (e: any) {
   toast.error(e?.message || 'Failed to confirm');
  }
 };

 const historyEntries = (pis.history ?? [])
  .slice()
  .sort((a, b) => {
   const at = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(String(a.timestamp)).getTime();
   const bt = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(String(b.timestamp)).getTime();
   return bt - at;
  });

 const clientBriefEntry = historyEntries.find(
  (entry) => entry.action === 'Client submitted new PIS brief'
 );

 const getChecklistConfig = () => {
  switch (pis.stage) {
   case 'BD_INTAKE':
    return {
     key: 'bdIntakeChecklist' as const,
     items: [
      { key: 'clientBriefCaptured', label: 'Client brief captured' },
      { key: 'pricingFeasibilityChecked', label: 'Pricing feasibility checked' },
      { key: 'clientTimelineAligned', label: 'Client timeline aligned' },
     ],
    };
   case 'RND_DEVELOPMENT':
    return {
     key: 'rndDevelopmentChecklist' as const,
     items: [
      { key: 'formulationPrototypeReady', label: 'Formulation prototype ready' },
      { key: 'stabilityPlanDefined', label: 'Stability plan defined' },
      { key: 'regulatoryImpactReviewed', label: 'Regulatory impact reviewed' },
     ],
    };
   case 'QUALITY_REVIEW':
    return {
     key: 'qaChecklist' as const,
     items: [
      { key: 'labResultsReviewed', label: 'Lab results reviewed' },
      { key: 'labelClaimsVerified', label: 'Label/claims verified' },
     ],
    };
   case 'PACKAGING':
    return {
     key: 'packagingChecklist' as const,
     items: [
      { key: 'artworkApproved', label: 'Artwork approved' },
      { key: 'componentsConfirmed', label: 'Components/packaging confirmed' },
     ],
    };
   default:
    return null;
  }
 };

 const checklistConfig = getChecklistConfig();

 const getEffectiveChecklist = () => {
  if (!checklistConfig) return {} as unknown as Record<string, unknown>;
  const { key } = checklistConfig;
  const pisAny = pis as unknown as Record<string, unknown>;
  const fromRecord = (pisAny[key] as Record<string, boolean>) || {};
  return { ...fromRecord, ...localChecklist } as unknown as Record<string, unknown>;
 };

 const isChecklistCompleteForStage = (): boolean => {
  if (!checklistConfig) return true;
  const { items } = checklistConfig;
  const checklist = getEffectiveChecklist();
  return items.every((item) => Boolean(checklist[item.key]));
 };

 const toggleChecklistItem = (itemKey: string, value: boolean) => {
  if (!checklistConfig) return;
  const { key } = checklistConfig;
  const updatedLocal = { ...localChecklist, [itemKey]: value };
  setLocalChecklist(updatedLocal);
  updatePIS(pis.id, { [key]: updatedLocal } as Partial<PISRecord>);

  if (isChecklistCompleteForStage()) {
   setChecklistError('');
  }
 };

 const handleTakeAction = async (decision?: string, comments?: string) => {
  if (!isChecklistCompleteForStage()) {
   setChecklistError('Please complete the stage checklist before taking action.');
   return;
  }
  setChecklistError('');
  // Actor info - stored for future history tracking
  const _actorName = currentUser?.name;
  const _actorRole = currentUser?.role ?? currentRole;
  const _now = new Date();
  void _actorName; void _actorRole; void _now; // Suppress unused warnings

  const taskTypeForRole = (role: UserRole): 'BD' | 'RND' | 'QA' | 'PKG' | null => {
   if (role === 'BD_MANAGER' || role === 'BD_STAFF') return 'BD';
   if (role === 'RND_LEAD' || role === 'RND_STAFF') return 'RND';
   if (role === 'QA_MANAGER' || role === 'QA_STAFF') return 'QA';
   if (role === 'PKG_STAFF') return 'PKG';
   return null;
  };

  const taskType = currentRole ? taskTypeForRole(currentRole) : null;
  // Special handling: Way Forward decisions use dedicated endpoint
  if (pis.stage === 'WAY_FORWARD' && taskType === 'BD') {
   const wfDecision: 'PROCEED' | 'HOLD' | 'DROP' =
    decision && (['PROCEED', 'HOLD', 'DROP'] as const).includes(decision.toUpperCase() as any)
     ? (decision.toUpperCase() as 'PROCEED' | 'HOLD' | 'DROP')
     : 'PROCEED';
   try {
    const response = await pisApi.makeWayForwardDecision(pis.id, wfDecision, comments);
    if (response.success && response.data) {
     await /* getPISById */ (pis.id);
    }
   } catch (error) {
   }
   return;
  }

  // Otherwise, decide target stage based on current stage and role, then
  // delegate the actual transition to the backend via pisApi.transitionStage.
  let toStage: string | null = null;

  if (taskType === 'BD') {
   if (pis.stage === 'BD_INTAKE') {
    toStage = 'RND_LEAD_REVIEW';
   } else if (pis.stage === 'ALIGNMENT') {
    toStage = 'RND_DEVELOPMENT';
   } else if (pis.stage === 'CLIENT_FEEDBACK') {
    toStage = 'COMPLETED';
   }
  } else if (taskType === 'RND') {
   if (currentRole === 'RND_LEAD' && pis.stage === 'RND_LEAD_REVIEW') {
    toStage = 'ALIGNMENT';
   } else if (pis.stage === ('RND_DEVELOPMENT' as any)) {
    toStage = 'QUALITY_REVIEW';
   } else if (pis.stage === 'QUALITY_REVIEW') {
    toStage = 'RND_DEVELOPMENT';
   } else if (currentRole === 'RND_LEAD' && pis.stage === ('RND_DEVELOPMENT' as any)) {
    toStage = 'QUALITY_REVIEW';
   } else if (currentRole === 'RND_STAFF' && pis.stage === ('RND_DEVELOPMENT' as any)) {
    toStage = 'RND_DEVELOPMENT';
   }
  } else if (taskType === 'QA') {
   if (pis.stage === 'QUALITY_REVIEW') {
    toStage = 'PACKAGING';
   }
  } else if (taskType === 'PKG') {
   if (pis.stage === 'PACKAGING') {
    toStage = 'SAMPLE_DISPATCH';
   } else if (pis.stage === 'SAMPLE_DISPATCH') {
    toStage = 'CLIENT_FEEDBACK';
   }
  }

  // Fallback: if no explicit mapping, keep stage but allow status progression
  if (!toStage) {
   toStage = pis.stage;
  }

  const effectiveDecision: 'APPROVED' | 'REJECTED' = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';

  try {
   const response = await pisApi.transitionStage(pis.id, toStage, effectiveDecision, comments);
   if (response.success && response.data) {
    // Let context converter refresh this record (history, stage, status, etc.)
    const updated = await /* getPISById */ (pis.id);
    if (updated) {
     // Optionally ensure local state aligns immediately
     await updatePIS(pis.id, {});
    }
   }
  } catch (error) {
  }
 };

 const openDecisionDialog = () => {
  if (!isChecklistCompleteForStage()) {
   setChecklistError('Please complete the stage checklist before taking action.');
   return;
  }
  setChecklistError('');
  // Simple generic defaults; user can overwrite in the dialog
  const defaultText = 'Action confirmed from details view';
  // Title and defaults vary for Way Forward vs normal transitions
  const isWayForward = pis.stage === 'WAY_FORWARD';
  setDecisionTitle(isWayForward ? 'Way Forward decision' : 'Confirm action on PIS');
  // Stage-specific default decision templates
  let stageDecision = defaultText;
  const taskTypeForRole = (role: UserRole): 'BD' | 'RND' | 'QA' | 'PKG' | null => {
   if (role === 'BD_MANAGER' || role === 'BD_STAFF') return 'BD';
   if (role === 'RND_LEAD' || role === 'RND_STAFF') return 'RND';
   if (role === 'QA_MANAGER' || role === 'QA_STAFF') return 'QA';
   if (role === 'PKG_STAFF') return 'PKG';
   return null;
  };

  const taskType = currentRole ? taskTypeForRole(currentRole) : null;

  if (taskType === 'BD' && pis.stage === 'BD_INTAKE') {
   stageDecision = 'Validated client data; moved to R&D Lead review';
  } else if (taskType === 'BD' && pis.stage === 'ALIGNMENT') {
   stageDecision = 'WFP approved; sent to R&D for development';
  } else if (taskType === 'BD' && pis.stage === 'CLIENT_FEEDBACK') {
   stageDecision = 'Client approved; PIS completed';
  } else if (taskType === 'RND' && pis.stage === ('RND_DEVELOPMENT' as any)) {
   stageDecision = 'Development complete; moved to R&D approval & timeline';
  } else if (taskType === 'RND' && pis.stage === 'QUALITY_REVIEW') {
   stageDecision = 'Sample submitted for R&D review';
  } else if (taskType === 'RND' && pis.stage === ('RND_DEVELOPMENT' as any)) {
   stageDecision = currentRole === 'RND_LEAD'
    ? 'Sample review approved; sent to QA for quality review'
    : 'Corrections updated and resubmitted for review';
  } else if (taskType === 'QA' && pis.stage === 'QUALITY_REVIEW') {
   stageDecision = 'Quality approved; moved to packaging';
  } else if (taskType === 'PKG' && pis.stage === 'PACKAGING') {
   stageDecision = 'Packaging finalized; moved to sample dispatch';
  } else if (taskType === 'PKG' && pis.stage === 'SAMPLE_DISPATCH') {
   stageDecision = 'Sample dispatched; awaiting client feedback';
  }

  setDecisionDefault(stageDecision);
  // For Way Forward HOLD/DROP we want comments, but we enforce that
  // inside the dialog handler when the choice is made.
  setDecisionMandatoryComment(false);
  setDecisionValue(isWayForward ? 'PROCEED' : stageDecision);
  setDecisionComments('');
  setIsDecisionOpen(true);
 };

 // Content that's shared between embedded and dialog modes
 const renderContent = () => (
  <div className="space-y-6">
   {/* Header Info */}
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <Card className="p-4">
     <div className="flex items-center gap-2 mb-2">
      <FileText className="h-5 w-5 text-blue-600" />
      <span className="text-sm text-gray-600">PIS Code</span>
     </div>
     <p className="font-medium">{pis.pisCode}</p>
    </Card>

    <Card className="p-4">
     <div className="flex items-center gap-2 mb-2">
      <User className="h-5 w-5 text-blue-600" />
      <span className="text-sm text-gray-600">Customer</span>
     </div>
     <p className="font-medium">
      {resolvedCustomer ? resolvedCustomer.company : pis.customer}
     </p>
    </Card>

    <Card className="p-4">
     <div className="flex items-center gap-2 mb-2">
      <TrendingUp className="h-5 w-5 text-blue-600" />
      <span className="text-sm text-gray-600">Current Stage</span>
     </div>
     <Badge variant="outline">{getStageLabel(pis.stage)}</Badge>
    </Card>

    <Card className="p-4">
     <div className="flex items-center gap-2 mb-2">
      <CheckCircle2 className="h-5 w-5 text-blue-600" />
      <span className="text-sm text-gray-600">Status</span>
     </div>
     <div className="flex items-center gap-2 flex-wrap">
      {getStatusBadge(pis.status)}
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-50 text-slate-900 border border-gray-100">
       Loops: {pis.loopCount ?? 0}
      </span>
     </div>
    </Card>
   </div>

   {/* Tabs */}
   <Tabs defaultValue="overview" className="w-full">
    <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 gap-1">
     <TabsTrigger value="overview">Overview</TabsTrigger>
     <TabsTrigger value="team">Team</TabsTrigger>
     <TabsTrigger value="documentation">Docs</TabsTrigger>
     <TabsTrigger value="timeline">Timeline</TabsTrigger>
     <TabsTrigger value="history">History</TabsTrigger>
     <TabsTrigger value="attachments">Attachments</TabsTrigger>
     <TabsTrigger value="chat">Chat</TabsTrigger>
     <TabsTrigger value="stageForm">Stage</TabsTrigger>
    </TabsList>

    <TabsContent value="overview" className="space-y-4">
     <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
       <h3 className="font-medium">Basic Information</h3>
       {canEditClientDetails && !isEditingClient && (
        <Button
         variant="outline"
         size="sm"
         onClick={() => setIsEditingClient(true)}
        >
         Edit client brief
        </Button>
       )}
      </div>

      <div className="space-y-4">
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <p className="text-sm text-gray-600">Customer</p>
         {canEditClientDetails && isEditingClient ? (
          <Input
           value={customer}
           onChange={(e) => setCustomer(e.target.value)}
          />
         ) : (
          <p className="font-medium">
           {resolvedCustomer ? resolvedCustomer.company : pis.customer}
          </p>
         )}
        </div>
        <div>
         <p className="text-sm text-gray-600">Formulation Code</p>
         {canEditClientDetails && isEditingClient ? (
          <Input
           value={formulation}
           onChange={(e) => setFormulation(e.target.value)}
          />
         ) : (
          <p className="font-medium">
           {resolvedProduct ? resolvedProduct.code : pis.formulation}
          </p>
         )}
        </div>
        <div>
         <p className="text-sm text-gray-600">Cost Name</p>
         {canEditClientDetails && isEditingClient ? (
          <Input
           value={costName}
           onChange={(e) => setCostName(e.target.value)}
          />
         ) : (
          <p className="font-medium">
           {resolvedProduct ? resolvedProduct.name : pis.costName}
          </p>
         )}
        </div>
        <div>
         <p className="text-sm text-gray-600">Form Label</p>
         {canEditClientDetails && isEditingClient ? (
          <Input
           value={formLabel}
           onChange={(e) => setFormLabel(e.target.value)}
          />
         ) : (
          <p className="font-medium">{pis.formLabel}</p>
         )}
        </div>
        <div>
         <p className="text-sm text-gray-600">R&D Staff</p>
         <p className="font-medium">{pis.rdStaff}</p>
        </div>
       </div>

       {/* Full client form (StageTemplates S0) for BD Manager */}
       {(pis as any).stageTemplates?.S0?.newFormulationFlow && (
        <div className="mt-4 border-t pt-4 space-y-3">
         <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Client PIS Form (New Formulations)</p>
          <p className="text-xs text-muted-foreground">Captured from the client-facing PIS request form.</p>
         </div>
         {isEditingClient && clientForm ? (
          <div className="space-y-4 text-sm">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
             <p className="text-xs text-muted-foreground mb-1">Category</p>
             <Input
              value={clientForm.category}
              onChange={(e) =>
               setClientForm({ ...clientForm, category: e.target.value })
              }
             />
            </div>
            <div>
             <p className="text-xs text-muted-foreground mb-1">Product / Line</p>
             <Input
              value={clientForm.productType}
              onChange={(e) =>
               setClientForm({ ...clientForm, productType: e.target.value })
              }
             />
            </div>
            <div>
             <p className="text-xs text-muted-foreground mb-1">Pack Volume</p>
             <Input
              value={clientForm.packCatalog?.volume || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 volume: e.target.value,
                },
               })
              }
             />
            </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
             <p className="text-xs text-muted-foreground mb-1">Active ingredients</p>
             <Textarea
              rows={3}
              value={clientForm.specs?.activeIngredients || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                specs: {
                 ...clientForm.specs,
                 activeIngredients: e.target.value,
                },
               })
              }
             />
            </div>
            <div>
             <p className="text-xs text-muted-foreground mb-1">Avoid ingredients</p>
             <Textarea
              rows={3}
              value={clientForm.specs?.avoidIngredients || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                specs: {
                 ...clientForm.specs,
                 avoidIngredients: e.target.value,
                },
               })
              }
             />
            </div>
            <div>
             <p className="text-xs text-muted-foreground mb-1">Other ingredients / notes</p>
             <Textarea
              rows={3}
              value={clientForm.specs?.otherIngredients || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                specs: {
                 ...clientForm.specs,
                 otherIngredients: e.target.value,
                },
               })
              }
             />
            </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
             <p className="text-xs text-muted-foreground mb-1">Reference path</p>
             <Input
              value={clientForm.specs?.referenceMode || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                specs: {
                 ...clientForm.specs,
                 referenceMode: e.target.value,
                },
               })
              }
             />
            </div>
            <div>
             <p className="text-xs text-muted-foreground mb-1">Reference formulas / products</p>
             <Textarea
              rows={3}
              value={clientForm.specs?.referenceFormulas || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                specs: {
                 ...clientForm.specs,
                 referenceFormulas: e.target.value,
                },
               })
              }
             />
            </div>
            <div>
             <p className="text-xs text-muted-foreground mb-1">Custom selection notes</p>
             <Textarea
              rows={3}
              value={clientForm.specs?.customSelectionNotes || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                specs: {
                 ...clientForm.specs,
                 customSelectionNotes: e.target.value,
                },
               })
              }
             />
            </div>
           </div>

           <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Client questions and answers</p>
            {clientForm.dynamicQa?.map((qa: any, index: number) => (
             <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
               placeholder="Question"
               value={qa.question}
               onChange={(e) => {
                const next = [...clientForm.dynamicQa];
                next[index] = { ...next[index], question: e.target.value };
                setClientForm({ ...clientForm, dynamicQa: next });
               }}
              />
              <div className="flex gap-2">
               <Textarea
                className="flex-1"
                rows={2}
                placeholder="Client's answer"
                value={qa.answer}
                onChange={(e) => {
                 const next = [...clientForm.dynamicQa];
                 next[index] = { ...next[index], answer: e.target.value };
                 setClientForm({ ...clientForm, dynamicQa: next });
                }}
               />
               <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                 if (clientForm.dynamicQa.length === 1) return;
                 const next = clientForm.dynamicQa.filter((_: any, i: number) => i !== index);
                 setClientForm({ ...clientForm, dynamicQa: next });
                }}
               >
                ×
               </Button>
              </div>
             </div>
            ))}
            <Button
             type="button"
             variant="outline"
             size="sm"
             onClick={() => {
              const next = [...(clientForm.dynamicQa || [])];
              next.push({ question: '', answer: '' });
              setClientForm({ ...clientForm, dynamicQa: next });
             }}
            >
             Add question
            </Button>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
             <p className="text-xs text-muted-foreground mb-1">Packing</p>
             <Input
              placeholder="Existing or new packing notes"
              value={clientForm.packCatalog?.packing?.reference || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 packing: {
                  ...clientForm.packCatalog?.packing,
                  reference: e.target.value,
                 },
                },
               })
              }
             />
             <Input
              placeholder="Packing artwork / dieline link (if any)"
              value={clientForm.packCatalog?.packing?.uploadLink || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 packing: {
                  ...clientForm.packCatalog?.packing,
                  uploadLink: e.target.value,
                 },
                },
               })
              }
             />
            </div>
            <div className="space-y-2">
             <p className="text-xs text-muted-foreground mb-1">Mono carton</p>
             <Input
              placeholder="Existing or new mono carton notes"
              value={clientForm.packCatalog?.monoCarton?.reference || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 monoCarton: {
                  ...clientForm.packCatalog?.monoCarton,
                  reference: e.target.value,
                 },
                },
               })
              }
             />
             <Input
              placeholder="Mono carton artwork / dieline link (if any)"
              value={clientForm.packCatalog?.monoCarton?.uploadLink || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 monoCarton: {
                  ...clientForm.packCatalog?.monoCarton,
                  uploadLink: e.target.value,
                 },
                },
               })
              }
             />
            </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
             <p className="text-xs text-muted-foreground mb-1">Artwork form / template link</p>
             <Input
              value={clientForm.packCatalog?.artwork?.artworkFormLink || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 artwork: {
                  ...clientForm.packCatalog?.artwork,
                  artworkFormLink: e.target.value,
                 },
                },
               })
              }
             />
            </div>
            <div className="space-y-2">
             <p className="text-xs text-muted-foreground mb-1">Logo reference / files</p>
             <Input
              placeholder="How the client shared or wants to share logo"
              value={clientForm.packCatalog?.artwork?.logo?.reference || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 artwork: {
                  ...clientForm.packCatalog?.artwork,
                  logo: {
                   ...clientForm.packCatalog?.artwork?.logo,
                   reference: e.target.value,
                  },
                 },
                },
               })
              }
             />
             <Input
              placeholder="Link to logo files (if any)"
              value={clientForm.packCatalog?.artwork?.logo?.uploadLink || ''}
              onChange={(e) =>
               setClientForm({
                ...clientForm,
                packCatalog: {
                 ...clientForm.packCatalog,
                 artwork: {
                  ...clientForm.packCatalog?.artwork,
                  logo: {
                   ...clientForm.packCatalog?.artwork?.logo,
                   uploadLink: e.target.value,
                  },
                 },
                },
               })
              }
             />
            </div>
           </div>
          </div>
         ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
           <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="font-medium">
             {(pis as any).stageTemplates.S0.newFormulationFlow.category}
            </p>
           </div>
           <div>
            <p className="text-xs text-muted-foreground">Product / Line</p>
            <p className="font-medium">
             {(pis as any).stageTemplates.S0.newFormulationFlow.productType}
            </p>
           </div>
           <div>
            <p className="text-xs text-muted-foreground">Pack Volume</p>
            <p className="font-medium">
             {(pis as any).stageTemplates.S0.newFormulationFlow.packCatalog?.volume}
            </p>
           </div>
           <div>
            <p className="text-xs text-muted-foreground">Active ingredients</p>
            <p className="font-medium whitespace-pre-line">
             {(pis as any).stageTemplates.S0.newFormulationFlow.specs?.activeIngredients}
            </p>
           </div>
           <div>
            <p className="text-xs text-muted-foreground">Avoid ingredients</p>
            <p className="font-medium whitespace-pre-line">
             {(pis as any).stageTemplates.S0.newFormulationFlow.specs?.avoidIngredients}
            </p>
           </div>
           <div>
            <p className="text-xs text-muted-foreground">Other ingredients / notes</p>
            <p className="font-medium whitespace-pre-line">
             {(pis as any).stageTemplates.S0.newFormulationFlow.specs?.otherIngredients}
            </p>
           </div>
          </div>
         )}
        </div>
       )}

       {canEditClientDetails && isEditingClient && (
        <div className="flex justify-end gap-2 mt-4">
         <Button
          variant="outline"
          size="sm"
          onClick={() => {
           setCustomer(pis.customer);
           setFormulation(pis.formulation);
           setCostName(pis.costName);
           setFormLabel(pis.formLabel);
           const raw: any = (pis as any).stageTemplates?.S0?.newFormulationFlow;
           if (raw) {
            setClientForm({ ...raw });
           }
           setIsEditingClient(false);
          }}
         >
          Cancel
         </Button>
         <Button
          size="sm"
          onClick={() => {
           const existingTemplates: any = (pis as any).stageTemplates || {};
           const nextStageTemplates = clientForm
            ? {
             ...existingTemplates,
             S0: {
              ...(existingTemplates.S0 || {}),
              newFormulationFlow: clientForm,
             },
            }
            : existingTemplates;

           const payload: any = {
            customer,
            formulation,
            costName,
            formLabel,
           };
           if (clientForm) {
            payload.stageTemplates = nextStageTemplates;
           }

           updatePIS(pis.id, payload);
           setIsEditingClient(false);
          }}
         >
          Save changes
         </Button>
        </div>
       )}
      </div>
     </Card>
     <Card className="p-4">
      <h3 className="font-medium mb-3">Assignments &amp; Order</h3>
      <div className="space-y-1 text-sm text-gray-700">
       <p>{getAssignedSummary()}</p>
       {pis.convertedToOrder && pis.orderReference && (
        <p>
         Order Reference:{' '}
         <span className="font-medium">{pis.orderReference}</span>
        </p>
       )}
      </div>
     </Card>

     {clientBriefEntry && (
      <Card className="p-4">
       <h3 className="font-medium mb-3">Client Submitted Brief</h3>
       <p className="text-xs text-gray-500 mb-2">
        Captured from the Client PIS form submission.
       </p>
       <div className="rounded-md border bg-gray-50 p-3 max-h-40 overflow-y-auto">
        <p className="text-sm whitespace-pre-wrap text-gray-800">
         {clientBriefEntry.comments || clientBriefEntry.decision}
        </p>
       </div>
      </Card>
     )}

     {checklistError && (
      <p className="text-sm text-red-600 px-1">{checklistError}</p>
     )}

     {checklistConfig && (
      <Card className="p-4">
       <h3 className="font-medium mb-3">Stage Checklist</h3>
       <p className="text-xs text-gray-500 mb-2">
        Complete all items before applying Take Action for this stage.
       </p>
       <div className="space-y-2">
        {checklistConfig.items.map((item) => {
         const checklist = getEffectiveChecklist();
         const checked = Boolean(checklist[item.key]);
         return (
          <label
           key={item.key}
           className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
          >
           <Checkbox
            checked={checked}
            onCheckedChange={(v) =>
             toggleChecklistItem(item.key, Boolean(v))
            }
           />
           <span>{item.label}</span>
          </label>
         );
        })}
       </div>
      </Card>
     )}

     <Card className="p-4">
      <h3 className="font-medium mb-4">Progress Indicators</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
       <ProgressIndicator label="M1" completed={pis.m1} />
       <ProgressIndicator label="V1" completed={pis.v1} />
       <ProgressIndicator label="R&D1" completed={pis.rdO1} />
       <ProgressIndicator label="Regulatory" completed={pis.regulatory} />
       <ProgressIndicator label="Inventory" completed={pis.inventory} />
       <ProgressIndicator label="SOP" completed={pis.sop} />
       <ProgressIndicator label="AC" completed={pis.ac} />
       <ProgressIndicator label="OC" completed={pis.oc} />
       <ProgressIndicator label="MOP" completed={pis.mop} />
       <ProgressIndicator label="COA" completed={pis.coa} />
       <ProgressIndicator label="PRE" completed={pis.pre} />
       <ProgressIndicator label="Stability" completed={pis.stabilityMatch} />
       <ProgressIndicator label="PRS" completed={pis.prs} />
       <ProgressIndicator label="Sensory" completed={pis.sensory} />
      </div>
     </Card>
    </TabsContent>

    <TabsContent value="team" className="space-y-4">
     <Card className="p-4">
      <h3 className="font-medium mb-4">Team Assignments</h3>
      <div className="space-y-3">
       <AssignmentRow label="BD Team" value={pis.bdTeam} />
       <AssignmentRow label="R&D Lead" value={pis.rndLeadAssignment} />
       <AssignmentRow label="R&D Staff" value={pis.rndStaffAssignment} />
       <AssignmentRow label="QA Team" value={pis.qaAssignment} />
       <AssignmentRow label="Packaging Design" value={pis.pkgDesignAssignment} />
       <AssignmentRow label="Sample Preparation" value={pis.sampleDispatchPreparation} />
      </div>
     </Card>
    </TabsContent>

    <TabsContent value="documentation" className="space-y-4">
     <Card className="p-4">
      <h3 className="font-medium mb-4">Way Forward Plan (WFP)</h3>
      {pis.wfp ? (
       <div className="space-y-3">
        <div>
         <p className="text-sm text-gray-600">Active Ingredients</p>
         <p className="font-medium">{pis.wfp.activeIngredients}</p>
        </div>
        <div>
         <p className="text-sm text-gray-600">Dosage Form</p>
         <p className="font-medium">{pis.wfp.dosageForm}</p>
        </div>
        <div>
         <p className="text-sm text-gray-600">Reference Product</p>
         <p className="font-medium">{pis.wfp.referenceProduct}</p>
        </div>
       </div>
      ) : (
       <p className="text-gray-500 italic">WFP not yet created</p>
      )}
     </Card>

     <Card className="p-4">
      <h3 className="font-medium mb-4">Sample Submission</h3>
      {pis.sampleSubmission ? (
       <div className="space-y-3">
        <div>
         <p className="text-sm text-gray-600">TPR Version</p>
         <p className="font-medium">{pis.sampleSubmission.tprVersion}</p>
        </div>
        <div>
         <p className="text-sm text-gray-600">Sample Information</p>
         <p className="font-medium">{pis.sampleSubmission.sampleInfo}</p>
        </div>
       </div>
      ) : (
       <p className="text-gray-500 italic">Sample not yet submitted</p>
      )}
     </Card>
    </TabsContent>

    <TabsContent value="timeline" className="space-y-4">
     <Card className="p-4">
      <h3 className="font-medium mb-4">Important Dates</h3>
      <div className="space-y-4">
       <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-blue-600" />
        <div>
         <p className="text-sm text-gray-600">Created At</p>
         <p className="font-medium">{formatDate(pis.createdAt)}</p>
        </div>
       </div>
       <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-blue-600" />
        <div>
         <p className="text-sm text-gray-600">Last Updated</p>
         <p className="font-medium">{formatDate(pis.updatedAt)}</p>
        </div>
       </div>
       {pis.tentativeTimeline && (
        <div className="flex items-center gap-3">
         <TrendingUp className="h-5 w-5 text-blue-600" />
         <div>
          <p className="text-sm text-gray-600">Tentative Timeline</p>
          <p className="font-medium">{formatDate(pis.tentativeTimeline)}</p>
         </div>
        </div>
       )}
      </div>
     </Card>
    </TabsContent>

    <TabsContent value="history" className="space-y-4">
     <Card className="p-4">
      <h3 className="font-medium mb-4">Audit History</h3>
      {historyEntries.length === 0 ? (
       <p className="text-gray-500 italic">No history entries yet</p>
      ) : (
       <div className="space-y-3">
        {historyEntries.map((entry) => {
         const stageChange = entry.fromStage || entry.toStage;
         return (
          <div key={entry.id} className="p-3 rounded-lg border bg-white">
           <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
             <div className="flex items-center gap-2">
              <Badge variant="outline">
               {stageChange
                ? `${entry.fromStage ? getStageLabel(entry.fromStage) : '—'} → ${entry.toStage ? getStageLabel(entry.toStage) : '—'
                }`
                : 'Activity'}
              </Badge>
              <span className="text-xs text-gray-500">
               {formatTimestamp(entry.timestamp)}
              </span>
             </div>
             <div className="text-sm text-gray-700">
              <span className="font-medium">Action:</span> {entry.action}
             </div>
             {entry.actorName && (
              <div className="text-sm text-gray-700">
               <span className="font-medium">Actor:</span> {entry.actorName}
               {entry.actorRole ? ` (${entry.actorRole})` : ''}
              </div>
             )}
            </div>
           </div>

           {(entry.decision || entry.comments) && (
            <div className="mt-3 space-y-2">
             {entry.decision && (
              <div className="text-sm">
               <p className="text-gray-600">Decision</p>
               <p className="font-medium text-gray-900">{entry.decision}</p>
              </div>
             )}
             {entry.comments && (
              <div className="text-sm">
               <p className="text-gray-600">Comments / Reason</p>
               <p className="text-gray-900 whitespace-pre-wrap">{entry.comments}</p>
              </div>
             )}
            </div>
           )}
          </div>
         );
        })}
       </div>
      )}
     </Card>
    </TabsContent>

    <TabsContent value="attachments" className="space-y-4">
     {canClientConfirm && (
      <Card className="p-4">
       <h3 className="font-medium mb-3">Milestone Confirmations</h3>
       <p className="text-sm text-gray-600 mb-4">
        Confirm key milestones to keep the workflow moving.
       </p>
       <div className="flex flex-wrap gap-2">
        <Button
         variant="outline"
         size="sm"
         onClick={() => handleConfirmMilestone('BRIEF_ACCEPTED')}
         disabled={isTerminated}
        >
         Brief accepted
        </Button>
        <Button
         variant="outline"
         size="sm"
         onClick={() => handleConfirmMilestone('SAMPLE_RECEIVED')}
         disabled={isTerminated}
        >
         Sample received
        </Button>
        <Button
         variant="outline"
         size="sm"
         onClick={() => handleConfirmMilestone('ARTWORK_APPROVED')}
         disabled={isTerminated}
        >
         Artwork approved
        </Button>
       </div>
      </Card>
     )}

     {canClientUpload && (
      <Card className="p-4">
       <h3 className="font-medium mb-3">Upload Documents</h3>
       <p className="text-sm text-gray-600 mb-4">
        Upload reference documents. Submissions require approval before becoming visible.
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
         <p className="text-sm text-gray-600">File</p>
         <Input
          type="file"
          onChange={(e) => {
           const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
           setUploadFile(file);
          }}
          disabled={isUploadingAttachment || isTerminated}
         />
        </div>
        <div className="space-y-2">
         <p className="text-sm text-gray-600">Description (optional)</p>
         <Input
          value={uploadDescription}
          onChange={(e) => setUploadDescription(e.target.value)}
          disabled={isUploadingAttachment || isTerminated}
          placeholder="e.g. label artwork, benchmark reference"
         />
        </div>
       </div>
       <div className="mt-3 flex justify-end">
        <Button
         onClick={handleClientUpload}
         disabled={isUploadingAttachment || !uploadFile || isTerminated}
        >
         {isUploadingAttachment ? 'Uploading…' : 'Submit Upload'}
        </Button>
       </div>
      </Card>
     )}

     <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
       <h3 className="font-medium">Attachments</h3>
       <Button variant="outline" size="sm" onClick={fetchAttachments}>
        Refresh
       </Button>
      </div>

      {isAttachmentsLoading ? (
       <div className="text-sm text-gray-500">Loading…</div>
      ) : attachments.length === 0 ? (
       <div className="text-sm text-gray-500">No attachments available.</div>
      ) : (
       <div className="space-y-2">
        {attachments.map((a) => (
         <div key={a.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-white">
          <div className="min-w-0">
           <p className="font-medium truncate">{a.fileName || 'Attachment'}</p>
           <p className="text-xs text-gray-500">
            {(a as any).category ? String((a as any).category).replace(/_/g, ' ') : '—'}
            {a.createdAt ? ` • ${formatTimestamp(a.createdAt)}` : ''}
           </p>
           {a.description && (
            <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>
           )}
          </div>
          {a.fileUrl ? (
           <a
            href={String(a.fileUrl).startsWith('http') ? a.fileUrl : `${serverBaseUrl}${a.fileUrl}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline whitespace-nowrap"
           >
            Open
           </a>
          ) : (
           <span className="text-sm text-gray-400">—</span>
          )}
         </div>
        ))}
       </div>
      )}
     </Card>
    </TabsContent>

    <TabsContent value="chat" className="space-y-4">
     <PISChat
      pisId={pis.id}
      currentRole={currentRole}
      disabled={isTerminated}
     />
    </TabsContent>

    <TabsContent value="stageForm" className="space-y-4">
     <StageTemplatesForm pis={pis} disabled={isTerminated || !canEditFormFields} />
    </TabsContent>
   </Tabs>

   {/* Actions - hide close button when embedded since parent handles it */}
   <div className="flex justify-end gap-2">
    {!isEmbedded && (
     <Button variant="outline" onClick={onClose}>
      Close
     </Button>
    )}
    <Button onClick={openDecisionDialog} disabled={isTerminated}>Take Action</Button>
   </div>
  </div>
 );

 // Render decision dialog (shared between both modes)
 const renderDecisionDialog = () => (
  <Dialog
   open={isDecisionOpen}
   onOpenChange={(open) => {
    setIsDecisionOpen(open);
    if (!open) {
     setDecisionValue('');
     setDecisionComments('');
    }
   }}
  >
   <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
     <DialogTitle>{decisionTitle}</DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
     <div className="space-y-2">
      <p className="text-sm text-gray-600">Decision</p>
      {pis.stage === 'WAY_FORWARD' ? (
       <Select
        value={decisionValue || 'PROCEED'}
        onValueChange={(val) => {
         setDecisionValue(val);
        }}
       >
        <SelectTrigger>
         <SelectValue placeholder="Select decision" />
        </SelectTrigger>
        <SelectContent>
         <SelectItem value="PROCEED">Proceed (Convert to Completed)</SelectItem>
         <SelectItem value="HOLD">Hold</SelectItem>
         <SelectItem value="DROP">Drop / Terminate</SelectItem>
        </SelectContent>
       </Select>
      ) : (
       <Input
        value={decisionValue}
        onChange={(e) => setDecisionValue(e.target.value)}
       />
      )}
     </div>
     <div className="space-y-2">
      <p className="text-sm text-gray-600">
       Comments{decisionMandatoryComment ? ' (required)' : ''}
      </p>
      <Textarea
       value={decisionComments}
       onChange={(e) => setDecisionComments(e.target.value)}
       placeholder="Add details for audit trail…"
      />
     </div>
    </div>

    <div className="flex justify-end gap-2 mt-4">
     <Button
      variant="outline"
      onClick={() => {
       setIsDecisionOpen(false);
       setDecisionValue('');
       setDecisionComments('');
      }}
     >
      Cancel
     </Button>
     <Button
      onClick={() => {
       const trimmedComments = decisionComments.trim();
       const trimmedDecision = decisionValue.trim() || decisionDefault;

       // For Way Forward, enforce a valid option and comments for HOLD/DROP
       if (pis.stage === 'WAY_FORWARD') {
        const upper = trimmedDecision.toUpperCase();
        if (!['PROCEED', 'HOLD', 'DROP'].includes(upper)) return;
        if ((upper === 'HOLD' || upper === 'DROP') && !trimmedComments) return;
        handleTakeAction(upper, trimmedComments);
       } else {
        if (decisionMandatoryComment && !trimmedComments) return;
        handleTakeAction(trimmedDecision, trimmedComments);
       }

       setIsDecisionOpen(false);
       if (!isEmbedded) onClose();
      }}
     >
      Confirm
     </Button>
    </div>
   </DialogContent>
  </Dialog>
 );

 // If embedded, render content directly without Dialog wrapper
 if (isEmbedded) {
  return (
   <>
    {renderContent()}
    {renderDecisionDialog()}
   </>
  );
 }

 // Non-embedded: render with Dialog wrapper
 return (
  <>
   <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto">
     <DialogHeader>
      <DialogTitle className="text-2xl">PIS Details</DialogTitle>
      <DialogDescription>
       Complete information about PIS {pis.pisCode}
      </DialogDescription>
     </DialogHeader>
     {renderContent()}
    </DialogContent>
   </Dialog>
   {renderDecisionDialog()}
  </>
 );
}

function ProgressIndicator({ label, completed }: { label: string; completed: boolean }) {
 return (
  <div className="flex flex-col items-center gap-2">
   <div className={`w-12 h-12 rounded-full flex items-center justify-center ${completed ? 'bg-green-500' : 'bg-gray-200'
    }`}>
    {completed && <CheckCircle2 className="h-6 w-6 text-white" />}
   </div>
   <p className="text-xs text-center">{label}</p>
  </div>
 );
}

function AssignmentRow({ label, value }: { label: string; value?: string }) {
 return (
  <div className="flex justify-between items-center py-2 border-b last:border-0">
   <span className="text-sm text-gray-600">{label}</span>
   <span className="font-medium">{value || 'Not Assigned'}</span>
  </div>
 );
}
