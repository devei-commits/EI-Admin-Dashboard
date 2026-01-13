import { UserRole, PISStage } from '../types/pis';

export interface RolePermissions {
  canCreatePIS: boolean;
  canViewAllPIS: boolean;
  canViewOwnPIS: boolean;
  canApproveBD: boolean;
  canCreateWFP: boolean;
  canApproveRND: boolean;
  canSubmitSample: boolean;
  canQualityReview: boolean;
  canQualityApprove: boolean;
  canPackagingDesign: boolean;
  canAssignTerminate: boolean;
  canConvertToOrder: boolean;
  canManageCustomers: boolean;
  canManageProducts: boolean;
  visibleStages: PISStage[];
}

export const getRolePermissions = (role: UserRole): RolePermissions => {
  // Default permissions for unknown/undefined roles
  const defaultPermissions: RolePermissions = {
    canCreatePIS: false,
    canViewAllPIS: true,
    canViewOwnPIS: true,
    canApproveBD: false,
    canCreateWFP: false,
    canApproveRND: false,
    canSubmitSample: false,
    canQualityReview: false,
    canQualityApprove: false,
    canPackagingDesign: false,
    canAssignTerminate: false,
    canConvertToOrder: false,
    canManageCustomers: false,
    canManageProducts: false,
    visibleStages: ['BD_INTAKE', 'ALIGNMENT', 'AGREEMENT', 'RND_LEAD_REVIEW', 'RND_DEVELOPMENT',
                    'QUALITY_REVIEW', 'PACKAGING', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
  };

  const permissions: Record<UserRole, RolePermissions> = {
    SUPER_ADMIN: {
      canCreatePIS: true,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: true,
      canCreateWFP: true,
      canApproveRND: true,
      canSubmitSample: true,
      canQualityReview: true,
      canQualityApprove: true,
      canPackagingDesign: true,
      canAssignTerminate: true,
      canConvertToOrder: true,
      canManageCustomers: true,
      canManageProducts: true,
      visibleStages: ['BD_INTAKE', 'ALIGNMENT', 'AGREEMENT', 'RND_LEAD_REVIEW', 'RND_DEVELOPMENT', 
                      'QUALITY_REVIEW', 'PACKAGING', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
    },
    ADMIN: {
      canCreatePIS: true,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: true,
      canCreateWFP: true,
      canApproveRND: true,
      canSubmitSample: true,
      canQualityReview: true,
      canQualityApprove: true,
      canPackagingDesign: true,
      canAssignTerminate: true,
      canConvertToOrder: true,
      canManageCustomers: true,
      canManageProducts: true,
      visibleStages: ['BD_INTAKE', 'ALIGNMENT', 'AGREEMENT', 'RND_LEAD_REVIEW', 'RND_DEVELOPMENT', 
                      'QUALITY_REVIEW', 'PACKAGING', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
    },
    BD_MANAGER: {
      canCreatePIS: true,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: true,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: false,
      canQualityReview: false,
      canQualityApprove: false,
      canPackagingDesign: false,
      canAssignTerminate: true,
      canConvertToOrder: true,
      canManageCustomers: true,
      canManageProducts: true,
      visibleStages: ['BD_INTAKE', 'ALIGNMENT', 'AGREEMENT', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
    },
    BD_STAFF: {
      canCreatePIS: true,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: false,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: false,
      canQualityReview: false,
      canQualityApprove: false,
      canPackagingDesign: false,
      canAssignTerminate: false,
      canConvertToOrder: true,
      canManageCustomers: true,
      canManageProducts: true,
      visibleStages: ['BD_INTAKE', 'ALIGNMENT', 'AGREEMENT', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
    },
    RND_LEAD: {
      canCreatePIS: false,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: false,
      canCreateWFP: true,
      canApproveRND: true,
      canSubmitSample: false,
      canQualityReview: false,
      canQualityApprove: false,
      canPackagingDesign: false,
      canAssignTerminate: true,
      canConvertToOrder: false,
      canManageCustomers: false,
      canManageProducts: false,
      visibleStages: ['ALIGNMENT', 'AGREEMENT', 'RND_LEAD_REVIEW', 'RND_DEVELOPMENT', 
                      'QUALITY_REVIEW', 'COMPLETED', 'TERMINATED'],
    },
    RND_STAFF: {
      canCreatePIS: false,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: false,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: true,
      canQualityReview: false,
      canQualityApprove: false,
      canPackagingDesign: false,
      canAssignTerminate: false,
      canConvertToOrder: false,
      canManageCustomers: false,
      canManageProducts: false,
      visibleStages: ['RND_DEVELOPMENT', 'QUALITY_REVIEW', 'COMPLETED', 'TERMINATED'],
    },
    QA_MANAGER: {
      canCreatePIS: false,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: false,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: false,
      canQualityReview: true,
      canQualityApprove: true,
      canPackagingDesign: false,
      canAssignTerminate: false,
      canConvertToOrder: false,
      canManageCustomers: false,
      canManageProducts: false,
      visibleStages: ['QUALITY_REVIEW', 'PACKAGING', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
    },
    QA_STAFF: {
      canCreatePIS: false,
      canViewAllPIS: true,
      canViewOwnPIS: false,
      canApproveBD: false,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: false,
      canQualityReview: true,
      canQualityApprove: false,
      canPackagingDesign: false,
      canAssignTerminate: false,
      canConvertToOrder: false,
      canManageCustomers: false,
      canManageProducts: false,
      visibleStages: ['QUALITY_REVIEW', 'PACKAGING', 'WAY_FORWARD', 'COMPLETED', 'TERMINATED', 'ON_HOLD'],
    },
    PKG_STAFF: {
      canCreatePIS: false,
      canViewAllPIS: false,
      canViewOwnPIS: false,
      canApproveBD: false,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: false,
      canQualityReview: false,
      canQualityApprove: false,
      canPackagingDesign: true,
      canAssignTerminate: false,
      canConvertToOrder: false,
      canManageCustomers: false,
      canManageProducts: false,
      visibleStages: ['PACKAGING', 'QUALITY_REVIEW', 'COMPLETED'],
    },
    CLIENT: {
      canCreatePIS: true,
      canViewAllPIS: false,
      canViewOwnPIS: true,
      canApproveBD: false,
      canCreateWFP: false,
      canApproveRND: false,
      canSubmitSample: false,
      canQualityReview: false,
      canQualityApprove: false,
      canPackagingDesign: false,
      canAssignTerminate: false,
      canConvertToOrder: false,
      canManageCustomers: false,
      canManageProducts: false,
      visibleStages: ['WAY_FORWARD', 'COMPLETED', 'ON_HOLD'],
    },
  };

  // Return permissions for the role, or default permissions if role not found
  return permissions[role] || defaultPermissions;
};

export const getStageLabel = (stage: PISStage): string => {
  const labels: Record<PISStage, string> = {
    BD_INTAKE: 'Stage 1: BD Intake',
    ALIGNMENT: 'Stage 2: Alignment',
    AGREEMENT: 'Stage 3: Agreement & Handover',
    RND_LEAD_REVIEW: 'R&D Lead Review & Assignment',
    RND_DEVELOPMENT: 'Stage 5: Development Execution',
    QUALITY_REVIEW: 'Stage 6: Quality',
    WAY_FORWARD: 'Stage 7: Way Forward',
    BD_WFP_REVIEW: 'BD WFP Review',
    RND_APPROVAL: 'R&D Approval',
    RND_REVIEW_CORRECTIONS: 'R&D Review Corrections',
    PACKAGING: 'Packaging Track',
    SAMPLE_DISPATCH: 'Sample Dispatch',
    CLIENT_FEEDBACK: 'Client Feedback',
    COMPLETED: 'Completed',
    TERMINATED: 'Terminated',
    ON_HOLD: 'On Hold',
  };
  return labels[stage] || stage;
};

export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrator',
    BD_MANAGER: 'BD Manager',
    BD_STAFF: 'BD Staff',
    RND_LEAD: 'R&D Lead',
    RND_STAFF: 'R&D Staff',
    QA_MANAGER: 'QA Manager',
    QA_STAFF: 'QA Staff',
    PKG_STAFF: 'Packaging Staff',
    CLIENT: 'Client',
  };
  return labels[role];
};
