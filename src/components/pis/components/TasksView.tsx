import { useState } from 'react';
import { UserRole, PISRecord, SystemUser } from '../types/pis';
import { usePIS } from '../context/PISContext';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { getStageLabel } from '../utils/permissions';
import { 
 Clock, 
 AlertCircle, 
 CheckCircle2,
 ArrowRight,
 User as UserIcon,
 ClipboardList,
 Activity
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { PISDetailsDialog } from './PISDetailsDialog';
import { cn } from './ui/utils';

type TaskAction = {
 label: string;
 variant?: 'outline' | 'secondary';
 onClick: () => void;
};

interface TasksViewProps {
 currentRole: UserRole;
 taskType: 'BD' | 'RND' | 'QA' | 'PKG';
}

export function TasksView({ currentRole, taskType, onOpenInPIS }: TasksViewProps & { onOpenInPIS?: (pisId: string) => void }) {
 const { pisRecords, updatePIS, transitionPIS, systemUsers, currentUser, addHistoryEntry } = usePIS();
 const [selectedPIS, setSelectedPIS] = useState<PISRecord | null>(null);
 const [isDetailsOpen, setIsDetailsOpen] = useState(false);
 const [assignTargetPis, setAssignTargetPis] = useState<PISRecord | null>(null);
 const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
 const [assignRndTargetPis, setAssignRndTargetPis] = useState<PISRecord | null>(null);
 const [isRndAssignDialogOpen, setIsRndAssignDialogOpen] = useState(false);
 const [decisionContext, setDecisionContext] = useState<{
  pis: PISRecord;
  title: string;
  defaultDecision: string;
  mandatoryComment: boolean;
  onApply: (decision: string, comments: string) => void;
 } | null>(null);
 const [decisionValue, setDecisionValue] = useState('');
 const [decisionComments, setDecisionComments] = useState('');
 const [adminViewMode, setAdminViewMode] = useState<'ALL' | 'ASSIGNED'>('ALL');

 // Filter tasks based on role and task type
 const myTasks = pisRecords.filter(pis => {
  switch (taskType) {
   case 'BD':
    if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
     const inBdStages =
      pis.stage === 'BD_INTAKE' ||
      pis.stage === 'ALIGNMENT' ||
      pis.stage === 'AGREEMENT' ||
      pis.stage === 'WAY_FORWARD';
     if (!inBdStages) return false;
     if (adminViewMode === 'ASSIGNED') {
      return pis.assignedBdRole === 'BD_STAFF' && !!pis.assignedBdStaffId;
     }
     return true;
    }
    if (currentRole === 'BD_MANAGER') {
     // BD Manager sees BD-stage items not yet assigned to BD Staff
     return (
      (pis.stage === 'BD_INTAKE' || pis.stage === 'ALIGNMENT' || pis.stage === 'AGREEMENT' || pis.stage === 'WAY_FORWARD') &&
      pis.assignedBdRole !== 'BD_STAFF'
     );
    }
    if (currentRole === 'BD_STAFF') {
     // BD Staff sees BD items explicitly assigned to them
     return (
      (pis.stage === 'BD_INTAKE' || pis.stage === 'ALIGNMENT' || pis.stage === 'AGREEMENT' || pis.stage === 'WAY_FORWARD') &&
      pis.assignedBdRole === 'BD_STAFF' &&
      (!!currentUser && pis.assignedBdStaffId === currentUser.id)
     );
    }
    return false;
   case 'RND':
    if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
     const inRndStages =
      pis.stage === 'ALIGNMENT' ||
      pis.stage === 'AGREEMENT' ||
      pis.stage === 'RND_LEAD_REVIEW' ||
      pis.stage === 'RND_DEVELOPMENT' ||
      pis.stage === 'QUALITY_REVIEW';
     if (!inRndStages) return false;
     if (adminViewMode === 'ASSIGNED') {
      return !!pis.rndStaffAssignment;
     }
     return true;
    }
    if (currentRole === 'RND_LEAD') {
     return (
      pis.stage === 'ALIGNMENT' ||
      pis.stage === 'AGREEMENT' ||
      pis.stage === 'RND_LEAD_REVIEW' ||
      pis.stage === 'RND_DEVELOPMENT' ||
      pis.stage === 'QUALITY_REVIEW'
     );
    }
    // R&D Staff: see only tasks explicitly assigned to them
    if (!currentUser) return false;
    const identities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
    const isAssignedToMe = !!pis.rndStaffAssignment && identities.includes(pis.rndStaffAssignment);
    return (
     isAssignedToMe &&
     (pis.stage === 'RND_DEVELOPMENT' || pis.stage === 'QUALITY_REVIEW')
    );
   case 'QA':
    if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
     if (pis.stage !== 'QUALITY_REVIEW') return false;
     if (adminViewMode === 'ASSIGNED') {
      return !!pis.qaAssignment;
     }
     return true;
    }
    return pis.stage === 'QUALITY_REVIEW' || pis.stage === 'WAY_FORWARD';
   case 'PKG':
    if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
     const inPkgStages = pis.stage === 'PACKAGING' || pis.stage === 'QUALITY_REVIEW';
     if (!inPkgStages) return false;
     if (adminViewMode === 'ASSIGNED') {
      return (
       !!pis.pkgDesignAssignment ||
       !!pis.pkgProductSubmission ||
       !!pis.pkgLabelSubmission
      );
     }
     return true;
    }
    return pis.stage === 'PACKAGING' || pis.stage === 'QUALITY_REVIEW';
   default:
    return false;
  }
 });

 const pendingTasks = myTasks.filter(p => p.status === 'PENDING');
 const inProgressTasks = myTasks.filter(p => p.status === 'IN_PROGRESS');

 const getTaskTitle = () => {
  const titles = {
   BD: 'Business Development Tasks',
   RND: 'Research & Development Tasks',
   QA: 'Quality Assurance Tasks',
   PKG: 'Packaging Tasks',
  };
  return titles[taskType];
 };

 const getTaskDescription = () => {
  const descriptions = {
   BD: 'Manage client intake, WFP reviews, and sample dispatch coordination',
   RND: 'Handle formulation development, reviews, and technical documentation',
   QA: 'Conduct quality reviews and approve samples for dispatch',
   PKG: 'Create packaging designs and manage artwork submissions',
  };
  return descriptions[taskType];
 };

 const handleAssignToBdStaff = (pis: PISRecord) => {
  if (taskType === 'BD' && currentRole === 'BD_MANAGER') {
   setAssignTargetPis(pis);
   setIsAssignDialogOpen(true);
  }
 };

 const handleAssignToRndStaff = (pis: PISRecord) => {
  if (taskType === 'RND' && currentRole === 'RND_LEAD') {
   setAssignRndTargetPis(pis);
   setIsRndAssignDialogOpen(true);
  }
 };

 const openDecisionDialog = (
  pis: PISRecord,
  options: {
   title: string;
   defaultDecision: string;
   mandatoryComment?: boolean;
   onApply: (decision: string, comments: string) => void;
  }
 ) => {
  setDecisionContext({
   pis,
   title: options.title,
   defaultDecision: options.defaultDecision,
   mandatoryComment: options.mandatoryComment ?? false,
   onApply: options.onApply,
  });
  setDecisionValue(options.defaultDecision);
  setDecisionComments('');
 };

 const handleViewDetails = (pis: PISRecord) => {
  if (onOpenInPIS) {
   onOpenInPIS(pis.id);
   return;
  }
  setSelectedPIS(pis);
  setIsDetailsOpen(true);
 };

 const handleCloseDetails = () => {
  setIsDetailsOpen(false);
  setSelectedPIS(null);
 };

 const handleBdValidateAndMoveToRndLead = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'BD_INTAKE') return;

  openDecisionDialog(pis, {
   title: 'Validate client data & move to R&D Lead Review (Stage 2)',
   defaultDecision: 'Validated client data; moved to R&D Lead review',
   onApply: async (decision, comments) => {
    try {
     await transitionPIS(pis.id, 'RND_LEAD_REVIEW', 'APPROVED', `${decision}${comments ? ` - ${comments}` : ''}`);
    } catch (error) {
    }
   },
  });
 };

 const handleBdRequestMissingInfo = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'BD_INTAKE') return;

  openDecisionDialog(pis, {
   title: 'Request missing info (stay in BD Intake)',
   defaultDecision: 'Requested missing client information',
   mandatoryComment: true,
   onApply: async (decision, comments) => {
    const updates: Partial<PISRecord> = {
     stage: 'BD_INTAKE',
     status: 'PENDING',
    };

    // When BD Staff requests missing info, send it back to BD Manager
    if (currentRole === 'BD_STAFF') {
     updates.assignedBdRole = 'BD_MANAGER';
     updates.assignedBdStaffId = undefined;
    }

    try {
     await updatePIS(pis.id, updates);
    } catch (error) {
    }

    // Trigger a refresh of history from backend so comments are visible where supported
    try {
     await addHistoryEntry(pis.id, {
      id: `hist-${Date.now()}`,
      timestamp: new Date(),
      actorName: currentUser?.name,
      actorRole: currentUser?.role ?? null,
      fromStage: pis.stage,
      toStage: 'BD_INTAKE',
      action: 'BD_REQUEST_MISSING_INFO',
      decision,
      comments,
     });
    } catch (error) {
    }
   },
  });
 };

 const handleBdStaffRejectBriefToManager = (pis: PISRecord) => {
  if (taskType !== 'BD' || currentRole !== 'BD_STAFF') return;
  if (pis.stage !== 'BD_INTAKE') return;

  openDecisionDialog(pis, {
   title: 'Reject brief back to BD Manager / Client',
   defaultDecision: 'Issues found in client brief; sent back to BD Manager for client update',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'BD_INTAKE',
     status: 'PENDING',
     assignedBdRole: 'BD_MANAGER',
     assignedBdStaffId: undefined,
     loopCount: (pis.loopCount ?? 0) + 1,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'BD_INTAKE',
     action: 'BD_STAFF_REJECT_BRIEF_TO_MANAGER',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndLeadSubmitWfpToBd = (pis: PISRecord) => {
  if (taskType !== 'RND' || currentRole !== 'RND_LEAD') return;
  if (pis.stage !== 'RND_LEAD_REVIEW') return;

  openDecisionDialog(pis, {
   title: 'Create WFP & submit to BD (Stage 3)',
   defaultDecision: 'WFP created and submitted to BD for review',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'ALIGNMENT',
     status: 'PENDING',
     assignedBdRole: 'BD_MANAGER',
     assignedBdStaffId: undefined,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'ALIGNMENT',
     action: 'RND_SUBMIT_WFP_TO_BD',
     decision,
     comments,
    });
   },
  });
 };

 const handleBdApproveWfpToDevelopment = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'ALIGNMENT') return;

  openDecisionDialog(pis, {
   title: 'Approve WFP & send to R&D Development (Stage 4)',
   defaultDecision: 'WFP approved; sent to R&D for development',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'IN_PROGRESS',
     assignedBdRole: undefined,
     assignedBdStaffId: undefined,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'BD_APPROVE_WFP_TO_RND_DEVELOPMENT',
     decision,
     comments,
    });
   },
  });
 };

 const handleBdRequestWfpChanges = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'ALIGNMENT') return;

  openDecisionDialog(pis, {
   title: 'Request WFP changes & send back to R&D Lead (Stage 2)',
   defaultDecision: 'Requested WFP changes; sent back to R&D Lead',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_LEAD_REVIEW',
     status: 'PENDING',
     assignedBdRole: undefined,
     assignedBdStaffId: undefined,
     loopCount: (pis.loopCount ?? 0) + 1,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_LEAD_REVIEW',
     action: 'BD_REQUEST_WFP_CHANGES',
     decision,
     comments,
    });
   },
  });
 };

 const handleBdRejectWfpTerminate = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'ALIGNMENT') return;

  openDecisionDialog(pis, {
   title: 'Reject plan, inform client & terminate',
   defaultDecision: 'Plan rejected; client informed; PIS terminated',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'TERMINATED',
     status: 'TERMINATED',
     assignedBdRole: undefined,
     assignedBdStaffId: undefined,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'TERMINATED',
     action: 'BD_REJECT_WFP_TERMINATE',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndDevApproveToTimeline = (pis: PISRecord) => {
  if (taskType !== 'RND') return;
  if (pis.stage !== 'RND_DEVELOPMENT') return;

  const tentativeTimeline = new Date();
  tentativeTimeline.setDate(tentativeTimeline.getDate() + 14);

  openDecisionDialog(pis, {
   title: 'Approve development & move to R&D Approval & Timeline (Stage 6)',
   defaultDecision: 'Development complete; moved to R&D approval & timeline',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'QUALITY_REVIEW',
     status: 'IN_PROGRESS',
     tentativeTimeline,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'QUALITY_REVIEW',
     action: 'RND_APPROVE_DEVELOPMENT_TO_TIMELINE',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndDevMinorUpdates = (pis: PISRecord) => {
  if (taskType !== 'RND') return;
  if (pis.stage !== 'RND_DEVELOPMENT') return;

  openDecisionDialog(pis, {
   title: 'Needs minor updates (continue development)',
   defaultDecision: 'Minor updates made; continuing development',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'IN_PROGRESS',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'RND_DEV_MINOR_UPDATES',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndDevRejectToBd = (pis: PISRecord) => {
  if (taskType !== 'RND') return;
  if (pis.stage !== 'RND_DEVELOPMENT') return;

  openDecisionDialog(pis, {
   title: 'Reject WFP (technical) & send back to BD (Stage 3)',
   defaultDecision: 'WFP rejected with technical comments; sent back to BD',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'ALIGNMENT',
     status: 'PENDING',
     assignedBdRole: 'BD_MANAGER',
     assignedBdStaffId: undefined,
     loopCount: (pis.loopCount ?? 0) + 1,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'ALIGNMENT',
     action: 'RND_DEV_REJECT_WFP_TO_BD',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndApprovalSubmitForReview = (pis: PISRecord) => {
  if (taskType !== 'RND') return;
  if (pis.stage !== 'QUALITY_REVIEW') return;

  const sample = {
   tprVersion: 'TPR V1',
   specifications: {
    phRange: '5.5 - 6.5',
    viscosity: 'Medium',
    color: 'Off white',
    odor: 'Mild fragrance',
    specificGravity: '1.01',
   },
   sampleInfo: 'Sample submission for review prior to QA quality review.',
   submittedBy: currentUser?.name,
   submittedAt: new Date(),
  } as const;

  openDecisionDialog(pis, {
   title: 'Submit for review (Stage 7-8)',
   defaultDecision: 'Sample submitted for R&D review',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'PENDING',
     sampleSubmission: sample,
     rndStaffAssignment: pis.rndStaffAssignment ?? currentUser?.name,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'RND_SUBMIT_SAMPLE_FOR_REVIEW',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndReviewApproveToQa = (pis: PISRecord) => {
  if (taskType !== 'RND' || currentRole !== 'RND_LEAD') return;
  if (pis.stage !== 'RND_DEVELOPMENT' || pis.status !== 'PENDING') return;

  openDecisionDialog(pis, {
   title: 'Approve review & move to Quality Review (Stage 9)',
   defaultDecision: 'Sample review approved; sent to QA for quality review',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'QUALITY_REVIEW',
     status: 'PENDING',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'QUALITY_REVIEW',
     action: 'RND_REVIEW_APPROVE_TO_QA',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndReviewRejectForCorrections = (pis: PISRecord) => {
  if (taskType !== 'RND' || currentRole !== 'RND_LEAD') return;
  if (pis.stage !== 'RND_DEVELOPMENT' || pis.status !== 'PENDING') return;

  openDecisionDialog(pis, {
   title: 'Reject review & require corrections (Stage 7-8)',
   defaultDecision: 'Review rejected; corrections required',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'IN_PROGRESS',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'RND_REVIEW_REJECT_CORRECTIONS_REQUIRED',
     decision,
     comments,
    });
   },
  });
 };

 const handleRndCorrectionsResubmit = (pis: PISRecord) => {
  if (taskType !== 'RND' || currentRole !== 'RND_STAFF') return;
  if (pis.stage !== 'RND_DEVELOPMENT' || pis.status === 'PENDING') return;

  openDecisionDialog(pis, {
   title: 'Update corrections & resubmit for review',
   defaultDecision: 'Corrections updated and resubmitted for review',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'PENDING',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'RND_CORRECTIONS_RESUBMIT_FOR_REVIEW',
     decision,
     comments,
    });
   },
  });
 };

 const handleQaRejectToRnd = (pis: PISRecord) => {
  if (taskType !== 'QA') return;
  if (pis.stage !== 'QUALITY_REVIEW') return;

  openDecisionDialog(pis, {
   title: 'Reject & send back to R&D (Stage 7-8)',
   defaultDecision: 'Quality rejected; sent back to R&D for corrections',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'IN_PROGRESS',
     loopCount: (pis.loopCount ?? 0) + 1,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'QA_REJECT_TO_RND_CORRECTIONS',
     decision,
     comments,
    });
   },
  });
 };

 const handleQaApproveToPackaging = (pis: PISRecord) => {
  if (taskType !== 'QA') return;
  if (pis.stage !== 'QUALITY_REVIEW') return;

  openDecisionDialog(pis, {
   title: 'Quality approved & send to Packaging (Stage 10)',
   defaultDecision: 'Quality approved; moved to packaging',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'PACKAGING',
     status: 'IN_PROGRESS',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'PACKAGING',
     action: 'QA_APPROVE_TO_PACKAGING',
     decision,
     comments,
    });
   },
  });
 };

 const handleQaApproveToDispatch = (pis: PISRecord) => {
  if (taskType !== 'QA') return;
  if (pis.stage !== 'QUALITY_REVIEW') return;

  openDecisionDialog(pis, {
   title: 'Quality approved & prepare for Dispatch',
   defaultDecision: 'Quality approved; moved to sample dispatch',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'SAMPLE_DISPATCH',
     status: 'IN_PROGRESS',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'SAMPLE_DISPATCH',
     action: 'QA_APPROVE_TO_DISPATCH',
     decision,
     comments,
    });
   },
  });
 };

 const handlePackagingFinalizeToDispatch = (pis: PISRecord) => {
  if (taskType !== 'PKG') return;
  if (pis.stage !== 'PACKAGING') return;

  openDecisionDialog(pis, {
   title: 'Finalize packaging & prepare for Dispatch',
   defaultDecision: 'Packaging finalized; moved to sample dispatch',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'SAMPLE_DISPATCH',
     status: 'IN_PROGRESS',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'SAMPLE_DISPATCH',
     action: 'PACKAGING_FINALIZED_TO_DISPATCH',
     decision,
     comments,
    });
   },
  });
 };

 const handleDispatchMarkDispatchedToClientFeedback = (pis: PISRecord) => {
  if (taskType !== 'PKG') return;
  if (pis.stage !== 'SAMPLE_DISPATCH') return;

  openDecisionDialog(pis, {
   title: 'Mark sample dispatched & request client feedback',
   defaultDecision: 'Sample dispatched; awaiting client feedback',
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'CLIENT_FEEDBACK',
     status: 'PENDING',
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'CLIENT_FEEDBACK',
     action: 'SAMPLE_DISPATCHED_TO_CLIENT_FEEDBACK',
     decision,
     comments,
    });
   },
  });
 };

 const handleClientApprovedComplete = (pis: PISRecord, convertToOrder: boolean) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'CLIENT_FEEDBACK') return;

  openDecisionDialog(pis, {
   title: 'Client approved: mark PIS complete',
   defaultDecision: convertToOrder
    ? 'Client approved; PIS completed and converted to sales order'
    : 'Client approved; PIS completed',
   onApply: (decision, comments) => {
    const orderRef = convertToOrder
     ? pis.orderReference || `ORD-${new Date().getFullYear()}-${pis.id}`
     : undefined;
    updatePIS(pis.id, {
     stage: 'COMPLETED',
     status: 'COMPLETED',
     clientApproved: true,
     clientFeedback: comments || pis.clientFeedback,
     convertedToOrder: convertToOrder,
     orderReference: orderRef,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'COMPLETED',
     action: convertToOrder ? 'CLIENT_APPROVED_COMPLETE_CONVERTED' : 'CLIENT_APPROVED_COMPLETE',
     decision,
     comments,
    });
   },
  });
 };

 const handleClientRejectedRework = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'CLIENT_FEEDBACK') return;

  openDecisionDialog(pis, {
   title: 'Client rejected: capture feedback & rework (Stage 7-8)',
   defaultDecision: 'Client rejected; rework possible; sent back to R&D for corrections',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'RND_DEVELOPMENT',
     status: 'IN_PROGRESS',
     clientApproved: false,
     clientFeedback: comments,
     convertedToOrder: false,
     orderReference: undefined,
     loopCount: (pis.loopCount ?? 0) + 1,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'RND_DEVELOPMENT',
     action: 'CLIENT_REJECT_REWORK_TO_RND',
     decision,
     comments,
    });
   },
  });
 };

 const handleClientRejectedTerminate = (pis: PISRecord) => {
  if (taskType !== 'BD') return;
  if (pis.stage !== 'CLIENT_FEEDBACK') return;

  openDecisionDialog(pis, {
   title: 'Client rejected: capture feedback & terminate',
   defaultDecision: 'Client rejected; rework not possible; PIS terminated',
   mandatoryComment: true,
   onApply: (decision, comments) => {
    updatePIS(pis.id, {
     stage: 'TERMINATED',
     status: 'TERMINATED',
     clientApproved: false,
     clientFeedback: comments,
     convertedToOrder: false,
     orderReference: undefined,
     assignedBdRole: undefined,
     assignedBdStaffId: undefined,
    });
    addHistoryEntry(pis.id, {
     id: `hist-${Date.now()}`,
     timestamp: new Date(),
     actorName: currentUser?.name,
     actorRole: currentUser?.role ?? null,
     fromStage: pis.stage,
     toStage: 'TERMINATED',
     action: 'CLIENT_REJECT_TERMINATE',
     decision,
     comments,
    });
   },
  });
 };

 const getActionsForTask = (pis: PISRecord): TaskAction[] => {
  const actions: TaskAction[] = [];

  if (taskType === 'BD') {
   if ((currentRole === 'BD_MANAGER' || currentRole === 'BD_STAFF') && pis.stage === 'BD_INTAKE') {
    actions.push({
     label: 'Request missing info',
     variant: 'outline',
     onClick: () => handleBdRequestMissingInfo(pis),
    });
    actions.push({
     label: 'Validate & send to R&D Lead',
     variant: 'secondary',
     onClick: () => handleBdValidateAndMoveToRndLead(pis),
    });
    if (currentRole === 'BD_STAFF') {
     actions.push({
      label: 'Reject back to BD Manager',
      variant: 'outline',
      onClick: () => handleBdStaffRejectBriefToManager(pis),
     });
    }
   }

   if ((currentRole === 'BD_MANAGER' || currentRole === 'BD_STAFF') && pis.stage === 'ALIGNMENT') {
    actions.push({
     label: 'Approve WFP (to R&D Dev)',
     variant: 'secondary',
     onClick: () => handleBdApproveWfpToDevelopment(pis),
    });
    actions.push({
     label: 'Request changes',
     variant: 'outline',
     onClick: () => handleBdRequestWfpChanges(pis),
    });
    actions.push({
     label: 'Reject & terminate',
     variant: 'outline',
     onClick: () => handleBdRejectWfpTerminate(pis),
    });
   }

   if ((currentRole === 'BD_MANAGER' || currentRole === 'BD_STAFF') && pis.stage === 'CLIENT_FEEDBACK') {
    actions.push({
     label: 'Client approved (complete)',
     variant: 'secondary',
     onClick: () => handleClientApprovedComplete(pis, false),
    });
    actions.push({
     label: 'Client approved (+ sales order)',
     variant: 'secondary',
     onClick: () => handleClientApprovedComplete(pis, true),
    });
    actions.push({
     label: 'Client rejected (rework)',
     variant: 'outline',
     onClick: () => handleClientRejectedRework(pis),
    });
    actions.push({
     label: 'Client rejected (terminate)',
     variant: 'outline',
     onClick: () => handleClientRejectedTerminate(pis),
    });
   }
  }

  if (taskType === 'RND') {
   if (currentRole === 'RND_LEAD' && pis.stage === 'RND_LEAD_REVIEW') {
    actions.push({
     label: 'Create WFP & submit to BD',
     variant: 'secondary',
     onClick: () => handleRndLeadSubmitWfpToBd(pis),
    });
   }

   if ((currentRole === 'RND_LEAD' || currentRole === 'RND_STAFF') && pis.stage === 'RND_DEVELOPMENT') {
    actions.push({
     label: 'Approve dev (to Stage 6)',
     variant: 'secondary',
     onClick: () => handleRndDevApproveToTimeline(pis),
    });
    actions.push({
     label: 'Minor updates (continue)',
     variant: 'outline',
     onClick: () => handleRndDevMinorUpdates(pis),
    });
    actions.push({
     label: 'Reject WFP (to BD)',
     variant: 'outline',
     onClick: () => handleRndDevRejectToBd(pis),
    });
   }

   if ((currentRole === 'RND_LEAD' || currentRole === 'RND_STAFF') && pis.stage === 'QUALITY_REVIEW') {
    actions.push({
     label: 'Submit for review (Stage 7-8)',
     variant: 'secondary',
     onClick: () => handleRndApprovalSubmitForReview(pis),
    });
   }

   if (pis.stage === 'RND_DEVELOPMENT') {
    if (currentRole === 'RND_LEAD' && pis.status === 'PENDING') {
     actions.push({
      label: 'Approve review (to QA)',
      variant: 'secondary',
      onClick: () => handleRndReviewApproveToQa(pis),
     });
     actions.push({
      label: 'Reject review (corrections)',
      variant: 'outline',
      onClick: () => handleRndReviewRejectForCorrections(pis),
     });
    }

    if (currentRole === 'RND_STAFF' && pis.status !== 'PENDING') {
     actions.push({
      label: 'Resubmit after corrections',
      variant: 'secondary',
      onClick: () => handleRndCorrectionsResubmit(pis),
     });
    }
   }
  }

  if (taskType === 'QA') {
   if (pis.stage === 'QUALITY_REVIEW') {
    actions.push({
     label: 'Approve (to Packaging)',
     variant: 'secondary',
     onClick: () => handleQaApproveToPackaging(pis),
    });
    actions.push({
     label: 'Approve (to Dispatch)',
     variant: 'secondary',
     onClick: () => handleQaApproveToDispatch(pis),
    });
    actions.push({
     label: 'Reject (to R&D)',
     variant: 'outline',
     onClick: () => handleQaRejectToRnd(pis),
    });
   }
  }

  if (taskType === 'PKG') {
   if (pis.stage === 'PACKAGING') {
    actions.push({
     label: 'Finalize (to Dispatch)',
     variant: 'secondary',
     onClick: () => handlePackagingFinalizeToDispatch(pis),
    });
   }
   if (pis.stage === 'SAMPLE_DISPATCH') {
    actions.push({
     label: 'Mark dispatched',
     variant: 'secondary',
     onClick: () => handleDispatchMarkDispatchedToClientFeedback(pis),
    });
   }
  }

  return actions;
 };

 const bdStaffUsers: SystemUser[] = systemUsers.filter(
  (u) => u.role === 'BD_STAFF' && u.status === 'ACTIVE'
 );

 const getOngoingCountForStaff = (userId: string) => {
  return pisRecords.filter(
   (p) =>
    p.assignedBdStaffId === userId &&
    (p.status === 'PENDING' || p.status === 'IN_PROGRESS')
  ).length;
 };

 const handleConfirmAssignToStaff = (staff: SystemUser) => {
  if (!assignTargetPis) return;

  updatePIS(assignTargetPis.id, {
   assignedBdRole: 'BD_STAFF',
   assignedBdStaffId: staff.id,
  });
  setIsAssignDialogOpen(false);
  setAssignTargetPis(null);
 };

 const rndStaffUsers: SystemUser[] = systemUsers.filter(
  (u) => u.role === 'RND_STAFF' && u.status === 'ACTIVE'
 );

 const getOngoingCountForRndStaff = (userId: string) => {
  return pisRecords.filter(
   (p) =>
    p.rndStaffAssignment === userId &&
    (p.status === 'PENDING' || p.status === 'IN_PROGRESS') &&
    ((p.stage as any) === 'RND_DEVELOPMENT' || (p.stage as any) === 'RND_DEVELOPMENT')
  ).length;
 };

 const handleConfirmAssignToRndStaff = (staff: SystemUser) => {
  if (!assignRndTargetPis) return;

  updatePIS(assignRndTargetPis.id, {
   rndStaffAssignment: staff.id,
  });
  setIsRndAssignDialogOpen(false);
  setAssignRndTargetPis(null);
 };

 return (
  <div className="space-y-6">
   <div>
    <h2 className="text-2xl mb-2">{getTaskTitle()}</h2>
    <p className="text-gray-600">{getTaskDescription()}</p>
   </div>

   {(currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') && (
    <div className="flex items-center gap-3">
     <span className="text-sm text-gray-600">View mode:</span>
     <div className="inline-flex rounded-full border bg-white p-0.5 text-xs">
      <button
       type="button"
       onClick={() => setAdminViewMode('ALL')}
       className={cn(
        'px-3 py-1 rounded-full transition-colors',
        adminViewMode === 'ALL'
         ? 'bg-blue-600 text-white'
         : 'text-gray-600 hover:bg-gray-100'
       )}
      >
       All
      </button>
      <button
       type="button"
       onClick={() => setAdminViewMode('ASSIGNED')}
       className={cn(
        'px-3 py-1 rounded-full transition-colors',
        adminViewMode === 'ASSIGNED'
         ? 'bg-blue-600 text-white'
         : 'text-gray-600 hover:bg-gray-100'
       )}
      >
       Assigned
      </button>
     </div>
    </div>
   )}

   {/* Task Summary */}
   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card className="p-6">
     <div className="flex items-center gap-3">
      <div className="bg-yellow-500 p-3 rounded-lg">
       <Clock className="h-6 w-6 text-white" />
      </div>
      <div>
       <p className="text-sm text-gray-600">Pending</p>
       <p className="text-2xl text-yellow-600">{pendingTasks.length}</p>
      </div>
     </div>
    </Card>

    <Card className="p-6">
     <div className="flex items-center gap-3">
      <div className="bg-blue-500 p-3 rounded-lg">
       <AlertCircle className="h-6 w-6 text-white" />
      </div>
      <div>
       <p className="text-sm text-gray-600">In Progress</p>
       <p className="text-2xl text-blue-600">{inProgressTasks.length}</p>
      </div>
     </div>
    </Card>

    <Card className="p-6">
     <div className="flex items-center gap-3">
      <div className="bg-green-500 p-3 rounded-lg">
       <CheckCircle2 className="h-6 w-6 text-white" />
      </div>
      <div>
       <p className="text-sm text-gray-600">Total Tasks</p>
       <p className="text-2xl text-green-600">{myTasks.length}</p>
      </div>
     </div>
    </Card>
   </div>

   {/* Pending Tasks */}
   <Card className="p-6">
    <h3 className="text-lg font-medium mb-4">Pending Tasks</h3>
    {pendingTasks.length === 0 ? (
     <p className="text-gray-500 text-center py-8">No pending tasks</p>
    ) : (
     <div className="space-y-3">
      {pendingTasks.map((pis) => {
       let assignedLabel: string | undefined;

       if (taskType === 'BD' && pis.assignedBdStaffId) {
        const staff = bdStaffUsers.find((u) => u.id === pis.assignedBdStaffId);
        if (staff) {
         assignedLabel = `Assigned BD Staff: ${staff.name}`;
        }
       }

       if (taskType === 'RND' && pis.rndStaffAssignment) {
        const staff = rndStaffUsers.find((u) => u.id === pis.rndStaffAssignment);
        if (staff) {
         assignedLabel = `Assigned R&D Staff: ${staff.name}`;
        }
       }

       return (
        <TaskCard
         key={pis.id}
         pis={pis}
         currentRole={currentRole}
         taskType={taskType}
         assignedLabel={assignedLabel}
         onAssign={
          taskType === 'BD' && currentRole === 'BD_MANAGER'
           ? () => handleAssignToBdStaff(pis)
           : taskType === 'RND' && currentRole === 'RND_LEAD'
           ? () => handleAssignToRndStaff(pis)
           : undefined
         }
         onViewDetails={handleViewDetails}
         actions={getActionsForTask(pis)}
        />
       );
      })}
     </div>
    )}
   </Card>

   {/* In Progress Tasks */}
   <Card className="p-6">
    <h3 className="text-lg font-medium mb-4">In Progress</h3>
    {inProgressTasks.length === 0 ? (
     <p className="text-gray-500 text-center py-8">No tasks in progress</p>
    ) : (
     <div className="space-y-3">
      {inProgressTasks.map((pis) => {
       let assignedLabel: string | undefined;

       if (taskType === 'BD' && pis.assignedBdStaffId) {
        const staff = bdStaffUsers.find((u) => u.id === pis.assignedBdStaffId);
        if (staff) {
         assignedLabel = `Assigned BD Staff: ${staff.name}`;
        }
       }

       if (taskType === 'RND' && pis.rndStaffAssignment) {
        const staff = rndStaffUsers.find((u) => u.id === pis.rndStaffAssignment);
        if (staff) {
         assignedLabel = `Assigned R&D Staff: ${staff.name}`;
        }
       }

       return (
        <TaskCard
         key={pis.id}
         pis={pis}
         currentRole={currentRole}
         taskType={taskType}
         assignedLabel={assignedLabel}
         onViewDetails={handleViewDetails}
         actions={getActionsForTask(pis)}
        />
       );
      })}
     </div>
    )}
   </Card>

   {/* Assign to BD Staff Dialog (BD Manager only) */}
   {taskType === 'BD' && currentRole === 'BD_MANAGER' && (
    <Dialog
     open={isAssignDialogOpen}
     onOpenChange={(open) => {
      setIsAssignDialogOpen(open);
      if (!open) {
       setAssignTargetPis(null);
      }
     }}
    >
     <DialogContent className="max-w-xl">
      <DialogHeader>
       <DialogTitle>Assign to BD Staff</DialogTitle>
      </DialogHeader>
      {bdStaffUsers.length === 0 ? (
       <p className="text-gray-500 text-sm">
        No active BD Staff users found. Please create or activate BD Staff users first.
       </p>
      ) : (
       <div className="space-y-3 mt-2">
        {bdStaffUsers.map((staff) => {
         const ongoing = getOngoingCountForStaff(staff.id);
         return (
          <button
           key={staff.id}
           type="button"
           onClick={() => handleConfirmAssignToStaff(staff)}
           className="w-full text-left"
          >
           <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white">
              <UserIcon className="h-5 w-5" />
             </div>
             <div>
              <p className="font-medium">{staff.name}</p>
              <p className="text-xs text-gray-500">{staff.email}</p>
             </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
             <ClipboardList className="h-4 w-4 text-blue-500" />
             <span>
              Ongoing tasks: <span className="font-semibold">{ongoing}</span>
             </span>
             <Activity className="h-4 w-4 text-green-500" />
            </div>
           </div>
          </button>
         );
        })}
       </div>
      )}
     </DialogContent>
    </Dialog>
   )}

   {/* Assign to R&D Staff Dialog (R&D Lead only) */}
   {taskType === 'RND' && currentRole === 'RND_LEAD' && (
    <Dialog
     open={isRndAssignDialogOpen}
     onOpenChange={(open) => {
      setIsRndAssignDialogOpen(open);
      if (!open) {
       setAssignRndTargetPis(null);
      }
     }}
    >
     <DialogContent className="max-w-xl">
      <DialogHeader>
       <DialogTitle>Assign to R&D Staff</DialogTitle>
      </DialogHeader>
      {rndStaffUsers.length === 0 ? (
       <p className="text-gray-500 text-sm">
        No active R&D Staff users found. Please create or activate R&D Staff users first.
       </p>
      ) : (
       <div className="space-y-3 mt-2">
        {rndStaffUsers.map((staff) => {
         const ongoing = getOngoingCountForRndStaff(staff.id);
         return (
          <button
           key={staff.id}
           type="button"
           onClick={() => handleConfirmAssignToRndStaff(staff)}
           className="w-full text-left"
          >
           <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
              <UserIcon className="h-5 w-5" />
             </div>
             <div>
              <p className="font-medium">{staff.name}</p>
              <p className="text-xs text-gray-500">{staff.email}</p>
             </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
             <ClipboardList className="h-4 w-4 text-blue-500" />
             <span>
              Ongoing tasks: <span className="font-semibold">{ongoing}</span>
             </span>
             <Activity className="h-4 w-4 text-green-500" />
            </div>
           </div>
          </button>
         );
        })}
       </div>
      )}
     </DialogContent>
    </Dialog>
   )}

   <PISDetailsDialog
    pis={selectedPIS}
    currentRole={currentRole}
    isOpen={isDetailsOpen}
    onClose={handleCloseDetails}
   />

   {/* Decision / comments dialog */}
   <Dialog
    open={!!decisionContext}
    onOpenChange={(open) => {
     if (!open) {
      setDecisionContext(null);
      setDecisionValue('');
      setDecisionComments('');
     }
    }}
   >
    <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[85vh] overflow-y-auto">
     <DialogHeader>
      <DialogTitle>{decisionContext?.title ?? 'Confirm action'}</DialogTitle>
     </DialogHeader>

     <div className="space-y-4">
      <div className="space-y-2">
       <p className="text-sm text-gray-600">Decision</p>
       <Input value={decisionValue} onChange={(e) => setDecisionValue(e.target.value)} />
      </div>
      <div className="space-y-2">
       <p className="text-sm text-gray-600">
        Comments{decisionContext?.mandatoryComment ? ' (required)' : ''}
       </p>
       <Textarea
        value={decisionComments}
        onChange={(e) => setDecisionComments(e.target.value)}
        placeholder="Add details for audit trail…"
       />
      </div>
     </div>

     <DialogFooter>
      <Button
       variant="outline"
       onClick={() => {
        setDecisionContext(null);
        setDecisionValue('');
        setDecisionComments('');
       }}
      >
       Cancel
      </Button>
      <Button
       onClick={() => {
        if (!decisionContext) return;
        const needsComment = decisionContext.mandatoryComment;
        if (needsComment && !decisionComments.trim()) return;
        decisionContext.onApply(decisionValue.trim() || decisionContext.defaultDecision, decisionComments.trim());
        setDecisionContext(null);
        setDecisionValue('');
        setDecisionComments('');
       }}
      >
       Confirm
      </Button>
     </DialogFooter>
    </DialogContent>
   </Dialog>
  </div>
 );
}

function TaskCard({
 pis,
 currentRole,
 taskType,
 assignedLabel,
 onAssign,
 onViewDetails,
 actions,
}: {
 pis: PISRecord;
 currentRole: UserRole;
 taskType: 'BD' | 'RND' | 'QA' | 'PKG';
 assignedLabel?: string;
 onAssign?: () => void;
 onViewDetails?: (pis: PISRecord) => void;
 actions?: TaskAction[];
}) {
 return (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
   <div className="flex-1 min-w-0">
    <div className="flex items-center gap-3 mb-2">
     <button
      type="button"
      onClick={onViewDetails ? () => onViewDetails(pis) : undefined}
      className="font-medium text-blue-600 hover:underline text-left"
     >
      {pis.pisCode}
     </button>
     <Badge variant="outline">{getStageLabel(pis.stage)}</Badge>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
     <span className="truncate">{pis.customer}</span>
     <span className="hidden sm:inline">•</span>
     <span className="truncate">{pis.formulation}</span>
     <span className="hidden sm:inline">•</span>
     <span className="whitespace-nowrap">Updated: {pis.updatedAt.toLocaleDateString()}</span>
    </div>
    {assignedLabel && (
     <div className="mt-1 text-xs text-gray-500">
      {assignedLabel}
     </div>
    )}
   </div>
   <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
    {(actions ?? []).map((action) => (
     <Button
      key={action.label}
      size="sm"
      variant={action.variant}
      className="gap-2"
      onClick={action.onClick}
     >
      {action.label}
     </Button>
    ))}
    {pis.status === 'PENDING' && onAssign && (
     <Button size="sm" variant="outline" className="gap-2" onClick={onAssign}>
      {taskType === 'BD' && currentRole === 'BD_MANAGER'
       ? 'Assign to BD Staff'
       : taskType === 'RND' && currentRole === 'RND_LEAD'
       ? 'Assign to R&D Staff'
       : 'Assign'}
     </Button>
    )}
    <Button
     size="sm"
     className="gap-2"
     onClick={onViewDetails ? () => onViewDetails(pis) : undefined}
    >
     View Details
     <ArrowRight className="h-4 w-4" />
    </Button>
   </div>
  </div>
 );
}
