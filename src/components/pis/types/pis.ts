// User roles
export type UserRole = 
 | 'SUPER_ADMIN'
 | 'ADMIN'
 | 'BD_MANAGER'
 | 'BD_STAFF'
 | 'RND_LEAD'
 | 'RND_STAFF'
 | 'QA_MANAGER'
 | 'QA_STAFF'
 | 'PKG_STAFF'
 | 'CLIENT';

// User status for role assignment
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';

// System User interface
export interface SystemUser {
 id: string;
 email: string;
 name: string;
 role: UserRole | null;
 status: UserStatus;
 // Demo-only: stored in localStorage for quick testing.
 // In a real backend this would never be kept on the client.
 password?: string;
 department?: string;
 permissions: UserPermissions;
 createdAt: Date;
 updatedAt: Date;
}

// User Permissions
export interface UserPermissions {
 canViewDashboard: boolean;
 canViewPIS: boolean;
 canCreatePIS: boolean;
 canEditPIS: boolean;
 canDeletePIS: boolean;
 canViewTasks: boolean;
 canManageTasks: boolean;
 canViewCustomers: boolean;
 canManageCustomers: boolean;
 canViewProducts: boolean;
 canManageProducts: boolean;
 canViewAnalytics: boolean;
 canViewSettings: boolean;
 canManageUsers: boolean;
}

// ============================================
// PIS STAGES - Matching Flowchart Exactly
// ============================================
export type PISStage = 
 | 'BD_INTAKE'      // Stage 1: BD Intake with Client Request Review
 | 'ALIGNMENT'      // Stage 2: BD + Client + R&D Alignment
 | 'AGREEMENT'      // Stage 3: Agreement & Handover
 | 'RND_LEAD_REVIEW'   // R&D Lead Review & Assignment
 | 'RND_DEVELOPMENT'   // Stage 5: Development Execution
 | 'QUALITY_REVIEW'   // Stage 6: Quality
 | 'WAY_FORWARD'     // Stage 7: Way Forward (Client Decision)
 | 'PACKAGING'      // Parallel: Packaging Track
 | 'SAMPLE_DISPATCH'   // Sample Dispatch
 | 'CLIENT_FEEDBACK'   // Client Feedback after dispatch
 | 'COMPLETED'      // Commercialization / Completed
 | 'TERMINATED'     // Dropped / Terminated
 | 'ON_HOLD';      // Way Forward - Hold decision

// PIS Origin Type (Source)
export type PISOriginType = 
 | 'BD_CREATED'       // From BD Team
 | 'CUSTOMER_ENQUIRY'    // From Customer Enquiry
 | 'CUSTOMIZATION_REQUEST'; // From Customization Request

// Way Forward Decision
export type WayForwardDecision = 'PROCEED' | 'HOLD' | 'DROP';

// PIS Status
export type PISStatus = 
 | 'PENDING'
 | 'IN_PROGRESS'
 | 'APPROVED'
 | 'REJECTED'
 | 'ON_HOLD'
 | 'COMPLETED'
 | 'TERMINATED';

// PIS history entry for audit trail
export interface PISHistoryEntry {
 id: string;
 timestamp: Date;
 actorName?: string;
 actorRole?: UserRole | null;
 fromStage?: PISStage;
 toStage?: PISStage;
 action: string;
 decision?: string;
 comments?: string;
 metadata?: Record<string, unknown>;
}

// WFP (Way Forward Plan) interface
export interface WayForwardPlan {
 activeIngredients: string;
 dosageForm: string;
 referenceProduct: string;
 packagingCompatibility: string;
 targetPrice: string;
 limitations: string;
 pilotRequirements: string;
 createdBy?: string;
 createdAt?: Date;
 approvedBy?: string;
 approvedAt?: Date;
 bdComments?: string;
}

// Sample Submission interface
export interface SampleSubmission {
 tprVersion: string;
 specifications: {
  phRange: string;
  viscosity: string;
  color: string;
  odor: string;
  specificGravity: string;
 };
 sampleInfo: string;
 submittedBy?: string;
 submittedAt?: Date;
}

// ============================================
// CHECKLIST INTERFACES (Matching Flowchart)
// ============================================

// Stage 1: Client Request Review Checklist
export interface CRRChecklist {
 productDosageSkinType: boolean;  // Product / Dosage / Skin Type captured
 packConfiguration: boolean;     // Pack Configuration captured
 claimsMustHave: boolean;      // Claims Must Have captured
 activesRequested: boolean;     // Actives Requested captured
 costMoqTimeline: boolean;     // Cost, MOQ, Timeline captured
 attachmentsReferences: boolean;  // Attachments and References uploaded
 bdNotesRisks: boolean;       // BD Notes and Risks documented
}

// Stage 2: Alignment Checklist
export interface AlignmentChecklist {
 dosageAgreed: boolean;
 activeDirectionAgreed: boolean;
 keyClaimsAgreed: boolean;
 specsRangeAgreed: boolean;
 packagingDirectionAgreed: boolean;
 timelineAgreed: boolean;
}

// Stage 3: Agreement & Handover Checklist
export interface AgreementChecklist {
 handoverToRdLead: boolean;
 finalPisLocked: boolean;
 agreementSigned: boolean;
 projectCodeCreated: boolean;
 packagingTrackTriggered: boolean;
 kickoffNotes: boolean;
}

// R&D Lead Review Checklist
export interface RndLeadReviewChecklist {
 rdLeadAssigned: boolean;
 activeCompositionConfirmed: boolean;
 dosageFormConfirmed: boolean;
 claimsFeasibilityConfirmed: boolean;
 specificationsConfirmed: boolean;
}

// Stage 5: Development Execution Checklist
export interface RndDevelopmentChecklist {
 keyRawMaterialsSourced: boolean;
 formulaFrozenForSample: boolean;
 inProcessChecksDone: boolean;
 stabilitySamplesInitiated: boolean;
}

// Stage 6: Quality Checklist
export interface QaChecklist {
 sampleSubmittedToQc: boolean;
 qcReviewComplete: boolean;
 qcApproved: boolean;
}

// Packaging Checklist
export interface PackagingChecklist {
 packagingLeadReview: boolean;
 possibilitiesLimitations: boolean;
 allAligned: boolean;
 packagingCatalogue: boolean;
}

// ============================================
// PIS RECORD INTERFACE (Complete)
// ============================================
export interface PISRecord {
 id: string;
 pisCode: string;
 formulation: string;
 
 // Source/Origin tracking
 originType: PISOriginType;
 enquiryReference?: string;
 customizationRef?: string;
 
 // Customer & Product references
 customer: string;
 customerId?: string;
 costName: string;
 productCode?: string;
 rdStaff: string;
 stage: PISStage;
 status: PISStatus;
 
 // Stage indicators
 m1: boolean;
 v1: boolean;
 rdO1: boolean;
 regulatory: boolean;
 inventory: boolean;
 formLabel: string;
 sop: boolean;
 ac: boolean;
 oc: boolean;
 mop: boolean;
 coa: boolean;
 pre: boolean;
 stabilityMatch: boolean;
 prs: boolean;
 sensory: boolean;
 
 // ============================================
 // STAGE 1: BD INTAKE - Client Request Review
 // ============================================
 productDosageSkinType?: string;
 packConfiguration?: string;
 claimsMustHave?: string[];
 activesRequested?: string[];
 targetCost?: number;
 moq?: number;
 requestedTimeline?: Date;
 bdNotesRisks?: string;
 crrChecklist?: CRRChecklist;
 bdIntakeCompletedAt?: Date;
 
 // ============================================
 // STAGE 2: ALIGNMENT
 // ============================================
 dosageAgreed?: boolean;
 activeDirectionAgreed?: boolean;
 keyClaimsAgreed?: boolean;
 specsRangeAgreed?: boolean;
 packagingDirectionAgreed?: boolean;
 timelineAgreed?: boolean;
 alignmentNotes?: string;
 alignmentCompletedAt?: Date;
 alignmentChecklist?: AlignmentChecklist;
 
 // ============================================
 // STAGE 3: AGREEMENT & HANDOVER
 // ============================================
 projectCode?: string;
 agreementSigned?: boolean;
 agreementSignedAt?: Date;
 agreementSignedBy?: string;
 agreementDocumentUrl?: string;
 finalPisLocked?: boolean;
 packagingTrackTriggered?: boolean;
 kickoffNotes?: string;
 handoverCompletedAt?: Date;
 agreementChecklist?: AgreementChecklist;
 
 // ============================================
 // R&D LEAD REVIEW
 // ============================================
 activeCompositionConfirmed?: boolean;
 dosageFormConfirmed?: boolean;
 claimsFeasibilityConfirmed?: boolean;
 specificationsConfirmed?: boolean;
 rndLeadReviewNotes?: string;
 rndLeadReviewCompletedAt?: Date;
 rndLeadReviewChecklist?: RndLeadReviewChecklist;
 
 // ============================================
 // STAGE 5: DEVELOPMENT EXECUTION
 // ============================================
 keyRawMaterialsSourced?: boolean;
 formulaFrozenForSample?: boolean;
 inProcessChecksDone?: boolean;
 stabilitySamplesInitiated?: boolean;
 sampleReadyForQC?: boolean;
 developmentNotes?: string;
 developmentCompletedAt?: Date;
 rndDevelopmentChecklist?: RndDevelopmentChecklist;
 
 // ============================================
 // STAGE 6: QUALITY
 // ============================================
 sampleSubmittedToQc?: boolean;
 qcReviewComplete?: boolean;
 qcApproved?: boolean;
 qcRejectionReason?: string;
 samplesDispatched?: boolean;
 qcCompletedAt?: Date;
 qaChecklist?: QaChecklist;
 
 // ============================================
 // PACKAGING TRACK (PARALLEL)
 // ============================================
 pkgLeadAssignment?: string;
 packagingLeadReview?: boolean;
 packagingPossibilities?: string;
 packagingLimitations?: string;
 packagingAligned?: boolean;
 packagingCatalogueLink?: string;
 packagingCompletedAt?: Date;
 packagingChecklist?: PackagingChecklist;
 
 // ============================================
 // STAGE 7: WAY FORWARD
 // ============================================
 wayForwardDecision?: WayForwardDecision;
 wayForwardDecidedAt?: Date;
 wayForwardDecidedBy?: string;
 holdReason?: string;
 dropReason?: string;
 commercializationStarted?: boolean;
 
 // Way Forward Plan
 wfp?: WayForwardPlan;
 
 // Sample Submission
 sampleSubmission?: SampleSubmission;

 // Stage templates
 stageTemplates?: any;

 // Legacy checklists (backward compatibility)
 bdIntakeChecklist?: {
  clientBriefCaptured: boolean;
  pricingFeasibilityChecked: boolean;
  clientTimelineAligned: boolean;
 };

 // ============================================
 // ASSIGNMENTS
 // ============================================
 createdById?: string;
 bdTeam?: string;
 assignedBdRole?: 'BD_MANAGER' | 'BD_STAFF';
 assignedBdStaffId?: string;
 rndLeadAssignment?: string;
 rndStaffAssignment?: string;
 qaAssignment?: string;
 pkgDesignAssignment?: string;
 pkgProductSubmission?: string;
 pkgLabelSubmission?: string;
 sampleDispatchPreparation?: string;

 // Analytics
 loopCount?: number;
 rejectionCount?: number;

 // History / audit trail
 history?: PISHistoryEntry[];
 
 // ============================================
 // TIMESTAMPS
 // ============================================
 createdAt: Date;
 updatedAt: Date;
 tentativeTimeline?: Date;
 qcSubmittedAt?: Date;
 sampleDispatchedAt?: Date;
 clientFeedbackReceivedAt?: Date;
 completedAt?: Date;
 terminatedAt?: Date;
 terminationReason?: string;
 
 // Client feedback
 clientFeedback?: string;
 clientApproved?: boolean;
 
 // Converted to order
 convertedToOrder?: boolean;
 orderReference?: string;
 
 // Attachments
 attachments?: PISAttachment[];
}

// ============================================
// PIS ATTACHMENT INTERFACE
// ============================================
export type AttachmentCategory = 
 | 'CLIENT_REFERENCE'
 | 'AGREEMENT'
 | 'QC_REPORT'
 | 'PACKAGING_CATALOGUE'
 | 'SAMPLE_PHOTO'
 | 'STABILITY_REPORT'
 | 'OTHER';

export interface PISAttachment {
 id: string;
 pisId: string;
 fileName: string;
 fileType: string;
 fileSize: number;
 fileUrl: string;
 category: AttachmentCategory;
 stage?: PISStage;
 description?: string;
 uploadedById: number;
 createdAt: Date;
 updatedAt: Date;
}

// ============================================
// PIS NOTIFICATION INTERFACE
// ============================================
export type NotificationType = 
 | 'STAGE_TRANSITION'
 | 'ASSIGNMENT'
 | 'APPROVAL_REQUEST'
 | 'CLIENT_UPDATE'
 | 'SLA_WARNING'
 | 'ESCALATION';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface PISNotification {
 id: string;
 pisId: string;
 type: NotificationType;
 title: string;
 message: string;
 targetUserId?: number;
 targetRole?: UserRole;
 isRead: boolean;
 readAt?: Date;
 priority: NotificationPriority;
 createdAt: Date;
}

// ============================================
// CUSTOMER ENQUIRY INTERFACE
// ============================================
export interface CustomerEnquiry {
 id: string;
 customerName: string;
 customerEmail: string;
 customerPhone?: string;
 company?: string;
 productType: string;
 description: string;
 dosageForm?: string;
 targetVolume?: number;
 expectedTimeline?: string;
 status: 'PENDING' | 'CONVERTED' | 'REJECTED';
 convertedToPisId?: string;
 rejectionReason?: string;
 createdAt: Date;
 updatedAt: Date;
}

// ============================================
// CUSTOMIZATION REQUEST INTERFACE
// ============================================
export interface CustomizationRequest {
 id: string;
 customerId?: string;
 customerName: string;
 baseProductId?: string;
 baseProductName: string;
 customizations: string;
 activeChanges?: string;
 packagingChanges?: string;
 claimsChanges?: string;
 status: 'PENDING' | 'CONVERTED' | 'REJECTED';
 convertedToPisId?: string;
 rejectionReason?: string;
 createdAt: Date;
 updatedAt: Date;
}

// Shared master data types so that Customers / Products can live in context

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT';

export type CustomerCategory = 'ENTERPRISE' | 'SMB' | 'STARTUP';

export interface Customer {
 id: string;
 name: string;
 company: string;
 email: string;
 phone: string;
 address: string;
 status: CustomerStatus;
 category: CustomerCategory;
 totalPIS: number;
 createdAt: Date;
}

export type ProductType =
 | 'CREAM'
 | 'LOTION'
 | 'SERUM'
 | 'GEL'
 | 'OIL'
 | 'POWDER'
 | 'OTHER';

export type ProductStatus = 'ACTIVE' | 'DEVELOPMENT' | 'DISCONTINUED';

export interface Product {
 id: string;
 name: string;
 code: string;
 category: string;
 type: ProductType;
 status: ProductStatus;
 // Optional product image/photo URL (will come from S3 later)
 imageUrl?: string;
 ingredients: string[];
 price: number;
 createdAt: Date;
 description: string;
}

// ============================================
// STAGE CONFIGURATION (for UI rendering)
// ============================================
export interface StageConfig {
 key: PISStage;
 label: string;
 description: string;
 stageNumber?: number;
 allowedRoles: UserRole[];
 requiredChecklist?: string;
 isParallel?: boolean;
}

export const STAGE_CONFIGS: StageConfig[] = [
 {
  key: 'BD_INTAKE',
  label: 'Stage 1: BD Intake',
  description: 'Client Request Review & Completion',
  stageNumber: 1,
  allowedRoles: ['BD_MANAGER', 'BD_STAFF'],
  requiredChecklist: 'crrChecklist',
 },
 {
  key: 'ALIGNMENT',
  label: 'Stage 2: Alignment',
  description: 'BD + Client + R&D Alignment',
  stageNumber: 2,
  allowedRoles: ['BD_MANAGER', 'BD_STAFF', 'RND_LEAD', 'CLIENT'],
  requiredChecklist: 'alignmentChecklist',
 },
 {
  key: 'AGREEMENT',
  label: 'Stage 3: Agreement & Handover',
  description: 'Agreement Signed & Handover to R&D',
  stageNumber: 3,
  allowedRoles: ['BD_MANAGER'],
  requiredChecklist: 'agreementChecklist',
 },
 {
  key: 'RND_LEAD_REVIEW',
  label: 'R&D Lead Review',
  description: 'R&D Lead Assignment & Feasibility Review',
  stageNumber: 4,
  allowedRoles: ['RND_LEAD'],
  requiredChecklist: 'rndLeadReviewChecklist',
 },
 {
  key: 'RND_DEVELOPMENT',
  label: 'Stage 5: Development',
  description: 'Development Execution',
  stageNumber: 5,
  allowedRoles: ['RND_LEAD', 'RND_STAFF'],
  requiredChecklist: 'rndDevelopmentChecklist',
 },
 {
  key: 'QUALITY_REVIEW',
  label: 'Stage 6: Quality',
  description: 'QC Review & Approval',
  stageNumber: 6,
  allowedRoles: ['QA_MANAGER', 'QA_STAFF'],
  requiredChecklist: 'qaChecklist',
 },
 {
  key: 'PACKAGING',
  label: 'Packaging Track',
  description: 'Packaging Review & Catalogue',
  allowedRoles: ['PKG_STAFF'],
  requiredChecklist: 'packagingChecklist',
  isParallel: true,
 },
 {
  key: 'SAMPLE_DISPATCH',
  label: 'Sample Dispatch',
  description: 'Samples Dispatched to Client',
  allowedRoles: ['PKG_STAFF', 'BD_MANAGER'],
 },
 {
  key: 'WAY_FORWARD',
  label: 'Stage 7: Way Forward',
  description: 'Client Decision - Proceed/Hold/Drop',
  stageNumber: 7,
  allowedRoles: ['BD_MANAGER', 'CLIENT'],
 },
 {
  key: 'CLIENT_FEEDBACK',
  label: 'Client Feedback',
  description: 'Awaiting Client Approval',
  allowedRoles: ['CLIENT', 'BD_MANAGER'],
 },
 {
  key: 'COMPLETED',
  label: 'Completed',
  description: 'PIS Completed - Commercialization',
  allowedRoles: ['BD_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
 },
 {
  key: 'ON_HOLD',
  label: 'On Hold',
  description: 'PIS On Hold per Client Request',
  allowedRoles: ['BD_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
 },
 {
  key: 'TERMINATED',
  label: 'Terminated',
  description: 'PIS Dropped/Closed',
  allowedRoles: ['BD_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
 },
];

// Helper to get stage config
export const getStageConfig = (stage: PISStage): StageConfig | undefined => {
 return STAGE_CONFIGS.find(s => s.key === stage);
};
