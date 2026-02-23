import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import eilogofull from '../assets/logo/eilogofull.svg';
import { useDebounce } from '../hooks/useDebounce';
import { PORequests, IssuedPOS, OngoingGRNs, MRNFGs, GRNList, Proofing } from '../components/ordermanagementcomp';

// ==================== CUSTOM HOOKS ====================
/**
 * useOutsideClick - Auto-closes dropdown on outside click
 * @param isOpen - Whether the dropdown is currently open
 * @param onClose - Callback to close the dropdown
 * @param triggerSelector - Optional CSS selector to exclude from outside-click detection
 */
const useOutsideClickLocal = (
  isOpen: boolean,
  onClose: () => void,
  triggerSelector?: string
) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is inside dropdown
      if (dropdownRef.current?.contains(target)) {
        return;
      }

      // Check if click is on trigger element (if selector provided)
      if (triggerSelector && target.closest(triggerSelector)) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerSelector]);

  return dropdownRef;
};

// ==================== TYPES ====================
interface Order {
  id: string;
  orderNo: string;
  orderType: string;
  sku: string;
  itemName: string;
  qty: number;
  unitRate: string;
  odrDate: string;
  estDelDate: string;
  comDate: string;
  licenseArch: string;
  licenseEI: string;
  stage: string;
  currentStatus: string;
  pocForCurrentStatus: string;
  comments: string;
  currentStage: number; // 1-6 for stages, 7 for closed
  stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'>; // Track status of each stage
  // Team assignment fields
  assignedTeam?: string; // Team category: CMT, RND_PRODUCT, QUALITY_COMPLIANCE, LABEL_DESIGN, PRODUCTION, DISPENSE, etc.
  assignedTo?: string; // Team member ID who is assigned this task
  assignedBy?: string; // Team lead ID who assigned this task
  assignedAt?: string; // Date when task was assigned
  // Enhanced fields
  priority?: 'high' | 'medium' | 'low';
  activityLog?: ActivityLogEntry[];
  attachments?: Attachment[];
  // BD Team Checkpoints
  poc_cmt_team?: 'yes' | 'no' | 'pending';
  label_design_status?: 'yes' | 'no' | 'pending';
  license_arch?: 'yes' | 'no' | 'pending';
  // RND Team Checkpoints
  poc_rnd_product?: 'yes' | 'no' | 'pending';
  poc_quality_compliance?: 'yes' | 'no' | 'pending';
  poc_label_design?: 'yes' | 'no' | 'pending';
  rm_review?: 'yes' | 'no' | 'pending';
  pm_review?: 'yes' | 'no' | 'pending';
  label_review_qc?: 'yes' | 'no' | 'pending';
  rm_sync?: 'yes' | 'no' | 'pending';
  pm_sync?: 'yes' | 'no' | 'pending';
}

interface ActivityLogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

interface OrderReview {
  id: string;
  orderType: string;
  orderNo: string;
  productSku: string;
  compatibleItem: string;
  brandName: string;
  qty: number;
  unitRate: string;
  odrDate: string;
  estDate: string;
  pocCmtTeam?: string;
  pocRead: string;
  pocQuality: string;
  pocLabel: string;
  rmReview: string;
  pmReview: string;
  labelDesign: string;
  labelReview: string;
  rmSync: string;
  pmSync: string;
  licenseEI: string;
  licenseArch: string;
  mfgProcess: string;
  homogenizerProcess: string;
  approvalStatus: string;
  updatedOn: string;
  upstageNo: string;
  comments: string;
  s1Actions: string;
}

interface AuditLog {
  id: string;
  orderId: string;
  timestamp: string;
  user: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface BOMItem {
  id: string;
  orderNo: string;
  itemName: string;
  componentName: string;
  quantity: number;
  unit: string;
  supplier: string;
  unitCost: number;
  totalCost: number;
  status: 'PENDING' | 'APPROVED' | 'IN_STOCK' | 'ORDERED';
}

// Mock BOM Data
const MOCK_BOM_DATA: Record<string, BOMItem[]> = {
  '1': [
    { id: 'bom-1-1', orderNo: 'SO-02907_1', itemName: 'SK.MEN CORREXION SPOT RECTIFYING FACIAL SERUM FOR DARK SPOTS 30ML', componentName: 'Aqua (Water)', quantity: 15000, unit: 'ml', supplier: 'Supplier A', unitCost: 2.5, totalCost: 37500, status: 'APPROVED' },
    { id: 'bom-1-2', orderNo: 'SO-02907_1', itemName: 'SK.MEN CORREXION SPOT RECTIFYING FACIAL SERUM FOR DARK SPOTS 30ML', componentName: 'Glycerin', quantity: 3000, unit: 'ml', supplier: 'Supplier B', unitCost: 8.5, totalCost: 25500, status: 'IN_STOCK' },
    { id: 'bom-1-3', orderNo: 'SO-02907_1', itemName: 'SK.MEN CORREXION SPOT RECTIFYING FACIAL SERUM FOR DARK SPOTS 30ML', componentName: 'Niacinamide', quantity: 900, unit: 'gm', supplier: 'Supplier C', unitCost: 45.0, totalCost: 40500, status: 'ORDERED' },
  ],
  '2': [
    { id: 'bom-2-1', orderNo: 'SO-02906_1', itemName: 'SKINKRAFT MEN ACNE EXFOLIATING FACIAL CREAM FOR SEVERE ACNE 50ML', componentName: 'Salicylic Acid', quantity: 150, unit: 'gm', supplier: 'Supplier D', unitCost: 120.0, totalCost: 18000, status: 'APPROVED' },
    { id: 'bom-2-2', orderNo: 'SO-02906_1', itemName: 'SKINKRAFT MEN ACNE EXFOLIATING FACIAL CREAM FOR SEVERE ACNE 50ML', componentName: 'Benzoyl Peroxide', quantity: 300, unit: 'gm', supplier: 'Supplier A', unitCost: 95.0, totalCost: 28500, status: 'IN_STOCK' },
    { id: 'bom-2-3', orderNo: 'SO-02906_1', itemName: 'SKINKRAFT MEN ACNE EXFOLIATING FACIAL CREAM FOR SEVERE ACNE 50ML', componentName: 'Cetyl Alcohol', quantity: 1500, unit: 'gm', supplier: 'Supplier E', unitCost: 12.0, totalCost: 18000, status: 'PENDING' },
  ],
  '3': [
    { id: 'bom-3-1', orderNo: 'SO-02961_1', itemName: 'SOLGLO HYBRID SUNSCREEN SPF 70 PA ++++ 50 ML', componentName: 'Zinc Oxide', quantity: 10000, unit: 'gm', supplier: 'Supplier F', unitCost: 25.0, totalCost: 250000, status: 'APPROVED' },
    { id: 'bom-3-2', orderNo: 'SO-02961_1', itemName: 'SOLGLO HYBRID SUNSCREEN SPF 70 PA ++++ 50 ML', componentName: 'Titanium Dioxide', quantity: 5000, unit: 'gm', supplier: 'Supplier B', unitCost: 35.0, totalCost: 175000, status: 'APPROVED' },
  ],
  '4': [
    { id: 'bom-4-1', orderNo: 'SO-02959_1', itemName: 'SKINKRAFT ULTRA SMOOTH FACE CLEANSER FOR SENSITIVE SKIN 100ML', componentName: 'Cetyl Alcohol', quantity: 1500, unit: 'gm', supplier: 'Supplier E', unitCost: 12.0, totalCost: 18000, status: 'IN_STOCK' },
    { id: 'bom-4-2', orderNo: 'SO-02959_1', itemName: 'SKINKRAFT ULTRA SMOOTH FACE CLEANSER FOR SENSITIVE SKIN 100ML', componentName: 'Sodium Lauryl Sulfate', quantity: 450, unit: 'ml', supplier: 'Supplier C', unitCost: 18.0, totalCost: 8100, status: 'APPROVED' },
  ],
  '5': [
    { id: 'bom-5-1', orderNo: 'SO-02972_1', itemName: 'MEDIMANOR MOISTAR DEEP RESTORE CREAM-25GM', componentName: 'Shea Butter', quantity: 2500, unit: 'gm', supplier: 'Supplier A', unitCost: 35.0, totalCost: 87500, status: 'APPROVED' },
  ],
};

// ==================== TEAM MANAGEMENT TYPES ====================
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'lead' | 'staff';
}

interface Team {
  id: string;
  name: string;
  category: 'CMT' | 'RND_PRODUCT' | 'QUALITY_COMPLIANCE' | 'LABEL_DESIGN';
  lead: TeamMember | null;
  staff: TeamMember[];
}

// ==================== TEAM MOCK DATA ====================
const MOCK_TEAMS: Team[] = [
  {
    id: 'team-1',
    name: 'POC CMT Team',
    category: 'CMT',
    lead: { id: 'lead-1', name: 'Rajesh Kumar', email: 'rajesh.kumar@company.com', role: 'lead' },
    staff: [
      { id: 'staff-1', name: 'Priya Sharma', email: 'priya.sharma@company.com', role: 'staff' },
      { id: 'staff-2', name: 'Amit Patel', email: 'amit.patel@company.com', role: 'staff' },
      { id: 'staff-3', name: 'Neha Singh', email: 'neha.singh@company.com', role: 'staff' },
    ]
  },
  {
    id: 'team-2',
    name: 'POC R&D Product Team',
    category: 'RND_PRODUCT',
    lead: { id: 'lead-2', name: 'Dr. Suresh Reddy', email: 'suresh.reddy@company.com', role: 'lead' },
    staff: [
      { id: 'staff-4', name: 'Kavita Desai', email: 'kavita.desai@company.com', role: 'staff' },
      { id: 'staff-5', name: 'Ravi Verma', email: 'ravi.verma@company.com', role: 'staff' },
      { id: 'staff-6', name: 'Sunita Joshi', email: 'sunita.joshi@company.com', role: 'staff' },
      { id: 'staff-7', name: 'Anil Mehta', email: 'anil.mehta@company.com', role: 'staff' },
    ]
  },
  {
    id: 'team-3',
    name: 'POC Quality Compliance Team',
    category: 'QUALITY_COMPLIANCE',
    lead: { id: 'lead-3', name: 'Meera Nair', email: 'meera.nair@company.com', role: 'lead' },
    staff: [
      { id: 'staff-8', name: 'Vijay Iyer', email: 'vijay.iyer@company.com', role: 'staff' },
      { id: 'staff-9', name: 'Deepa Rao', email: 'deepa.rao@company.com', role: 'staff' },
      { id: 'staff-10', name: 'Kiran Kulkarni', email: 'kiran.kulkarni@company.com', role: 'staff' },
    ]
  },
  {
    id: 'team-4',
    name: 'POC Label Design Team',
    category: 'LABEL_DESIGN',
    lead: { id: 'lead-4', name: 'Arjun Bhat', email: 'arjun.bhat@company.com', role: 'lead' },
    staff: [
      { id: 'staff-11', name: 'Pooja Menon', email: 'pooja.menon@company.com', role: 'staff' },
      { id: 'staff-12', name: 'Sanjay Gupta', email: 'sanjay.gupta@company.com', role: 'staff' },
    ]
  },
];

// ==================== MOCK DATA (Replace with API call later) ====================
const MOCK_ORDERS: Order[] = [
  // Planning Tasks (Stage 1)
  {
    id: '1',
    orderNo: 'EI/PIS/DEC/24/0016',
    orderType: 'NEW ORDER',
    sku: 'EXBD24126-1',
    itemName: 'R&D Lead Review & Assignment',
    qty: 3000,
    unitRate: '₹125.50',
    odrDate: '2025-12-21',
    estDelDate: '2026-01-21',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'no',
    stage: 'Planning',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'BioHealth Labs',
    comments: 'High priority - Review required for new formulation',
    currentStage: 1,
    stageProgress: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'RND_PRODUCT',
    assignedTo: 'staff-4',
    assignedBy: 'lead-2',
    assignedAt: '2025-12-22',
    priority: 'high',
    activityLog: [
      { id: 'log-1', action: 'Task Created', performedBy: 'System', performedAt: '2025-12-21T10:30:00', details: 'Order created from SO page' },
      { id: 'log-2', action: 'Task Assigned', performedBy: 'Dr. Suresh Reddy', performedAt: '2025-12-22T09:15:00', details: 'Assigned to Kavita Desai', oldValue: 'Unassigned', newValue: 'Kavita Desai' },
    ],
    attachments: [
      { id: 'att-1', name: 'PO_Document.pdf', type: 'application/pdf', size: '245 KB', uploadedBy: 'Rajesh Kumar', uploadedAt: '2025-12-21', url: '#' },
    ]
  },
  {
    id: '2',
    orderNo: 'EI/PIS/NOV/24/0020',
    orderType: 'REORDER',
    sku: 'EXBD24110-1',
    itemName: 'Stage 2: Alignment',
    qty: 5000,
    unitRate: '₹89.75',
    odrDate: '2024-11-18',
    estDelDate: '2026-01-18',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'Planning',
    currentStatus: 'In Progress',
    pocForCurrentStatus: 'Dawn Sanitizing',
    comments: 'Requires team alignment before proceeding',
    currentStage: 1,
    stageProgress: { 1: 'in-progress', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'CMT',
    assignedTo: 'staff-1',
    assignedBy: 'lead-1',
    assignedAt: '2024-11-20',
    priority: 'medium',
    activityLog: [
      { id: 'act-3', action: 'Task Assigned', performedBy: 'lead-1', performedAt: '2024-11-20 11:00', details: 'Task assigned to CMT team' }
    ],
    attachments: []
  },
  {
    id: '3',
    orderNo: 'EI/PIS/AUG/24/0080',
    orderType: 'MODIFIED',
    sku: 'EXRND24050-1',
    itemName: 'R&D Lead Review & Assignment',
    qty: 8000,
    unitRate: '₹156.00',
    odrDate: '2024-08-10',
    estDelDate: '2025-10-01',
    comDate: 'N/A',
    licenseArch: 'no',
    licenseEI: 'yes',
    stage: 'Planning',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'Nova Cosmetics',
    comments: 'Modified specs - awaiting approval',
    currentStage: 1,
    stageProgress: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'RND_PRODUCT',
    assignedTo: 'staff-5',
    assignedBy: 'lead-2',
    assignedAt: '2024-08-12',
    priority: 'low',
    activityLog: [
      { id: 'act-4', action: 'Order Created', performedBy: 'system', performedAt: '2024-08-10 09:00', details: 'Modified order received' }
    ],
    attachments: []
  },
  
  // Design Tasks (Stage 2)
  {
    id: '4',
    orderNo: 'EI/PIS/JUN/24/0120',
    orderType: 'NEW ORDER',
    sku: 'EXQA24010-1',
    itemName: 'Stage 6: Quality',
    qty: 3000,
    unitRate: '₹210.25',
    odrDate: '2024-06-26',
    estDelDate: '2025-12-26',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'Design',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'MedTech Solutions',
    comments: 'Design review pending for quality standards',
    currentStage: 2,
    stageProgress: { 1: 'completed', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'LABEL_DESIGN',
    assignedTo: 'staff-11',
    assignedBy: 'lead-4',
    assignedAt: '2024-06-28',
    priority: 'high',
    activityLog: [
      { id: 'act-5', action: 'Order Created', performedBy: 'system', performedAt: '2024-06-26 08:30', details: 'New order received' },
      { id: 'act-6', action: 'Stage Advanced', performedBy: 'lead-1', performedAt: '2024-06-27 14:00', details: 'Planning completed, moved to Design' }
    ],
    attachments: [
      { id: 'att-2', name: 'Design_Brief.pdf', type: 'pdf', size: '1.2 MB', uploadedBy: 'lead-4', uploadedAt: '2024-06-28', url: '#' }
    ]
  },
  {
    id: '5',
    orderNo: 'EI/PIS/SEP/24/0095',
    orderType: 'REORDER',
    sku: 'EXBD24251-1',
    itemName: 'Stage 3: Assessment & Hardware',
    qty: 12000,
    unitRate: '₹95.80',
    odrDate: '2024-09-15',
    estDelDate: '2026-02-10',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'no',
    stage: 'Design',
    currentStatus: 'In Progress',
    pocForCurrentStatus: 'TechFlow Industries',
    comments: 'Hardware assessment in progress',
    currentStage: 2,
    stageProgress: { 1: 'completed', 2: 'in-progress', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'LABEL_DESIGN',
    assignedTo: 'staff-12',
    assignedBy: 'lead-4',
    assignedAt: '2024-09-18',
    priority: 'medium',
    activityLog: [
      { id: 'act-7', action: 'Status Changed', performedBy: 'staff-12', performedAt: '2024-09-20 10:00', details: 'Started working on assessment', oldValue: 'Pending', newValue: 'In Progress' }
    ],
    attachments: []
  },

  // Label Tasks (Stage 3)
  {
    id: '6',
    orderNo: 'EI/PIS/MAR/24/0045',
    orderType: 'NEW ORDER',
    sku: 'LBLD24015-1',
    itemName: 'Label Design - Premium Series',
    qty: 6000,
    unitRate: '₹45.50',
    odrDate: '2024-03-12',
    estDelDate: '2025-05-20',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'Label',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'Creative Labs',
    comments: 'Label artwork needs final approval',
    currentStage: 3,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'LABEL_DESIGN',
    assignedTo: 'staff-11',
    assignedBy: 'lead-4',
    assignedAt: '2024-03-15',
    priority: 'high',
    activityLog: [
      { id: 'act-8', action: 'Task Assigned', performedBy: 'lead-4', performedAt: '2024-03-15 09:00', details: 'Assigned to Label Design team' }
    ],
    attachments: [
      { id: 'att-3', name: 'Label_Mockup_v1.ai', type: 'ai', size: '4.5 MB', uploadedBy: 'staff-11', uploadedAt: '2024-03-16', url: '#' }
    ]
  },
  {
    id: '7',
    orderNo: 'EI/PIS/APR/24/0078',
    orderType: 'MODIFIED',
    sku: 'LBLD24032-1',
    itemName: 'Label Compliance Update',
    qty: 4500,
    unitRate: '₹38.90',
    odrDate: '2024-04-22',
    estDelDate: '2025-06-15',
    comDate: 'N/A',
    licenseArch: 'no',
    licenseEI: 'yes',
    stage: 'Label',
    currentStatus: 'In Progress',
    pocForCurrentStatus: 'Regulatory Team',
    comments: 'Updating labels for new compliance standards',
    currentStage: 3,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'in-progress', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'QUALITY_COMPLIANCE',
    assignedTo: 'staff-8',
    assignedBy: 'lead-3',
    assignedAt: '2024-04-25',
    priority: 'medium',
    activityLog: [
      { id: 'act-9', action: 'Status Changed', performedBy: 'staff-8', performedAt: '2024-04-28 11:30', details: 'Started compliance review', oldValue: 'Pending', newValue: 'In Progress' }
    ],
    attachments: [
      { id: 'att-4', name: 'Compliance_Guidelines.pdf', type: 'pdf', size: '890 KB', uploadedBy: 'lead-3', uploadedAt: '2024-04-25', url: '#' }
    ]
  },

  // Production Tasks (Stage 4)
  {
    id: '8',
    orderNo: 'EI/PIS/MAY/24/0112',
    orderType: 'NEW ORDER',
    sku: 'PROD24088-1',
    itemName: 'Production Batch - Series A',
    qty: 15000,
    unitRate: '₹185.00',
    odrDate: '2024-05-08',
    estDelDate: '2025-07-30',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'Production',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'Manufacturing Unit 1',
    comments: 'Production scheduling pending',
    currentStage: 4,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'pending', 5: 'pending', 6: 'pending' },
    assignedTeam: 'PRODUCTION',
    assignedTo: 'prod-staff-1',
    assignedBy: 'prod-lead-1',
    assignedAt: '2024-05-10',
    priority: 'high',
    activityLog: [
      { id: 'act-10', action: 'Task Assigned', performedBy: 'prod-lead-1', performedAt: '2024-05-10 08:00', details: 'Assigned to Production team' }
    ],
    attachments: [
      { id: 'att-5', name: 'Production_Schedule.xlsx', type: 'xlsx', size: '245 KB', uploadedBy: 'prod-lead-1', uploadedAt: '2024-05-10', url: '#' }
    ]
  },
  {
    id: '9',
    orderNo: 'EI/PIS/JUL/24/0145',
    orderType: 'REORDER',
    sku: 'PROD24101-1',
    itemName: 'Production Batch - Premium',
    qty: 10000,
    unitRate: '₹220.50',
    odrDate: '2024-07-14',
    estDelDate: '2025-09-25',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'no',
    stage: 'Production',
    currentStatus: 'In Progress',
    pocForCurrentStatus: 'Manufacturing Unit 2',
    comments: 'Production line active - 60% complete',
    currentStage: 4,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'in-progress', 5: 'pending', 6: 'pending' },
    assignedTeam: 'PRODUCTION',
    assignedTo: 'prod-staff-2',
    assignedBy: 'prod-lead-1',
    assignedAt: '2024-07-16',
    priority: 'medium',
    activityLog: [
      { id: 'act-11', action: 'Status Changed', performedBy: 'prod-staff-2', performedAt: '2024-07-18 09:30', details: 'Production started', oldValue: 'Pending', newValue: 'In Progress' },
      { id: 'act-12', action: 'Comment Added', performedBy: 'prod-staff-2', performedAt: '2024-07-25 16:00', details: 'Production at 60% completion' }
    ],
    attachments: []
  },

  // Dispense/Bundle Tasks (Stage 5)
  {
    id: '10',
    orderNo: 'EI/PIS/OCT/24/0158',
    orderType: 'NEW ORDER',
    sku: 'DISP24045-1',
    itemName: 'Dispensing & Packaging - Batch 1',
    qty: 7500,
    unitRate: '₹78.25',
    odrDate: '2024-10-05',
    estDelDate: '2025-12-18',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'Dispense',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'Packaging Division',
    comments: 'Awaiting packaging materials',
    currentStage: 5,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'pending', 6: 'pending' },
    assignedTeam: 'DISPENSE',
    assignedTo: 'disp-staff-1',
    assignedBy: 'disp-lead-1',
    assignedAt: '2024-10-08',
    priority: 'low',
    activityLog: [
      { id: 'act-13', action: 'Task Assigned', performedBy: 'disp-lead-1', performedAt: '2024-10-08 10:00', details: 'Assigned to Dispense team' }
    ],
    attachments: []
  },
  {
    id: '11',
    orderNo: 'EI/PIS/NOV/24/0172',
    orderType: 'REORDER',
    sku: 'BUND24028-1',
    itemName: 'Bundle Assembly - Holiday Pack',
    qty: 9000,
    unitRate: '₹142.00',
    odrDate: '2024-11-12',
    estDelDate: '2026-01-05',
    comDate: 'N/A',
    licenseArch: 'no',
    licenseEI: 'yes',
    stage: 'Bundle',
    currentStatus: 'In Progress',
    pocForCurrentStatus: 'Assembly Team',
    comments: 'Bundle assembly ongoing - 45% complete',
    currentStage: 5,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'in-progress', 6: 'pending' },
    assignedTeam: 'BUNDLE',
    assignedTo: 'bund-staff-1',
    assignedBy: 'bund-lead-1',
    assignedAt: '2024-11-15',
    priority: 'medium',
    activityLog: [
      { id: 'act-14', action: 'Status Changed', performedBy: 'bund-staff-1', performedAt: '2024-11-18 08:30', details: 'Started bundle assembly', oldValue: 'Pending', newValue: 'In Progress' }
    ],
    attachments: [
      { id: 'att-6', name: 'Holiday_Pack_Specs.pdf', type: 'pdf', size: '1.8 MB', uploadedBy: 'bund-lead-1', uploadedAt: '2024-11-15', url: '#' }
    ]
  },

  // Invoice/Quality Tasks (Stage 6)
  {
    id: '12',
    orderNo: 'EI/PIS/DEC/24/0188',
    orderType: 'MODIFIED',
    sku: 'INV24062-1',
    itemName: 'Final Quality Check & Invoice',
    qty: 5500,
    unitRate: '₹195.75',
    odrDate: '2024-12-03',
    estDelDate: '2026-02-14',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'Invoice',
    currentStatus: 'Pending',
    pocForCurrentStatus: 'Quality Assurance',
    comments: 'Final QC before invoicing',
    currentStage: 6,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'pending' },
    assignedTeam: 'QUALITY_COMPLIANCE',
    assignedTo: 'staff-9',
    assignedBy: 'lead-3',
    assignedAt: '2024-12-05',
    priority: 'high',
    activityLog: [
      { id: 'act-15', action: 'Task Assigned', performedBy: 'lead-3', performedAt: '2024-12-05 09:00', details: 'Assigned for final QC' }
    ],
    attachments: [
      { id: 'att-7', name: 'QC_Checklist.pdf', type: 'pdf', size: '320 KB', uploadedBy: 'lead-3', uploadedAt: '2024-12-05', url: '#' }
    ]
  },
  {
    id: '13',
    orderNo: 'EI/PIS/JAN/25/0201',
    orderType: 'NEW ORDER',
    sku: 'QA24075-1',
    itemName: 'Quality Certification Process',
    qty: 4000,
    unitRate: '₹168.50',
    odrDate: '2025-01-15',
    estDelDate: '2026-03-10',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'no',
    stage: 'Quality',
    currentStatus: 'In Progress',
    pocForCurrentStatus: 'QA Department',
    comments: 'Certification documentation in progress',
    currentStage: 6,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'in-progress' },
    assignedTeam: 'QUALITY_COMPLIANCE',
    assignedTo: 'staff-10',
    assignedBy: 'lead-3',
    assignedAt: '2025-01-18',
    priority: 'low',
    activityLog: [
      { id: 'act-16', action: 'Status Changed', performedBy: 'staff-10', performedAt: '2025-01-20 14:00', details: 'Started certification process', oldValue: 'Pending', newValue: 'In Progress' }
    ],
    attachments: [
      { id: 'att-8', name: 'Certification_Template.docx', type: 'docx', size: '156 KB', uploadedBy: 'staff-10', uploadedAt: '2025-01-20', url: '#' }
    ]
  },
  ...Array.from({ length: 55 }, (_, i) => {
    const idx = i + 1;
    const id = String(100 + idx);
    const orderNo = `SO-${String(30000 + idx).padStart(5, '0')}`;
    const orderType = (['NEW ORDER', 'REORDER', 'MODIFIED'] as const)[idx % 3];
    const skuPrefixes = ['SK2109', 'SK2202', 'PR000', 'SK2110', 'SK2108'] as const;
    const sku = `${skuPrefixes[idx % skuPrefixes.length]}${String(1000 + (idx * 37) % 9000)}`;
    const names = [
      'SKINKRAFT ULTRA SMOOTH FACE CLEANSER FOR SENSITIVE SKIN 60ML',
      'SKINKRAFT FOR MEN SEBUM CONTROL FACE CLEANSER FOR OILY SKIN 60ML',
      'SKINKRAFT BARRIER REPAIR CREAM FOR DRY SKIN 45ML',
      'SKINKRAFT BRIGHTSIDE FACIAL SERUM FOR DULL SKIN 30ML',
      'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML'
    ] as const;
    const itemName = names[idx % names.length];
    const qtyOptions = [1000, 2000, 3000, 5000, 6000, 8000, 10000, 15000, 20000] as const;
    const qty = qtyOptions[idx % qtyOptions.length];

    const unitRate = (30 + ((idx * 173) % 120) + ((idx * 7) % 100) / 100).toFixed(2);

    const month = 8 + (idx % 5); // Aug..Dec
    const day = 1 + (idx % 28);
    const odrDate = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const estDelDate = `2025-${String(Math.min(month + 1, 12)).padStart(2, '0')}-${String(Math.min(day + 7, 28)).padStart(2, '0')}`;
    const comDate = 'CDD';

    const licenseArch = idx % 4 === 0 ? 'no' : 'yes';
    const licenseEI = idx % 6 === 0 ? 'no' : 'yes';

    // Distribute stages across mock orders
    const currentStage = 1 + (idx % 6);
    const stageNames = ['ORDERS REVIEW', 'PURCHASE PLAN', 'CONNECTIVITY TRACKER', 'PRODUCTION PLANNER', 'PRODUCTION TRACKER', 'ORDER CLOSURE'];
    const stage = stageNames[currentStage - 1];
    
    const stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'> = {};
    for (let s = 1; s <= 6; s++) {
      if (s < currentStage) stageProgress[s] = 'completed';
      else if (s === currentStage) stageProgress[s] = 'in-progress';
      else stageProgress[s] = 'pending';
    }

    const statusMap: Record<string, string> = {
      'ORDERS REVIEW': 'UNDER REVIEW',
      'PURCHASE PLAN': 'UNDER PLANNING',
      'CONNECTIVITY TRACKER': 'CONNECTIVITY TRACKING',
      'PRODUCTION PLANNER': 'PLANNING PRODUCTION',
      'PRODUCTION TRACKER': 'IN PRODUCTION',
      'ORDER CLOSURE': 'READY TO CLOSE'
    };

    return {
      id,
      orderNo,
      orderType,
      sku,
      itemName,
      qty,
      unitRate,
      odrDate,
      estDelDate,
      comDate,
      licenseArch,
      licenseEI,
      stage,
      currentStatus: statusMap[stage],
      pocForCurrentStatus: currentStage <= 2 ? '-' : '*#S' + currentStage + ' IN PROGRESS*',
      comments: '-',
      currentStage,
      stageProgress
    };
  })
];

// ==================== API FUNCTIONS (To be implemented with backend) ====================
const fetchOrders = async (): Promise<Order[]> => {
  // Load from multiple sources:
  // 1. Mock orders
  // 2. SO/PO synced orders from SalesAndPurchase
  
  return new Promise((resolve) => {
    setTimeout(() => {
      let allOrders = [...MOCK_ORDERS];
      
      // Load synced orders from SalesAndPurchase
      try {
        const syncedOrders = JSON.parse(localStorage.getItem('eisthetic_order_hub_orders') || '[]');
        allOrders = [...allOrders, ...syncedOrders];
      } catch (error) {
        console.error('Error loading synced orders:', error);
      }
      
      resolve(initializeOrderStages(allOrders));
    }, 500);
  });
};

const updateOrderType = async (_orderId: string, _newType: string): Promise<void> => {
  // TODO: Replace with actual API call
  // Example: await fetch(`/api/orders/${orderId}`, {
  //   method: 'PATCH',
  //   body: JSON.stringify({ orderType: newType })
  // });
};

const ORDER_TYPE_OPTIONS = ['NEW ORDER', 'REORDER', 'MODIFIED'] as const;

// ==================== STAGE MANAGEMENT FUNCTIONS ====================
const STAGES = [
  { id: 1, name: 'Orders Review', tabId: 'orders-review' },
  { id: 2, name: 'Purchase Plan', tabId: 'purchase-plan' },
  { id: 3, name: 'Connectivity Tracker', tabId: 'purchase-planner' },
  { id: 4, name: 'Production Planner', tabId: 'production-planner' },
  { id: 5, name: 'Production Tracker', tabId: 'production-tracker' },
  { id: 6, name: 'Order Closure', tabId: 'order-closure' },
];

const initializeOrderStages = (orders: Order[]): Order[] => {
  return orders.map(order => {
    if (!order.currentStage) {
      // Determine stage from legacy 'stage' field
      let currentStage = 1;
      if (order.stage === 'PURCHASE PLAN') currentStage = 2;
      else if (order.stage === 'CONNECTIVITY TRACKER') currentStage = 3;
      else if (order.stage === 'PRODUCTION PLANNER') currentStage = 4;
      else if (order.stage === 'PRODUCTION TRACKER') currentStage = 5;
      else if (order.stage === 'ORDER CLOSURE') currentStage = 6;

      return {
        ...order,
        currentStage,
        stageProgress: {
          1: currentStage > 1 ? 'completed' : 'in-progress',
          2: currentStage > 2 ? 'completed' : currentStage === 2 ? 'in-progress' : 'pending',
          3: currentStage > 3 ? 'completed' : currentStage === 3 ? 'in-progress' : 'pending',
          4: currentStage > 4 ? 'completed' : currentStage === 4 ? 'in-progress' : 'pending',
          5: currentStage > 5 ? 'completed' : currentStage === 5 ? 'in-progress' : 'pending',
          6: currentStage > 6 ? 'completed' : currentStage === 6 ? 'in-progress' : 'pending',
        },
      };
    }
    return order;
  });
};

const getStageStatusIcon = (stageStatus: 'pending' | 'in-progress' | 'completed'): string => {
  switch (stageStatus) {
    case 'completed':
      return '✓';
    case 'in-progress':
      return '⚙';
    case 'pending':
      return '○';
    default:
      return '○';
  }
};

const OrderHub = () => {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orderHubActiveTab') || 'orders-tracker';
    }
    return 'orders-tracker';
  });
  const [purchasePlanSubTab, setPurchasePlanSubTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('purchasePlanSubTab') || 'po-plan';
    }
    return 'po-plan';
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewOrders, setReviewOrders] = useState<OrderReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [_currentTime, setCurrentTime] = useState(new Date());
  const [openOrderTypeDropdown, setOpenOrderTypeDropdown] = useState<string | null>(null);
  const [openLicenseDropdown, setOpenLicenseDropdown] = useState<{
    orderId: string;
    type: 'arch' | 'ei';
  } | null>(null);
  const [openHmgDropdown, setOpenHmgDropdown] = useState<string | null>(null);
  const [openMrpDropdown, setOpenMrpDropdown] = useState<string | null>(null);
  const [licenseEdits, setLicenseEdits] = useState<Record<string, {
    mfgUnit: string;
    licenseNo: string;
    status: 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS';
  }>>({});
  const [hmgEdits, setHmgEdits] = useState<Record<string, {
    status: 'YES' | 'NO';
  }>>({});
  const [mrpEdits, setMrpEdits] = useState<Record<string, {
    status: 'MRP REV' | 'PO PLAN';
  }>>({});
  const [commentEdits, setCommentEdits] = useState<Record<string, string>>({});
  const [openCommentModal, setOpenCommentModal] = useState<string | null>(null);
  const [openPocModal, setOpenPocModal] = useState<string | null>(null);
  const [pocModalOrder, setPocModalOrder] = useState<any>(null);
  const [commentModalText, setCommentModalText] = useState('');
  const [lastUpdatedDates, setLastUpdatedDates] = useState<Record<string, string>>({});

  // Stage buttons modals
  const [consoReportModal, setConsoReportModal] = useState<string | null>(null);
  const [priceReportModal, setPriceReportModal] = useState<string | null>(null);
  const [changeStatusModal, setChangeStatusModal] = useState<string | null>(null);
  const [selectedStatusForChange, setSelectedStatusForChange] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [stockPlanModal, setStockPlanModal] = useState(false);
  const [stockPlanData, setStockPlanData] = useState<Array<{
    id: string;
    component: string;
    currentStock: number;
    requiredStock: number;
    unit: string;
    supplier: string;
    leadTime: number;
    notes: string;
  }>>([
    { id: '1', component: 'Component A', currentStock: 100, requiredStock: 150, unit: 'Kg', supplier: 'Supplier 1', leadTime: 7, notes: 'Priority' },
    { id: '2', component: 'Component B', currentStock: 50, requiredStock: 200, unit: 'Pieces', supplier: 'Supplier 2', leadTime: 14, notes: '' },
    { id: '3', component: 'Component C', currentStock: 200, requiredStock: 300, unit: 'Liters', supplier: 'Supplier 1', leadTime: 10, notes: 'Urgent' },
  ]);
  
  // Team Management states
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [teamManagementModal, setTeamManagementModal] = useState(false);
  const [openPocDropdown, setOpenPocDropdown] = useState<{ orderId: string; type: 'cmt' | 'rnd' | 'quality' | 'label' } | null>(null);
  
  // Team Management - Add/Edit Member states
  const [editingMember, setEditingMember] = useState<{ teamId: string; member: TeamMember | null; isLead: boolean } | null>(null);
  const [memberFormData, setMemberFormData] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [teamNameInput, setTeamNameInput] = useState('');

  // Team Management Handlers
  const handleAddStaffMember = (teamId: string) => {
    setEditingMember({ teamId, member: null, isLead: false });
    setMemberFormData({ name: '', email: '' });
  };

  const handleAssignTeamLead = (teamId: string) => {
    setEditingMember({ teamId, member: null, isLead: true });
    setMemberFormData({ name: '', email: '' });
  };

  const handleEditMember = (teamId: string, member: TeamMember, isLead: boolean) => {
    setEditingMember({ teamId, member, isLead });
    setMemberFormData({ name: member.name, email: member.email });
  };

  const handleSaveMember = () => {
    if (!editingMember || !memberFormData.name.trim() || !memberFormData.email.trim()) return;
    
    setTeams(prev => prev.map(team => {
      if (team.id !== editingMember.teamId) return team;
      
      if (editingMember.isLead) {
        // Add/Edit Lead
        const newLead: TeamMember = {
          id: editingMember.member?.id || `lead-${Date.now()}`,
          name: memberFormData.name.trim(),
          email: memberFormData.email.trim(),
          role: 'lead'
        };
        return { ...team, lead: newLead };
      } else {
        // Add/Edit Staff
        if (editingMember.member) {
          // Edit existing staff
          return {
            ...team,
            staff: team.staff.map(s => 
              s.id === editingMember.member!.id 
                ? { ...s, name: memberFormData.name.trim(), email: memberFormData.email.trim() }
                : s
            )
          };
        } else {
          // Add new staff
          const newStaff: TeamMember = {
            id: `staff-${Date.now()}`,
            name: memberFormData.name.trim(),
            email: memberFormData.email.trim(),
            role: 'staff'
          };
          return { ...team, staff: [...team.staff, newStaff] };
        }
      }
    }));
    
    setEditingMember(null);
    setMemberFormData({ name: '', email: '' });
  };

  const handleDeleteMember = (teamId: string, memberId: string, isLead: boolean) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    
    setTeams(prev => prev.map(team => {
      if (team.id !== teamId) return team;
      
      if (isLead) {
        return { ...team, lead: null };
      } else {
        return { ...team, staff: team.staff.filter(s => s.id !== memberId) };
      }
    }));
  };

  const handleEditTeamName = (teamId: string, currentName: string) => {
    setEditingTeamName(teamId);
    setTeamNameInput(currentName);
  };

  const handleSaveTeamName = (teamId: string) => {
    if (!teamNameInput.trim()) return;
    
    setTeams(prev => prev.map(team => 
      team.id === teamId ? { ...team, name: teamNameInput.trim() } : team
    ));
    setEditingTeamName(null);
    setTeamNameInput('');
  };
  
  // Get user role from localStorage - only SUPER_ADMIN can edit
  const userRole = typeof window !== 'undefined' ? (localStorage.getItem('adminUserRole') || 'SUPER_ADMIN') : 'SUPER_ADMIN';
  const isViewOnly = userRole !== 'SUPER_ADMIN';

  const dropdownRef = useRef<HTMLDivElement>(null);
  const licenseDropdownRef = useRef<HTMLDivElement>(null);
  const hmgDropdownRef = useRef<HTMLDivElement>(null);
  const mrpDropdownRef = useRef<HTMLDivElement>(null);
  const commentModalRef = useRef<HTMLDivElement>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewHistoryOrderId, setViewHistoryOrderId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  // Connectivity Tracker states
  const [connectivityRecords, setConnectivityRecords] = useState<Record<string, any>>({});
  const [showAddConnectivityRow, setShowAddConnectivityRow] = useState(false);
  const [newConnectivityRecord, setNewConnectivityRecord] = useState<any>(null);

  // Production Planner states
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [productionPlannerMfgUnits, setProductionPlannerMfgUnits] = useState<Record<string, string>>({});
  const [rmReqDates, setRmReqDates] = useState<Record<string, string>>({});
  const [pmReqDates, setPmReqDates] = useState<Record<string, string>>({});
  const [bundleModalOpen, setBundleModalOpen] = useState<string | null>(null);
  const [bundleQty, setBundleQty] = useState('');
  
  // Production Tracker states
  const [trackerWarehouseFilter, setTrackerWarehouseFilter] = useState('ALL');
  const [trackerSearchQuery, setTrackerSearchQuery] = useState('');

  // ==================== HANDLERS ====================
  const handleOrderCheckboxChange = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const getSelectedOrdersBOM = (): BOMItem[] => {
    const bomItems: BOMItem[] = [];
    selectedOrderIds.forEach(orderId => {
      if (MOCK_BOM_DATA[orderId]) {
        bomItems.push(...MOCK_BOM_DATA[orderId]);
      }
    });
    return bomItems;
  };

  // ==================== OUTSIDE-CLICK HANDLERS ====================
  // Only handle order type dropdown (the main one)
  useOutsideClickLocal(!!openOrderTypeDropdown, () => setOpenOrderTypeDropdown(null));
  
  // Manual outside-click handlers for other dropdowns
  useEffect(() => {
    if (!openLicenseDropdown && !openHmgDropdown && !openMrpDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on a trigger or inside a dropdown
      if (target.closest('[data-license-trigger="true"]') || 
          target.closest('[data-license-dropdown="true"]')) {
        return;
      }
      if (target.closest('[data-hmg-trigger="true"]') || 
          target.closest('[data-hmg-dropdown="true"]')) {
        return;
      }
      if (target.closest('[data-mrp-trigger="true"]') || 
          target.closest('[data-mrp-dropdown="true"]')) {
        return;
      }
      
      // Close all dropdowns
      setOpenLicenseDropdown(null);
      setOpenHmgDropdown(null);
      setOpenMrpDropdown(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openLicenseDropdown, openHmgDropdown, openMrpDropdown]);

  useEffect(() => {
    localStorage.setItem('orderHubActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('purchasePlanSubTab', purchasePlanSubTab);
  }, [purchasePlanSubTab]);

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    loadOrders();
    loadReviewOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviewOrders = async () => {
    setLoading(true);
    try {
      // Convert MOCK_ORDERS to OrderReview format for testing
      const reviewOrders: OrderReview[] = MOCK_ORDERS.map(order => ({
        id: order.id,
        orderType: order.orderType,
        orderNo: order.orderNo,
        productSku: order.sku,
        compatibleItem: order.itemName,
        brandName: 'HC/NET LIFESTYLE RETAIL PRIVATE LIMITED',
        qty: order.qty,
        unitRate: order.unitRate || '0.00',
        odrDate: order.odrDate,
        estDate: order.estDelDate,
        pocCmtTeam: 'PENDING',
        pocRead: order.pocForCurrentStatus.includes('S1') ? 'COMPLETED' : 'PENDING',
        pocQuality: order.pocForCurrentStatus.includes('S1') ? 'COMPLETED' : 'PENDING',
        pocLabel: order.pocForCurrentStatus.includes('S1') ? 'COMPLETED' : 'PENDING',
        rmReview: 'yes',
        pmReview: 'yes',
        labelDesign: 'yes',
        labelReview: 'yes',
        rmSync: 'yes',
        pmSync: 'yes',
        licenseEI: order.licenseEI,
        licenseArch: order.licenseArch,
        mfgProcess: 'yes',
        homogenizerProcess: 'yes',
        approvalStatus: order.currentStatus === 'UNDER REVIEW' ? 'PENDING' : 'COMPLETED',
        updatedOn: '',
        upstageNo: '',
        comments: order.comments,
        s1Actions: ''
      }));
      setReviewOrders(reviewOrders);
    } catch (error) {
      console.error('Failed to fetch review orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (orderId: string) => {
    try {
      // Mock audit logs - replace with actual API call
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          orderId: orderId,
          timestamp: '2026-01-14 10:30:00',
          user: 'John Doe',
          action: 'Updated',
          field: 'Order Type',
          oldValue: 'NEW ORDER',
          newValue: 'REORDER'
        },
        {
          id: '2',
          orderId: orderId,
          timestamp: '2026-01-14 09:15:00',
          user: 'Jane Smith',
          action: 'Updated',
          field: 'EST Date',
          oldValue: '2025-08-10',
          newValue: '2025-08-15'
        },
        {
          id: '3',
          orderId: orderId,
          timestamp: '2026-01-13 16:45:00',
          user: 'Admin User',
          action: 'Updated',
          field: 'Approval Status',
          oldValue: 'PENDING',
          newValue: 'COMPLETED'
        }
      ];
      setAuditLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  };

  const handleViewHistory = (orderId: string) => {
    setViewHistoryOrderId(orderId);
    loadAuditLogs(orderId);
  };

  const handleCloseHistory = () => {
    setViewHistoryOrderId(null);
    setAuditLogs([]);
  };

  // ==================== REAL-TIME CLOCK ====================

  // ==================== REAL-TIME CLOCK ====================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // ==================== UTILITY FUNCTIONS ====================

  const getMfgProcess = (order: Order) => {
    const seed = order.sku.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return seed % 2 === 0 ? 'HOT' : 'COLD';
  };

  const getTransitionDate = (estDate: string) => {
    const parsed = new Date(estDate);
    if (Number.isNaN(parsed.getTime())) return '-';
    const transition = new Date(parsed);
    transition.setMonth(transition.getMonth() + 2);
    const yyyy = transition.getFullYear();
    const mm = String(transition.getMonth() + 1).padStart(2, '0');
    const dd = String(transition.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openHmgEditor = (orderId: string) => {
    if (!hmgEdits[orderId]) {
      setHmgEdits((prev) => ({
        ...prev,
        [orderId]: { status: 'YES' }
      }));
    }
    setOpenHmgDropdown(orderId);
  };

  const openMrpEditor = (orderId: string) => {
    if (!mrpEdits[orderId]) {
      setMrpEdits((prev) => ({
        ...prev,
        [orderId]: { status: 'MRP REV' }
      }));
    }
    setOpenMrpDropdown(orderId);
  };

  const updateHmgEdit = (orderId: string, updates: Partial<{ status: 'YES' | 'NO'; }>) => {
    setHmgEdits((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], ...updates }
    }));
    updateLastModified(orderId);
  };

  const updateMrpEdit = (orderId: string, updates: Partial<{ status: 'MRP REV' | 'PO PLAN'; }>) => {
    setMrpEdits((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], ...updates }
    }));
    updateLastModified(orderId);
  };

  const getHmgStatusLabel = (orderId: string) => hmgEdits[orderId]?.status || 'YES';
  const getMrpStatusLabel = (orderId: string) => mrpEdits[orderId]?.status || 'MRP REV';

  const updateLastModified = (orderId: string) => {
    const today = new Date().toISOString().split('T')[0];
    setLastUpdatedDates((prev) => ({
      ...prev,
      [orderId]: today
    }));
  };

  const openCommentEditor = (orderId: string) => {
    const currentComment = commentEdits[orderId] ?? '';
    setCommentModalText(currentComment);
    setOpenCommentModal(orderId);
  };

  const saveComment = (orderId: string) => {
    setCommentEdits((prev) => ({
      ...prev,
      [orderId]: commentModalText
    }));
    updateLastModified(orderId);
    setOpenCommentModal(null);
    setCommentModalText('');
  };

  const getLicenseKey = (orderId: string, type: 'arch' | 'ei') => `${orderId}-${type}`;

  const openLicenseEditor = (orderId: string, type: 'arch' | 'ei') => {
    const key = getLicenseKey(orderId, type);
    const order = orders.find((o) => o.id === orderId);
    if (!licenseEdits[key]) {
      setLicenseEdits((prev) => ({
        ...prev,
        [key]: {
          mfgUnit: type === 'arch' ? 'ARCHEESH LAB' : 'EI FACTORY',
          licenseNo: '',
          status: (order?.[type === 'arch' ? 'licenseArch' : 'licenseEI'] === 'yes') ? 'YES' : 'NO'
        }
      }));
    }
    setOpenLicenseDropdown({ orderId, type });
  };

  const updateLicenseEdit = (key: string, updates: Partial<{ mfgUnit: string; licenseNo: string; status: 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS'; }>) => {
    setLicenseEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }));
    updateLastModified(key);
  };

  const applyLicenseStatus = (orderId: string, type: 'arch' | 'ei', status: 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS') => {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        licenseArch: type === 'arch' ? (status === 'YES' ? 'yes' : 'no') : order.licenseArch,
        licenseEI: type === 'ei' ? (status === 'YES' ? 'yes' : 'no') : order.licenseEI
      };
    }));
  };

  const getLicenseStatusLabel = (orderId: string, type: 'arch' | 'ei', fallback: string) => {
    const key = getLicenseKey(orderId, type);
    const status = licenseEdits[key]?.status;
    if (status) return status;
    return fallback === 'yes' ? 'YES' : 'NO';
  };

  const getLicenseStatusClass = (status: string) => {
    switch (status) {
      case 'YES':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'NO':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'APPLIED':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'IN PROCESS':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const handleOrderTypeChange = async (orderId: string, newType: string) => {
    // Close the dropdown
    setOpenOrderTypeDropdown(null);
    
    // Optimistically update UI for both orders and reviewOrders
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, orderType: newType } : order
    ));
    
    setReviewOrders(reviewOrders.map(order => 
      order.id === orderId ? { ...order, orderType: newType } : order
    ));

    // Send update to backend
    try {
      await updateOrderType(orderId, newType);
    } catch (error) {
      console.error('Failed to update order type:', error);
      // Revert on error
      loadOrders();
      loadReviewOrders();
    }
  };

  // ==================== CONNECTIVITY TRACKER FUNCTIONS ====================
  const getConnectivityTrackerOrders = () => {
    // Get ALL orders from all stages for connectivity tracking
    return orders;
  };

  const updateConnectivityRecord = (orderId: string, field: string, value: any) => {
    setConnectivityRecords((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
    updateLastModified(orderId);
  };

  const addNewConnectivityRecord = () => {
    if (!newConnectivityRecord) {
      setNewConnectivityRecord({
        id: `new-${Date.now()}`,
        orderNo: '',
        sku: '',
        itemName: '',
        qty: 0,
        sourceStage: 'MANUAL',
        startDate: new Date().toISOString().split('T')[0],
        estimatedCompletionDate: '',
        status: 'IN PROGRESS',
        remarks: ''
      });
    }
    setShowAddConnectivityRow(true);
  };

  const tabs = [
    { id: 'orders-tracker', label: 'Orders Tracker' },
    { id: 'orders-review', label: '#1 Orders Review' },
    { id: 'purchase-plan', label: '#2 Purchase Plan' },
    { id: 'purchase-planner', label: '#3 Connectivity Tracker' },
    { id: 'production-planner', label: '#4 Production Planner' },
    { id: 'production-tracker', label: '#5 Production Tracker' },
    { id: 'order-closure', label: '#6 Order Closure' },
    { id: 'goods-receiving', label: 'Goods Receiving' },
  ];

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Memoize filtered orders to prevent unnecessary recalculations
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = debouncedSearchQuery === '' || 
        order.orderNo.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        order.sku.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        order.itemName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'OPEN' && order.currentStatus === 'OPEN') ||
        (statusFilter === 'IN_PROGRESS' && order.currentStatus === 'IN_PROGRESS') ||
        (statusFilter === 'COMPLETED' && order.currentStatus === 'COMPLETED') ||
        (statusFilter === 'PENDING' && order.currentStatus === 'PENDING');
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, debouncedSearchQuery, statusFilter]);

  const poPlanOrders = useMemo(() => 
    filteredOrders.filter((order) => order.stage === 'PURCHASE PLAN'),
    [filteredOrders]
  );

  // Memoize filtered review orders
  const filteredReviewOrders = useMemo(() => {
    return reviewOrders.filter(order => {
      const matchesSearch = debouncedSearchQuery === '' || 
        order.orderNo.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        order.productSku.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        order.compatibleItem.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'OPEN' && order.approvalStatus === 'OPEN') ||
        (statusFilter === 'IN_PROGRESS' && order.approvalStatus === 'IN_PROGRESS') ||
        (statusFilter === 'COMPLETED' && order.approvalStatus === 'COMPLETED') ||
        (statusFilter === 'PENDING' && order.approvalStatus === 'PENDING');
      
      return matchesSearch && matchesStatus;
    });
  }, [reviewOrders, debouncedSearchQuery, statusFilter]);

  const [activeTask, setActiveTask] = useState('all');
  const [activeSubPage, setActiveSubPage] = useState<string>('dashboard');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Order | null>(null);
  
  // Goods Receiving tab state
  type GoodsReceivingTabType = 'po-requests' | 'issued-pos' | 'ongoing-grns' | 'mrn-fgs' | 'print-labels' | 'grn' | 'proofing';
  const [activeGoodsReceivingTab, setActiveGoodsReceivingTab] = useState<GoodsReceivingTabType>('po-requests');

  // Enhanced Filter & Sort States
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'Pending' | 'In Progress' | 'Completed'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [taskDateFilter, setTaskDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [taskSortBy, setTaskSortBy] = useState<'date' | 'priority' | 'status' | 'orderNo'>('date');
  const [taskSortOrder, setTaskSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Team Workload & Activity States
  const [showWorkloadView, setShowWorkloadView] = useState(false);
  
  // Task Actions States
  const [showStatusDropdown, setShowStatusDropdown] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState<Order | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);

  // Helper function to check due date status
  const getDueDateStatus = (estDelDate: string): 'overdue' | 'near-due' | 'normal' => {
    const today = new Date();
    const dueDate = new Date(estDelDate);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'near-due';
    return 'normal';
  };

  // Helper function to get priority color
  const getPriorityColor = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Handler to update task status
  const handleUpdateTaskStatus = (orderId: string, newStatus: 'Pending' | 'In Progress' | 'Completed') => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newActivityLog = order.activityLog || [];
        newActivityLog.push({
          id: `act-${Date.now()}`,
          action: 'Status Changed',
          performedBy: 'Current User',
          performedAt: new Date().toLocaleString(),
          details: `Status updated`,
          oldValue: order.currentStatus,
          newValue: newStatus
        });
        
        // Update stage progress based on status
        const updatedStageProgress = { ...order.stageProgress };
        if (newStatus === 'Completed') {
          updatedStageProgress[order.currentStage] = 'completed';
        } else if (newStatus === 'In Progress') {
          updatedStageProgress[order.currentStage] = 'in-progress';
        } else {
          updatedStageProgress[order.currentStage] = 'pending';
        }
        
        return {
          ...order,
          currentStatus: newStatus,
          stageProgress: updatedStageProgress,
          activityLog: newActivityLog
        };
      }
      return order;
    }));
    setShowStatusDropdown(null);
  };

  // Handler to reassign task
  const handleReassignTask = (orderId: string, newAssignee: string, newTeam: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newActivityLog = order.activityLog || [];
        newActivityLog.push({
          id: `act-${Date.now()}`,
          action: 'Task Reassigned',
          performedBy: 'Current User',
          performedAt: new Date().toLocaleString(),
          details: `Reassigned to ${newAssignee}`,
          oldValue: order.assignedTo,
          newValue: newAssignee
        });
        
        return {
          ...order,
          assignedTo: newAssignee,
          assignedTeam: newTeam,
          assignedBy: 'Current User',
          assignedAt: new Date().toISOString().split('T')[0],
          activityLog: newActivityLog
        };
      }
      return order;
    }));
    setShowReassignModal(null);
  };

  // Handler to add comment
  const handleAddComment = (orderId: string, comment: string) => {
    if (!comment.trim()) return;
    
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newActivityLog = order.activityLog || [];
        newActivityLog.push({
          id: `act-${Date.now()}`,
          action: 'Comment Added',
          performedBy: 'Current User',
          performedAt: new Date().toLocaleString(),
          details: comment
        });
        
        return {
          ...order,
          activityLog: newActivityLog
        };
      }
      return order;
    }));
    setNewComment('');
    setShowCommentInput(null);
  };

  // Filter and sort tasks
  const getFilteredAndSortedTasks = (taskOrders: Order[]) => {
    let filtered = [...taskOrders];
    
    // Apply status filter
    if (taskStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.currentStatus === taskStatusFilter);
    }
    
    // Apply priority filter
    if (taskPriorityFilter !== 'all') {
      filtered = filtered.filter(o => o.priority === taskPriorityFilter);
    }
    
    // Apply date filter
    if (taskDateFilter.from) {
      filtered = filtered.filter(o => new Date(o.odrDate) >= new Date(taskDateFilter.from));
    }
    if (taskDateFilter.to) {
      filtered = filtered.filter(o => new Date(o.odrDate) <= new Date(taskDateFilter.to));
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (taskSortBy) {
        case 'date':
          comparison = new Date(a.odrDate).getTime() - new Date(b.odrDate).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1, undefined: 0 };
          comparison = (priorityOrder[b.priority || 'undefined'] || 0) - (priorityOrder[a.priority || 'undefined'] || 0);
          break;
        case 'status':
          comparison = a.currentStatus.localeCompare(b.currentStatus);
          break;
        case 'orderNo':
          comparison = a.orderNo.localeCompare(b.orderNo);
          break;
      }
      
      return taskSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  // Calculate team workload
  const getTeamWorkload = () => {
    const workload: Record<string, { total: number; pending: number; inProgress: number; completed: number }> = {};
    
    orders.forEach(order => {
      const team = order.assignedTeam || 'Unassigned';
      if (!workload[team]) {
        workload[team] = { total: 0, pending: 0, inProgress: 0, completed: 0 };
      }
      workload[team].total++;
      if (order.currentStatus === 'Pending') workload[team].pending++;
      else if (order.currentStatus === 'In Progress') workload[team].inProgress++;
      else if (order.currentStatus === 'Completed') workload[team].completed++;
    });
    
    return workload;
  };

  const tasks = [
    { 
      id: 'all', 
      label: 'All Orders', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    { 
      id: 'goods-receiving', 
      label: 'Goods Receiving', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )
    },
    { 
      id: 'bd-tasks', 
      label: 'BD Tasks', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    { 
      id: 'rnd-tasks', 
      label: 'RND Tasks', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    },
    { 
      id: 'planning', 
      label: 'Planning', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    { 
      id: 'design', 
      label: 'Design', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      )
    },
    { 
      id: 'label', 
      label: 'Label', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    },
    { 
      id: 'production', 
      label: 'Production', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    },
    { 
      id: 'dispense', 
      label: 'Dispense', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    { 
      id: 'bundle', 
      label: 'Bundle', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    { 
      id: 'quality-team', 
      label: 'Quality Team', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'packaging-team', 
      label: 'Packaging Team', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    },
    { 
      id: 'invoice', 
      label: 'Invoice', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { 
      id: 'warehouse', 
      label: 'Warehouse', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
  ];

  const handleTaskClick = useCallback((taskId: string) => {
    if (taskId === 'all') {
      setActiveTask(taskId);
      setExpandedTask(null);
      setActiveSubPage('hub');
    } else if (taskId === 'goods-receiving') {
      // Special handling for goods-receiving - show as standalone full page
      setActiveTask('goods-receiving');
      setExpandedTask(null);
      setActiveSubPage('goods-receiving-page');
    } else {
      setExpandedTask(prev => prev === taskId ? null : taskId);
      setActiveTask(taskId);
      setActiveSubPage('dashboard');
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <img src={eilogofull} alt="Esthetic Insights" className="h-8 object-contain" />
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 sidebar-nav">
          {tasks.map((task) => (
            <div key={task.id}>
              <button
                onClick={() => handleTaskClick(task.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 text-left font-medium will-change-auto ${
                  activeTask === task.id
                    ? 'bg-amber-50 text-amber-700 border-l-4 border-amber-500'
                    : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent hover:text-gray-900'
                }`}
              >
                <span className="flex-shrink-0">{task.icon}</span>
                <span className="flex-1">{task.label}</span>
                {task.id !== 'all' && task.id !== 'goods-receiving' && (
                  <svg
                    className={`w-4 h-4 transition-transform duration-150 ${
                      expandedTask === task.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {/* Subpages */}
              {task.id !== 'all' && task.id !== 'goods-receiving' && expandedTask === task.id && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-amber-200 pl-2 animate-fadeIn">
                  <button
                    onClick={() => setActiveSubPage('dashboard')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2 ${
                      activeSubPage === 'dashboard'
                        ? 'bg-amber-100 text-amber-700 font-semibold'
                        : 'text-gray-600 hover:bg-white hover:text-amber-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveSubPage('tasks')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2 ${
                      activeSubPage === 'tasks'
                        ? 'bg-amber-100 text-amber-700 font-semibold'
                        : 'text-gray-600 hover:bg-white hover:text-amber-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Tasks
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-4 md:p-8 min-h-screen">
          
          {/* Goods Receiving Full Page */}
          {activeSubPage === 'goods-receiving-page' ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Goods Receiving</h1>
                    <p className="text-gray-500 text-sm mt-2">Manage purchase orders, GRNs, and receiving processes</p>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Scrollable Tab Container */}
                <div className="overflow-x-auto">
                  <div className="flex border-b border-gray-200 min-w-max md:min-w-full">
                    {[
                      {
                        id: 'po-requests' as GoodsReceivingTabType,
                        label: 'PO Requests',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      },
                      {
                        id: 'issued-pos' as GoodsReceivingTabType,
                        label: 'Issued P.O.s',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      },
                      {
                        id: 'ongoing-grns' as GoodsReceivingTabType,
                        label: 'Ongoing GRN\'s',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      },
                      {
                        id: 'mrn-fgs' as GoodsReceivingTabType,
                        label: 'MRN/FG\'s',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m0 0v10l8 4" /></svg>
                      },
                      {
                        id: 'print-labels' as GoodsReceivingTabType,
                        label: 'Print Labels',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      },
                      {
                        id: 'grn' as GoodsReceivingTabType,
                        label: 'GRN',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      },
                      {
                        id: 'proofing' as GoodsReceivingTabType,
                        label: 'Proofing',
                        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveGoodsReceivingTab(tab.id)}
                        className={`flex-1 px-4 md:px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                          activeGoodsReceivingTab === tab.id
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-b-2 border-amber-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="hidden sm:inline">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-4 md:p-6">
                  {/* PO Requests */}
                  {activeGoodsReceivingTab === 'po-requests' && (
                    <PORequests />
                  )}

                  {/* Issued POs */}
                  {activeGoodsReceivingTab === 'issued-pos' && (
                    <IssuedPOS />
                  )}

                  {/* Ongoing GRNs */}
                  {activeGoodsReceivingTab === 'ongoing-grns' && (
                    <OngoingGRNs />
                  )}

                  {/* MRN/FGs */}
                  {activeGoodsReceivingTab === 'mrn-fgs' && (
                    <MRNFGs />
                  )}

                  {/* Print Labels */}
                  {activeGoodsReceivingTab === 'print-labels' && (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Labels</h3>
                      <p className="text-gray-500">Generate and print product labels</p>
                    </div>
                  )}

                  {/* GRN - Main Content */}
                  {activeGoodsReceivingTab === 'grn' && (
                    <GRNList />
                  )}

                  {/* Proofing */}
                  {activeGoodsReceivingTab === 'proofing' && <Proofing />}
                </div>
              </div>
            </div>
          ) : activeSubPage === 'tasks' && activeTask !== 'all' ? (
            <div className="space-y-6">
              {/* Tasks Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-amber-500">{tasks.find(t => t.id === activeTask)?.icon}</span>
                  <h1 className="text-2xl font-bold text-gray-800 capitalize">{tasks.find(t => t.id === activeTask)?.label} Tasks</h1>
                </div>
                <p className="text-gray-500 text-sm">View and manage all {tasks.find(t => t.id === activeTask)?.label.toLowerCase()} related tasks</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 shadow-sm border border-amber-200 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-500 rounded-lg p-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Pending</p>
                      <p className="text-3xl font-bold text-gray-800">
                        {orders.filter(o => {
                          const stageMap: Record<string, number> = {
                            'planning': 1,
                            'design': 2,
                            'label': 3,
                            'production': 4,
                            'dispense': 5,
                            'bundle': 5,
                            'invoice': 6,
                            'quality-team': 4,
                            'packaging-team': 5,
                            'warehouse': 6
                          };
                          return o.currentStage === stageMap[activeTask] && o.stageProgress[stageMap[activeTask]] === 'pending';
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 shadow-sm border border-blue-200 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-500 rounded-lg p-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">In Progress</p>
                      <p className="text-3xl font-bold text-gray-800">
                        {orders.filter(o => {
                          const stageMap: Record<string, number> = {
                            'planning': 1,
                            'design': 2,
                            'label': 3,
                            'production': 4,
                            'dispense': 5,
                            'bundle': 5,
                            'invoice': 6,
                            'quality-team': 4,
                            'packaging-team': 5,
                            'warehouse': 6
                          };
                          return o.currentStage === stageMap[activeTask] && o.stageProgress[stageMap[activeTask]] === 'in-progress';
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 shadow-sm border border-green-200 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-500 rounded-lg p-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Tasks</p>
                      <p className="text-3xl font-bold text-gray-800">
                        {orders.filter(o => {
                          const stageMap: Record<string, number> = {
                            'planning': 1,
                            'design': 2,
                            'label': 3,
                            'production': 4,
                            'dispense': 5,
                            'bundle': 5,
                            'invoice': 6,
                            'quality-team': 4,
                            'packaging-team': 5,
                            'warehouse': 6
                          };
                          return o.currentStage === stageMap[activeTask];
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* High Priority Count */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 shadow-sm border border-red-200 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500 rounded-lg p-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">High Priority</p>
                      <p className="text-3xl font-bold text-gray-800">
                        {orders.filter(o => {
                          const stageMap: Record<string, number> = {
                            'planning': 1,
                            'design': 2,
                            'label': 3,
                            'production': 4,
                            'dispense': 5,
                            'bundle': 5,
                            'invoice': 6,
                            'quality-team': 4,
                            'packaging-team': 5,
                            'warehouse': 6
                          };
                          return o.currentStage === stageMap[activeTask] && o.priority === 'high';
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter & Sort Bar */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Filter Toggle */}
                  <button
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      showFilterPanel ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filters
                    {(taskStatusFilter !== 'all' || taskPriorityFilter !== 'all' || taskDateFilter.from || taskDateFilter.to) && (
                      <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">Active</span>
                    )}
                  </button>

                  {/* Sort Options */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Sort by:</span>
                    <select
                      value={taskSortBy}
                      onChange={(e) => setTaskSortBy(e.target.value as 'date' | 'priority' | 'status' | 'orderNo')}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="date">Date</option>
                      <option value="priority">Priority</option>
                      <option value="status">Status</option>
                      <option value="orderNo">Order No</option>
                    </select>
                    <button
                      onClick={() => setTaskSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      {taskSortOrder === 'asc' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Team Workload Toggle */}
                  <button
                    onClick={() => setShowWorkloadView(!showWorkloadView)}
                    className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      showWorkloadView ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Team Workload
                  </button>
                </div>

                {/* Filter Panel */}
                {showFilterPanel && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                      <select
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value as 'all' | 'Pending' | 'In Progress' | 'Completed')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="all">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                    {/* Priority Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Priority</label>
                      <select
                        value={taskPriorityFilter}
                        onChange={(e) => setTaskPriorityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="all">All Priorities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    {/* Date From */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">From Date</label>
                      <input
                        type="date"
                        value={taskDateFilter.from}
                        onChange={(e) => setTaskDateFilter(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">To Date</label>
                      <input
                        type="date"
                        value={taskDateFilter.to}
                        onChange={(e) => setTaskDateFilter(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* Clear Filters */}
                    <div className="md:col-span-4 flex justify-end">
                      <button
                        onClick={() => {
                          setTaskStatusFilter('all');
                          setTaskPriorityFilter('all');
                          setTaskDateFilter({ from: '', to: '' });
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Team Workload Panel */}
              {showWorkloadView && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Team Workload Distribution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(getTeamWorkload()).map(([team, stats]) => (
                      <div key={team} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-2">{team.replace(/_/g, ' ')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total</span>
                            <span className="font-medium">{stats.total}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-amber-600">Pending</span>
                            <span className="font-medium">{stats.pending}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-600">In Progress</span>
                            <span className="font-medium">{stats.inProgress}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600">Completed</span>
                            <span className="font-medium">{stats.completed}</span>
                          </div>
                          {/* Progress Bar */}
                          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-400"
                              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              <div className="space-y-4">
                {/* BD Tasks and RND Tasks - Show Orders Table in Tasks View */}
                {(activeTask === 'bd-tasks' || activeTask === 'rnd-tasks') ? (
                  <>
                    <h2 className="text-lg font-bold text-gray-800">All Orders</h2>
                    
                    {/* Search Bar */}
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder={`Search ${activeTask === 'bd-tasks' ? 'BD' : 'RND'} orders by Order No, SKU, or Item Name...`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                        />
                        {searchQuery && searchQuery !== debouncedSearchQuery && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
                          </div>
                        )}
                      </div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white transition-shadow"
                      >
                        <option value="ALL">All Stages</option>
                        {STAGES.map(s => (
                          <option key={s.id} value={s.id}>Stage {s.id}</option>
                        ))}
                      </select>
                    </div>

                    {/* Orders Table */}
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 bg-gray-100 sticky left-0 z-10">
                                Order ID
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Item Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                SKU
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Qty
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Order Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Est. Delivery
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Current Stage
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Stage Progress
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Status
                              </th>
                              {activeTask === 'bd-tasks' && (
                                <>
                                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-50">
                                    POC CMT Team
                                  </th>
                                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-50">
                                    Label Design Status
                                  </th>
                                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-50">
                                    License Arch
                                  </th>
                                </>
                              )}
                              {activeTask === 'rnd-tasks' && (
                                <>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    R&D Product
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    Quality
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    Label Design
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    RM Review
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    PM Review
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    Label Review
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    RM Sync
                                  </th>
                                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-purple-50">
                                    PM Sync
                                  </th>
                                </>
                              )}
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {orders
                              .filter(order => {
                                const matchesSearch = !searchQuery || 
                                  order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  order.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  order.itemName.toLowerCase().includes(searchQuery.toLowerCase());
                                const matchesStage = statusFilter === 'ALL' || order.currentStage === parseInt(statusFilter);
                                return matchesSearch && matchesStage;
                              })
                              .map(order => {
                                const hasRecentUpdate = lastUpdatedDates[order.id] && 
                                  new Date(lastUpdatedDates[order.id]).getTime() > Date.now() - 5000;
                                
                                return (
                                  <tr 
                                    key={order.id} 
                                    className={`hover:bg-amber-50 transition-colors ${
                                      hasRecentUpdate ? 'animate-pulse bg-green-50' : ''
                                    }`}
                                  >
                                    {/* Order ID - Sticky Left Column */}
                                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900 border-r border-gray-200 bg-gray-50 sticky left-0">
                                      <div className="flex items-center gap-2">
                                        {hasRecentUpdate && (
                                          <span className="flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                          </span>
                                        )}
                                        {order.orderNo}
                                      </div>
                                    </td>

                                    {/* Order Type */}
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                        order.orderType === 'REORDER' 
                                          ? 'bg-blue-100 text-blue-700' 
                                          : order.orderType === 'NEW ORDER'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-orange-100 text-orange-700'
                                      }`}>
                                        {order.orderType}
                                      </span>
                                    </td>

                                    {/* Item Name */}
                                    <td className="px-4 py-3">
                                      <div className="max-w-xs">
                                        <p className="text-sm font-medium text-gray-900 truncate">{order.itemName}</p>
                                      </div>
                                    </td>

                                    {/* SKU */}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                      {order.sku}
                                    </td>

                                    {/* Quantity */}
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                                      {order.qty}
                                    </td>

                                    {/* Order Date */}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                      {order.odrDate}
                                    </td>

                                    {/* Est. Delivery */}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                      {order.estDelDate}
                                    </td>

                                    {/* Current Stage */}
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                          Stage {order.currentStage}/6
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {STAGES.find(s => s.id === order.currentStage)?.name}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Stage Progress Indicators */}
                                    <td className="px-4 py-3">
                                      <div className="flex gap-1 items-center justify-center">
                                        {STAGES.map((stage) => {
                                          const status = order.stageProgress?.[stage.id] || 'pending';
                                          const isCurrentStage = stage.id === order.currentStage;
                                          return (
                                            <div
                                              key={stage.id}
                                              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${
                                                status === 'completed'
                                                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                                                  : isCurrentStage
                                                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-400 ring-2 ring-blue-200'
                                                  : 'bg-gray-100 text-gray-400 border border-gray-300'
                                              }`}
                                              title={`${stage.name}: ${status}`}
                                            >
                                              {getStageStatusIcon(status)}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                        order.currentStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                        order.currentStatus === 'UNDER REVIEW' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {order.currentStatus}
                                      </span>
                                    </td>

                                    {/* BD Tasks Checkpoints */}
                                    {activeTask === 'bd-tasks' && (
                                      <>
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.poc_cmt_team || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, poc_cmt_team: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.poc_cmt_team === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.poc_cmt_team === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.label_design_status || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, label_design_status: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.label_design_status === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.label_design_status === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.license_arch || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, license_arch: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.license_arch === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.license_arch === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                      </>
                                    )}

                                    {/* RND Tasks Checkpoints */}
                                    {activeTask === 'rnd-tasks' && (
                                      <>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.poc_rnd_product || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, poc_rnd_product: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.poc_rnd_product === 'yes' ? 'bg-purple-100 text-purple-700' :
                                              order.poc_rnd_product === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.poc_quality_compliance || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, poc_quality_compliance: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.poc_quality_compliance === 'yes' ? 'bg-green-100 text-green-700' :
                                              order.poc_quality_compliance === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.poc_label_design || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, poc_label_design: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.poc_label_design === 'yes' ? 'bg-pink-100 text-pink-700' :
                                              order.poc_label_design === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.rm_review || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, rm_review: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.rm_review === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.rm_review === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.pm_review || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, pm_review: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.pm_review === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.pm_review === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.label_review_qc || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, label_review_qc: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.label_review_qc === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.label_review_qc === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.rm_sync || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, rm_sync: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.rm_sync === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.rm_sync === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap text-center">
                                          <select
                                            value={order.pm_sync || 'pending'}
                                            onChange={(e) => {
                                              setOrders(prev => prev.map(o => 
                                                o.id === order.id ? { ...o, pm_sync: e.target.value as any } : o
                                              ));
                                            }}
                                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                                              order.pm_sync === 'yes' ? 'bg-blue-100 text-blue-700' :
                                              order.pm_sync === 'no' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <option value="pending">PENDING</option>
                                            <option value="yes">yes</option>
                                            <option value="no">no</option>
                                          </select>
                                        </td>
                                      </>
                                    )}

                                    {/* Actions */}
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                      <button
                                        onClick={() => setSelectedOrderDetails(order)}
                                        className="inline-flex items-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                                      >
                                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-gray-800">All Tasks</h2>
                    {getFilteredAndSortedTasks(
                      orders.filter(o => {
                        const stageMap: Record<string, number> = {
                          'planning': 1,
                          'design': 2,
                          'label': 3,
                          'production': 4,
                          'dispense': 5,
                          'bundle': 5,
                          'invoice': 6,
                          'quality-team': 4,
                          'packaging-team': 5,
                          'warehouse': 6
                        };
                        return o.currentStage === stageMap[activeTask];
                      })
                    ).map((order) => {
                    const formatDate = (dateStr: string) => {
                      if (!dateStr) return 'N/A';
                      const date = new Date(dateStr);
                      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    };
                    const dueDateStatus = getDueDateStatus(order.estDelDate);

                    return (
                      <div key={order.id} className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-all duration-200 ${
                        dueDateStatus === 'overdue' ? 'border-red-300 bg-red-50/30' :
                        dueDateStatus === 'near-due' ? 'border-yellow-300 bg-yellow-50/30' :
                        'border-gray-100'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Priority & Due Date Badges */}
                            <div className="flex items-center gap-2 mb-2">
                              {order.priority && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(order.priority)}`}>
                                  {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)} Priority
                                </span>
                              )}
                              {dueDateStatus === 'overdue' && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 border border-red-300">
                                  ⚠️ Overdue
                                </span>
                              )}
                              {dueDateStatus === 'near-due' && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
                                  ⏰ Due Soon
                                </span>
                              )}
                              {/* Status Badge */}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                order.currentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                                order.currentStatus === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {order.currentStatus}
                              </span>
                            </div>
                            
                            <button
                              onClick={() => setSelectedTaskDetail(order)}
                              className="text-blue-600 hover:text-blue-700 font-medium text-base mb-1 transition-colors"
                            >
                              {order.orderNo}
                            </button>
                            <h3 className="text-gray-800 font-semibold text-lg mb-2">{order.itemName}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                              <span>{order.sku}</span>
                              <span>•</span>
                              <span>Due: {formatDate(order.estDelDate)}</span>
                              {order.assignedTo && (
                                <>
                                  <span>•</span>
                                  <span>Assigned: {order.assignedTo}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Status Update Dropdown */}
                            <div className="relative">
                              <button
                                onClick={() => setShowStatusDropdown(showStatusDropdown === order.id ? null : order.id)}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Update Status
                              </button>
                              {showStatusDropdown === order.id && (
                                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                  {['Pending', 'In Progress', 'Completed'].map(status => (
                                    <button
                                      key={status}
                                      onClick={() => handleUpdateTaskStatus(order.id, status as 'Pending' | 'In Progress' | 'Completed')}
                                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                        order.currentStatus === status ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Reassign Button */}
                            <button
                              onClick={() => setShowReassignModal(order)}
                              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                              title="Reassign Task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            
                            {/* View Details */}
                            <button
                              onClick={() => setSelectedTaskDetail(order)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              View Details
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Quick Comment Input */}
                        {showCommentInput === order.id ? (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(order.id, newComment)}
                              />
                              <button
                                onClick={() => handleAddComment(order.id, newComment)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setShowCommentInput(null); setNewComment(''); }}
                                className="px-3 py-2 text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowCommentInput(order.id)}
                            className="mt-3 text-sm text-gray-500 hover:text-amber-600 flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            Add Comment
                          </button>
                        )}
                      </div>
                    );
                  })}
                {getFilteredAndSortedTasks(
                  orders.filter(o => {
                    const stageMap: Record<string, number> = {
                      'planning': 1,
                      'design': 2,
                      'label': 3,
                      'production': 4,
                      'dispense': 5,
                      'bundle': 5,
                      'invoice': 6,
                      'quality-team': 4,
                      'packaging-team': 5,
                      'warehouse': 6
                    };
                    return o.currentStage === stageMap[activeTask];
                  })
                ).length === 0 && (
                  <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                    <p className="text-gray-500">No tasks found matching your filters</p>
                  </div>
                )}
                  </>
                )}
              </div>
            </div>
          ) : activeSubPage === 'dashboard' && activeTask !== 'all' ? (
            <div className="space-y-6">
              {/* Dashboard Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-amber-500">{tasks.find(t => t.id === activeTask)?.icon}</span>
                  <h1 className="text-2xl font-bold text-gray-800 capitalize">{activeTask === 'bd-tasks' ? 'BD Tasks' : activeTask === 'rnd-tasks' ? 'RND Tasks' : activeTask} Dashboard</h1>
                </div>
                <p className="text-gray-500 text-sm">Monitor and manage {activeTask === 'bd-tasks' ? 'BD tasks' : activeTask === 'rnd-tasks' ? 'RND tasks' : activeTask} tasks and metrics</p>
              </div>

              {/* Dashboard Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Active Tasks</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">
                        {(() => {
                          const stageMap: Record<string, number> = {
                            'planning': 1, 'design': 2, 'label': 3, 'production': 4,
                            'dispense': 5, 'bundle': 5, 'invoice': 6,
                            'quality-team': 4, 'packaging-team': 5, 'warehouse': 6
                          };
                          return orders.filter(o => 
                            o.currentStage === stageMap[activeTask] && 
                            o.stageProgress[stageMap[activeTask]] !== 'completed'
                          ).length;
                        })()}
                      </p>
                    </div>
                    <div className="text-amber-500 opacity-80">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Completed</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">
                        {(() => {
                          const stageMap: Record<string, number> = {
                            'planning': 1, 'design': 2, 'label': 3, 'production': 4,
                            'dispense': 5, 'bundle': 5, 'invoice': 6,
                            'quality-team': 4, 'packaging-team': 5, 'warehouse': 6
                          };
                          return orders.filter(o => 
                            o.stageProgress[stageMap[activeTask]] === 'completed'
                          ).length;
                        })()}
                      </p>
                      <p className="text-sm mt-2 flex items-center text-emerald-600">
                        <span className="mr-1">✓</span>
                        Done
                      </p>
                    </div>
                    <div className="text-amber-500 opacity-80">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Pending</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">
                        {(() => {
                          const stageMap: Record<string, number> = {
                            'planning': 1, 'design': 2, 'label': 3, 'production': 4,
                            'dispense': 5, 'bundle': 5, 'invoice': 6,
                            'quality-team': 4, 'packaging-team': 5, 'warehouse': 6
                          };
                          return orders.filter(o => 
                            o.currentStage === stageMap[activeTask] && 
                            o.stageProgress[stageMap[activeTask]] === 'pending'
                          ).length;
                        })()}
                      </p>
                    </div>
                    <div className="text-amber-500 opacity-80">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">In Progress</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">
                        {(() => {
                          const stageMap: Record<string, number> = {
                            'planning': 1, 'design': 2, 'label': 3, 'production': 4,
                            'dispense': 5, 'bundle': 5, 'invoice': 6,
                            'quality-team': 4, 'packaging-team': 5, 'warehouse': 6
                          };
                          return orders.filter(o => 
                            o.currentStage === stageMap[activeTask] && 
                            o.stageProgress[stageMap[activeTask]] === 'in-progress'
                          ).length;
                        })()}
                      </p>
                      <p className="text-sm mt-2 flex items-center text-blue-600">
                        <span className="mr-1">⚙</span>
                        Working
                      </p>
                    </div>
                    <div className="text-amber-500 opacity-80">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Task Overview</h2>
                <div className="space-y-3">
                  {orders
                    .filter(o => {
                      const stageMap: Record<string, number> = {
                        'planning': 1, 'design': 2, 'label': 3, 'production': 4,
                        'dispense': 5, 'bundle': 5, 'invoice': 6,
                        'quality-team': 4, 'packaging-team': 5, 'warehouse': 6
                      };
                      return o.currentStage === stageMap[activeTask];
                    })
                    .slice(0, 5)
                    .map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <button
                            onClick={() => {
                              setActiveSubPage('tasks');
                              setSelectedTaskDetail(order);
                            }}
                            className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {order.orderNo}
                          </button>
                          <p className="text-sm text-gray-500">{order.itemName}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.stageProgress[order.currentStage] === 'completed' ? 'bg-green-100 text-green-700' :
                          order.stageProgress[order.currentStage] === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {order.stageProgress[order.currentStage]?.replace('-', ' ').toUpperCase()}
                        </div>
                      </div>
                    ))}
                  {orders.filter(o => {
                    const stageMap: Record<string, number> = {
                      'planning': 1, 'design': 2, 'label': 3, 'production': 4,
                      'dispense': 5, 'bundle': 5, 'invoice': 6,
                      'quality-team': 4, 'packaging-team': 5, 'warehouse': 6
                    };
                    return o.currentStage === stageMap[activeTask];
                  }).length === 0 && (
                    <p className="text-gray-500 text-center py-8">No tasks in this stage</p>
                  )}
                </div>
                <button
                  onClick={() => setActiveSubPage('tasks')}
                  className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium"
                >
                  View All Tasks
                </button>
              </div>
            </div>
          ) : (
            <>
      {/* Header with Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 animate-fadeIn">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Order Hub</h1>
          {!isViewOnly && (
            <button
              onClick={() => setTeamManagementModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Team Management
            </button>
          )}
        </div>
        <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600 bg-amber-50'
                  : 'border-transparent text-gray-600 hover:text-amber-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Stage Action Buttons - Common for All Stages except Orders Tracker and Goods Receiving */}
        {['orders-review', 'purchase-plan', 'purchase-planner', 'production-planner', 'production-tracker', 'order-closure'].includes(activeTab) && (
          <div className="p-3 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center gap-2">
            {isViewOnly && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4.243 4.243a4 4 0 105.656 5.656l4.243-4.243" />
                </svg>
                View Only Mode
              </div>
            )}
            <button
              onClick={() => !isViewOnly && setConsoReportModal(consoReportModal ? null : 'active')}
              disabled={isViewOnly}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors shadow-sm ${
                isViewOnly 
                  ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Conso Report
            </button>

            <button
              onClick={() => !isViewOnly && setPriceReportModal(priceReportModal ? null : 'active')}
              disabled={isViewOnly}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors shadow-sm ${
                isViewOnly 
                  ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                  : 'bg-purple-500 hover:bg-purple-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Price Report
            </button>

            <button
              onClick={() => !isViewOnly && setChangeStatusModal(changeStatusModal ? null : 'active')}
              disabled={isViewOnly}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors shadow-sm ${
                isViewOnly 
                  ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Change Status
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {activeTab === 'orders-tracker' && (
          <div className="space-y-4 p-4">
            {/* Header with Statistics */}
            <div className="grid grid-cols-6 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Orders</div>
                    <div className="text-2xl font-bold text-gray-800 mt-1">{orders.length}</div>
                  </div>
                  <div className="text-amber-500 opacity-80">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
              </div>
              {STAGES.map((stage) => {
                const count = orders.filter(o => o.currentStage === stage.id).length;
                return (
                  <div key={stage.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stage {stage.id}</div>
                    <div className="text-2xl font-bold text-gray-800 mt-1">{count}</div>
                  </div>
                );
              })}
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by Order No, SKU, or Item Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                />
                {searchQuery && searchQuery !== debouncedSearchQuery && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
                  </div>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white transition-shadow"
              >
                <option value="ALL">All Stages</option>
                {STAGES.map(s => (
                  <option key={s.id} value={s.id}>Stage {s.id}</option>
                ))}
              </select>
            </div>

            {/* Orders Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 bg-gray-100 sticky left-0 z-10">
                        Order ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Order Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Est. Delivery
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Current Stage
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Stage Progress
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Unit Rate
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders
                      .filter(order => {
                        const matchesSearch = !searchQuery || 
                          order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.itemName.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesStage = statusFilter === 'ALL' || order.currentStage === parseInt(statusFilter);
                        return matchesSearch && matchesStage;
                      })
                      .map(order => {
                        const hasRecentUpdate = lastUpdatedDates[order.id] && 
                          new Date(lastUpdatedDates[order.id]).getTime() > Date.now() - 5000;
                        
                        return (
                          <tr 
                            key={order.id} 
                            className={`hover:bg-amber-50 transition-colors ${
                              hasRecentUpdate ? 'animate-pulse bg-green-50' : ''
                            }`}
                          >
                            {/* Order ID - Sticky Left Column */}
                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900 border-r border-gray-200 bg-gray-50 sticky left-0">
                              <div className="flex items-center gap-2">
                                {hasRecentUpdate && (
                                  <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                )}
                                {order.orderNo}
                              </div>
                            </td>

                            {/* Order Type */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                order.orderType === 'REORDER' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : order.orderType === 'NEW ORDER'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {order.orderType}
                              </span>
                            </td>

                            {/* Item Name */}
                            <td className="px-4 py-3">
                              <div className="max-w-xs">
                                <p className="text-sm font-medium text-gray-900 truncate">{order.itemName}</p>
                              </div>
                            </td>

                            {/* SKU */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {order.sku}
                            </td>

                            {/* Quantity */}
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                              {order.qty}
                            </td>

                            {/* Order Date */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {order.odrDate}
                            </td>

                            {/* Est. Delivery */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {order.estDelDate}
                            </td>

                            {/* Current Stage */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                  Stage {order.currentStage}/6
                                </span>
                                <span className="text-xs text-gray-500">
                                  {STAGES.find(s => s.id === order.currentStage)?.name}
                                </span>
                              </div>
                            </td>

                            {/* Stage Progress Indicators */}
                            <td className="px-4 py-3">
                              <div className="flex gap-1 items-center justify-center">
                                {STAGES.map((stage) => {
                                  const status = order.stageProgress?.[stage.id] || 'pending';
                                  const isCurrentStage = stage.id === order.currentStage;
                                  return (
                                    <div
                                      key={stage.id}
                                      className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${
                                        status === 'completed'
                                          ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                                          : isCurrentStage
                                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-400 ring-2 ring-blue-200'
                                          : 'bg-gray-100 text-gray-400 border border-gray-300'
                                      }`}
                                      title={`${stage.name}: ${status}`}
                                    >
                                      {getStageStatusIcon(status)}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                order.currentStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                order.currentStatus === 'UNDER REVIEW' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {order.currentStatus}
                              </span>
                            </td>

                            {/* Unit Rate */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              ₹{order.unitRate}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => setSelectedOrderDetails(order)}
                                className="inline-flex items-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Order Details Modal */}
            {selectedOrderDetails && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]" onClick={() => setSelectedOrderDetails(null)}>
                <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-4xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Order Details</h2>
                      <p className="text-sm text-gray-600 mt-1">Order No: {selectedOrderDetails.orderNo}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedOrderDetails(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Order No</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.orderNo}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Order Type</label>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            selectedOrderDetails.orderType === 'SO' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {selectedOrderDetails.orderType}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">SKU</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.sku}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Item Name</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.itemName}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Quantity</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.qty}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Unit Rate</label>
                          <p className="text-sm font-medium text-gray-900">₹{selectedOrderDetails.unitRate}</p>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Order Date</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.odrDate}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Est. Delivery Date</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.estDelDate}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Current Stage</label>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Stage {selectedOrderDetails.currentStage}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Current Status</label>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            selectedOrderDetails.currentStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            selectedOrderDetails.currentStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {selectedOrderDetails.currentStatus}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">License - EI</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.licenseEI}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">License - Architecture</label>
                          <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.licenseArch}</p>
                        </div>
                      </div>
                    </div>

                    {/* Comments Section */}
                    {selectedOrderDetails.comments && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Comments</label>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-sm text-gray-700">{selectedOrderDetails.comments}</p>
                        </div>
                      </div>
                    )}

                    {/* POC for Current Status */}
                    {selectedOrderDetails.pocForCurrentStatus && (
                      <div className="mt-4">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">POC for Current Status</label>
                        <p className="text-sm font-medium text-gray-900">{selectedOrderDetails.pocForCurrentStatus}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setSelectedOrderDetails(null)}
                      className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'orders-review' && (
          <div>
            {/* Search and Filter Bar */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search by Item SKU</label>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  disabled={isViewOnly}
                />
              </div>
              <div className="w-64">
                <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  disabled={isViewOnly}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white ${
                    isViewOnly ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="ALL">ALL ORDERS</option>
                  <option value="OPEN">OPEN ORDERS</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div className="pt-5">
                <button 
                  disabled={isViewOnly}
                  className={`px-6 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm ${
                    isViewOnly 
                      ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  Filter Items
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                </div>
              ) : (
                <div className="">
                  <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">
                          <input 
                            type="checkbox" 
                            disabled={isViewOnly}
                            checked={selectedOrderIds.size > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(new Set(filteredReviewOrders.map(o => o.id)));
                              } else {
                                setSelectedOrderIds(new Set());
                              }
                            }}
                            className={`rounded border-gray-300 w-3.5 h-3.5 ${
                              isViewOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                            }`}
                          />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Order Type</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Order No</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Product SKU</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Compatible Item</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Brand Name</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Qty</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Unit Rate</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">ODR Date</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">EST Date</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_CMT_TEAM</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_R&D PRODUCT</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_QUALITY Compliance</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_Label DESIGN</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">RM_REVIEW</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">PM_REVIEW</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">LABEL_DESIGN STATUS</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">LABEL_REVIEW (QC Status)</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">RM_SYNC</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">PM_SYNC</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License ARCH Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License EI Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">MFG Process</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">HOMOGENIZER Process</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Approval Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Updatedon</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Upstage_no</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#Comments</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#S1_ACTIONS__</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviewOrders.map((order) => {
                      return (
                        <tr key={order.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${openOrderTypeDropdown === order.id ? 'relative z-[9998]' : ''}`}>
                          <td className="px-3 py-2.5 bg-white hover:bg-gray-50">
                            <input 
                              type="checkbox" 
                              disabled={isViewOnly}
                              checked={selectedOrderIds.has(order.id)}
                              onChange={() => handleOrderCheckboxChange(order.id)}
                              className={`rounded border-gray-300 w-3.5 h-3.5 ${
                                isViewOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              }`}
                            />
                          </td>
                          <td className={`px-3 py-2.5 whitespace-nowrap ${openOrderTypeDropdown === order.id ? 'static' : ''}`}>
                            <div className={`${openOrderTypeDropdown === order.id ? 'relative z-[9999]' : 'relative'} inline-block`}>
                              <button
                                disabled={isViewOnly}
                                data-order-id={order.id}
                                onClick={() => !isViewOnly && setOpenOrderTypeDropdown(openOrderTypeDropdown === order.id ? null : order.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                  isViewOnly 
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-pointer'
                                } ${
                                  order.orderType === 'REORDER' 
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                    : order.orderType === 'NEW ORDER'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                              >
                                <span>{order.orderType}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openOrderTypeDropdown === order.id && !isViewOnly && (
                                <div 
                                  ref={dropdownRef} 
                                  className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] min-w-[160px] flex flex-col"
                                >
                                  {ORDER_TYPE_OPTIONS.map((type) => (
                                    <button
                                      key={type}
                                      onClick={() => handleOrderTypeChange(order.id, type)}
                                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-all border-b border-gray-100 last:border-b-0 block ${
                                        order.orderType === type
                                          ? 'bg-blue-50 text-blue-700 font-semibold'
                                          : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                    >
                                      {type}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline font-medium">{order.orderNo}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.productSku}</button>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 min-w-[200px]">{order.compatibleItem}</td>
                          <td className="px-3 py-2.5 text-gray-700 min-w-[180px]">{order.brandName}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.qty}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.unitRate}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.odrDate}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.estDate}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="relative inline-block">
                              <button
                                disabled={isViewOnly}
                                onClick={() => !isViewOnly && setOpenPocDropdown(openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'cmt' ? null : { orderId: order.id, type: 'cmt' })}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                  isViewOnly 
                                    ? 'cursor-not-allowed opacity-60 bg-gray-100 text-gray-700'
                                    : 'cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                <span>{order.pocCmtTeam || 'Assign'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'cmt' && !isViewOnly && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] min-w-[200px]">
                                  {teams.find(t => t.category === 'CMT')?.staff.map((member) => (
                                    <button
                                      key={member.id}
                                      onClick={() => {
                                        setReviewOrders(reviewOrders.map(o => o.id === order.id ? { ...o, pocCmtTeam: member.name } : o));
                                        setOpenPocDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                                          {member.name.charAt(0)}
                                        </div>
                                        <span>{member.name}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="relative inline-block">
                              <button
                                disabled={isViewOnly}
                                onClick={() => !isViewOnly && setOpenPocDropdown(openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'rnd' ? null : { orderId: order.id, type: 'rnd' })}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                  isViewOnly 
                                    ? 'cursor-not-allowed opacity-60 bg-gray-100 text-gray-700'
                                    : 'cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                              >
                                <span>{order.pocRead || 'Assign'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'rnd' && !isViewOnly && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] min-w-[200px]">
                                  {teams.find(t => t.category === 'RND_PRODUCT')?.staff.map((member) => (
                                    <button
                                      key={member.id}
                                      onClick={() => {
                                        setReviewOrders(reviewOrders.map(o => o.id === order.id ? { ...o, pocRead: member.name } : o));
                                        setOpenPocDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">
                                          {member.name.charAt(0)}
                                        </div>
                                        <span>{member.name}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="relative inline-block">
                              <button
                                disabled={isViewOnly}
                                onClick={() => !isViewOnly && setOpenPocDropdown(openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'quality' ? null : { orderId: order.id, type: 'quality' })}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                  isViewOnly 
                                    ? 'cursor-not-allowed opacity-60 bg-gray-100 text-gray-700'
                                    : 'cursor-pointer bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                              >
                                <span>{order.pocQuality || 'Assign'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'quality' && !isViewOnly && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] min-w-[200px]">
                                  {teams.find(t => t.category === 'QUALITY_COMPLIANCE')?.staff.map((member) => (
                                    <button
                                      key={member.id}
                                      onClick={() => {
                                        setReviewOrders(reviewOrders.map(o => o.id === order.id ? { ...o, pocQuality: member.name } : o));
                                        setOpenPocDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs">
                                          {member.name.charAt(0)}
                                        </div>
                                        <span>{member.name}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="relative inline-block">
                              <button
                                disabled={isViewOnly}
                                onClick={() => !isViewOnly && setOpenPocDropdown(openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'label' ? null : { orderId: order.id, type: 'label' })}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                  isViewOnly 
                                    ? 'cursor-not-allowed opacity-60 bg-gray-100 text-gray-700'
                                    : 'cursor-pointer bg-amber-100 text-amber-700 hover:bg-amber-200'
                                }`}
                              >
                                <span>{order.pocLabel || 'Assign'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openPocDropdown?.orderId === order.id && openPocDropdown?.type === 'label' && !isViewOnly && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] min-w-[200px]">
                                  {teams.find(t => t.category === 'LABEL_DESIGN')?.staff.map((member) => (
                                    <button
                                      key={member.id}
                                      onClick={() => {
                                        setReviewOrders(reviewOrders.map(o => o.id === order.id ? { ...o, pocLabel: member.name } : o));
                                        setOpenPocDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xs">
                                          {member.name.charAt(0)}
                                        </div>
                                        <span>{member.name}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.rmReview}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className={order.pmReview === 'add' ? 'text-blue-600 hover:underline' : 'text-gray-700'}>{order.pmReview}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className={order.labelDesign === 'add' ? 'text-blue-600 hover:underline' : 'text-gray-700'}>{order.labelDesign}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.labelReview}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className={order.rmSync === 'CG' ? 'text-blue-600 hover:underline' : 'text-gray-700'}>{order.rmSync}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.pmSync}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.licenseArch}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.licenseEI}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${order.mfgProcess === 'HOT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {order.mfgProcess || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.homogenizerProcess}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.approvalStatus}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.updatedOn || '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.upstageNo || '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.comments}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button className="px-3 py-1 text-xs font-medium text-white bg-amber-500 rounded hover:bg-amber-600 transition-colors">
                                View
                              </button>
                              <button className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors">
                                Shift Record
                              </button>
                              <button 
                                onClick={() => handleViewHistory(order.id)}
                                className="px-3 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Audit History Popup */}
            {viewHistoryOrderId && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]" onClick={handleCloseHistory}>
                <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Audit History</h2>
                      <p className="text-sm text-gray-600 mt-1">Order ID: {viewHistoryOrderId}</p>
                    </div>
                    <button 
                      onClick={handleCloseHistory}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium">No audit logs found</p>
                        <p className="text-sm mt-1">There are no recorded changes for this order yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {log.action}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-700">{log.field}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Old Value</p>
                                    <p className="text-sm font-medium text-red-600">{log.oldValue}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">New Value</p>
                                    <p className="text-sm font-medium text-green-600">{log.newValue}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-xs text-gray-500">{log.timestamp}</p>
                                <p className="text-sm font-medium text-gray-700 mt-1">{log.user}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Conso Report Modal */}
            {consoReportModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]" onClick={() => setConsoReportModal(null)}>
                <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-6xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Consolidation Report - BOM Summary</h2>
                      <p className="text-sm text-gray-600 mt-1">Selected Orders: {selectedOrderIds.size} | Total BOM Items: {getSelectedOrdersBOM().length}</p>
                    </div>
                    <button 
                      onClick={() => setConsoReportModal(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
                    {selectedOrderIds.size === 0 ? (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg text-gray-500 font-medium">No orders selected</p>
                        <p className="text-sm text-gray-400 mt-1">Please select orders from the table to view their BOM</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Selected Orders</p>
                            <p className="text-2xl font-bold text-blue-600">{selectedOrderIds.size}</p>
                          </div>
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Total BOM Items</p>
                            <p className="text-2xl font-bold text-purple-600">{getSelectedOrdersBOM().length}</p>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Total Cost</p>
                            <p className="text-2xl font-bold text-green-600">₹{getSelectedOrdersBOM().reduce((sum, item) => sum + item.totalCost, 0).toLocaleString()}</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Approved Items</p>
                            <p className="text-2xl font-bold text-amber-600">{getSelectedOrdersBOM().filter(i => i.status === 'APPROVED').length}</p>
                          </div>
                        </div>

                        {/* BOM Table */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Order No</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Item Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Component</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Qty</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Unit</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Supplier</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Unit Cost</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Total Cost</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {getSelectedOrdersBOM().map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.orderNo}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{item.itemName}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{item.componentName}</td>
                                  <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">{item.quantity}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{item.unit}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{item.supplier}</td>
                                  <td className="px-4 py-3 text-sm text-center text-gray-700">₹{item.unitCost.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">₹{item.totalCost.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                      item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                      item.status === 'IN_STOCK' ? 'bg-blue-100 text-blue-800' :
                                      item.status === 'ORDERED' ? 'bg-purple-100 text-purple-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setConsoReportModal(null)}
                      className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
                    >
                      Close
                    </button>
                    <button 
                      onClick={() => setStockPlanModal(true)}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Plan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Price Report Modal */}
            {priceReportModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]" onClick={() => setPriceReportModal(null)}>
                <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Price Report</h2>
                      <p className="text-sm text-gray-600 mt-1">View pricing and cost analysis</p>
                    </div>
                    <button 
                      onClick={() => setPriceReportModal(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
                    <div className="space-y-4">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">Price Summary</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total Value</p>
                            <p className="text-2xl font-bold text-purple-600">₹{orders.reduce((sum, o) => sum + (parseInt(o.unitRate || '0') * o.qty), 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Avg Unit Rate</p>
                            <p className="text-2xl font-bold text-purple-600">₹{Math.ceil(orders.reduce((sum, o) => sum + parseInt(o.unitRate || '0'), 0) / orders.length || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total Qty</p>
                            <p className="text-2xl font-bold text-purple-600">{orders.reduce((sum, o) => sum + o.qty, 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 text-center mt-8">Detailed price analysis will appear here</p>
                    </div>
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setPriceReportModal(null)}
                      className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
                    >
                      Close
                    </button>
                    <button className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Download Report
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Change Status Modal */}
            {changeStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]" onClick={() => setChangeStatusModal(null)}>
                <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-50 to-green-100">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Change Status</h2>
                      <p className="text-sm text-gray-600 mt-1">Update order status</p>
                    </div>
                    <button 
                      onClick={() => setChangeStatusModal(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select New Status</label>
                    <select
                      value={selectedStatusForChange}
                      onChange={(e) => setSelectedStatusForChange(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white mb-6"
                    >
                      <option value="">Choose a status...</option>
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ON_HOLD">On Hold</option>
                    </select>
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setChangeStatusModal(null)}
                      className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setChangeStatusModal(null);
                        setSelectedStatusForChange('');
                      }}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stock Planning Modal */}
            {stockPlanModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]" onClick={() => setStockPlanModal(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-7xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Stock Planning & Procurement</h2>
                      <p className="text-sm text-gray-600 mt-1">Manage and plan required stock levels</p>
                    </div>
                    <button 
                      onClick={() => setStockPlanModal(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
                    <div className="space-y-4">
                      {/* Add New Item Button */}
                      <div className="flex justify-end mb-4">
                        <button 
                          onClick={() => {
                            const newItem = {
                              id: Date.now().toString(),
                              component: '',
                              currentStock: 0,
                              requiredStock: 0,
                              unit: 'Kg',
                              supplier: '',
                              leadTime: 0,
                              notes: '',
                            };
                            setStockPlanData([...stockPlanData, newItem]);
                          }}
                          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Component
                        </button>
                      </div>

                      {/* Stock Planning Table */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Component</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Current Stock</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Required Stock</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Unit</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Supplier</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Lead Time (Days)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Notes</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {stockPlanData.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="text"
                                    value={item.component}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, component: e.target.value } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Component name"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="number"
                                    value={item.currentStock}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, currentStock: parseInt(e.target.value) || 0 } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="number"
                                    value={item.requiredStock}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, requiredStock: parseInt(e.target.value) || 0 } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <select
                                    value={item.unit}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, unit: e.target.value } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  >
                                    <option>Kg</option>
                                    <option>Liters</option>
                                    <option>Pieces</option>
                                    <option>Boxes</option>
                                    <option>Units</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="text"
                                    value={item.supplier}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, supplier: e.target.value } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Supplier name"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="number"
                                    value={item.leadTime}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, leadTime: parseInt(e.target.value) || 0 } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="text"
                                    value={item.notes}
                                    onChange={(e) => setStockPlanData(stockPlanData.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Add notes"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  <button
                                    onClick={() => setStockPlanData(stockPlanData.filter(i => i.id !== item.id))}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Info */}
                      <div className="grid grid-cols-3 gap-3 mt-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Total Components</p>
                          <p className="text-2xl font-bold text-blue-600">{stockPlanData.length}</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Current Stock Total</p>
                          <p className="text-2xl font-bold text-green-600">{stockPlanData.reduce((sum, item) => sum + item.currentStock, 0)}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Required Stock Total</p>
                          <p className="text-2xl font-bold text-amber-600">{stockPlanData.reduce((sum, item) => sum + item.requiredStock, 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setStockPlanModal(false)}
                      className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
                    >
                      Close
                    </button>
                    <button className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Plan
                    </button>
                    <button className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}

            </div>
          </div>
        )}
        {activeTab === 'purchase-plan' && (
          <div>
            {/* Sub-tabs for Purchase Plan */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setPurchasePlanSubTab('po-plan')}
                className={`px-6 py-3 text-sm font-medium transition-all ${
                  purchasePlanSubTab === 'po-plan'
                    ? 'border-b-2 border-amber-500 text-amber-600 bg-white'
                    : 'text-gray-600 hover:text-amber-600'
                }`}
              >
                PO Plan
              </button>
              <button
                onClick={() => setPurchasePlanSubTab('rev-1')}
                className={`px-6 py-3 text-sm font-medium transition-all ${
                  purchasePlanSubTab === 'rev-1'
                    ? 'border-b-2 border-amber-500 text-amber-600 bg-white'
                    : 'text-gray-600 hover:text-amber-600'
                }`}
              >
                Rev 1
              </button>
            </div>

            {/* Sub-tab Content */}
            <div className="p-6">
              {purchasePlanSubTab === 'po-plan' && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">PO Plan</h2>
                    <p className="text-sm text-gray-600">Purchase Order Plan</p>
                  </div>

                  {/* Search and Filter Bar (reuse existing controls) */}
                  <div className="p-4 border border-gray-100 rounded-xl bg-white flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Search by Item SKU</label>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                    <div className="w-64">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                      >
                        <option value="ALL">ALL ORDERS</option>
                        <option value="OPEN">OPEN ORDERS</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </div>
                    <div className="pt-5">
                      <button className="px-6 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                        Filter Items
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white relative z-0">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                      </div>
                    ) : (
                      <table className="w-full relative" style={{ borderCollapse: 'collapse', position: 'relative' }}>
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-40 bg-white">
                              <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-40 bg-white">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-40 bg-white">Order No</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-64 z-20 bg-white">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-80 z-20 bg-white">Item Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Req</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">ODR_Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">EST_Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">COM_Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#SYNC</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">INV PLAN</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Transition Date</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License ARCH Status</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License EI Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">MFG Process</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">HMG Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">MRP_Status</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#POC</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#Comments</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Updated_Dt</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poPlanOrders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3.5 sticky left-0 z-30 bg-white hover:bg-gray-50">
                                <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-12 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-64 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                              <td className="px-4 py-3.5 text-sm text-gray-900 min-w-[300px] sticky left-80 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.unitRate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                -
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <button className="text-blue-600 hover:underline text-sm">sync</button>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                {(() => {
                                  const mfg = getMfgProcess(order);
                                  return (
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${mfg === 'HOT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {mfg}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                -
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-license-trigger="true"
                                    onClick={() => openLicenseEditor(order.id, 'arch')}
                                    className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs border hover:shadow-sm transition ${getLicenseStatusClass(getLicenseStatusLabel(order.id, 'arch', order.licenseArch) as string)}`}
                                  >
                                    {getLicenseStatusLabel(order.id, 'arch', order.licenseArch)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openLicenseDropdown?.orderId === order.id && openLicenseDropdown?.type === 'arch' && (
                                    <div ref={licenseDropdownRef} data-license-dropdown="true" className="absolute z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select License Status..</p>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">MFG Unit</label>
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'arch')]?.mfgUnit || 'ARCHEESH LAB'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'arch'), { mfgUnit: e.target.value })}
                                          >
                                            <option>ARCHEESH LAB</option>
                                            <option>EI FACTORY</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">LDIS.No</label>
                                          <input
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            placeholder="LDIS.No"
                                            value={licenseEdits[getLicenseKey(order.id, 'arch')]?.licenseNo || ''}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'arch'), { licenseNo: e.target.value })}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'arch')]?.status || 'YES'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'arch'), { status: e.target.value as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS' })}
                                          >
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="APPLIED">APPLIED</option>
                                            <option value="IN PROCESS">IN PROCESS</option>
                                          </select>
                                          <button
                                            className="p-1.5 bg-blue-600 text-white rounded"
                                            title="Save"
                                            onClick={() => {
                                              const key = getLicenseKey(order.id, 'arch');
                                              const status = (licenseEdits[key]?.status || 'YES') as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS';
                                              applyLicenseStatus(order.id, 'arch', status);
                                              setOpenLicenseDropdown(null);
                                            }}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </button>
                                          <button
                                            className="p-1.5 text-gray-500 hover:text-gray-700"
                                            title="Close"
                                            onClick={() => setOpenLicenseDropdown(null)}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-license-trigger="true"
                                    onClick={() => openLicenseEditor(order.id, 'ei')}
                                    className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs border hover:shadow-sm transition ${getLicenseStatusClass(getLicenseStatusLabel(order.id, 'ei', order.licenseEI) as string)}`}
                                  >
                                    {getLicenseStatusLabel(order.id, 'ei', order.licenseEI)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openLicenseDropdown?.orderId === order.id && openLicenseDropdown?.type === 'ei' && (
                                    <div ref={licenseDropdownRef} data-license-dropdown="true" className="absolute z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select License EI Status..</p>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">MFG Unit</label>
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'ei')]?.mfgUnit || 'EI FACTORY'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'ei'), { mfgUnit: e.target.value })}
                                          >
                                            <option>EI FACTORY</option>
                                            <option>ARCHEESH LAB</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">License No.</label>
                                          <input
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            placeholder="License No"
                                            value={licenseEdits[getLicenseKey(order.id, 'ei')]?.licenseNo || ''}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'ei'), { licenseNo: e.target.value })}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'ei')]?.status || 'YES'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'ei'), { status: e.target.value as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS' })}
                                          >
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="APPLIED">APPLIED</option>
                                            <option value="IN PROCESS">IN PROCESS</option>
                                          </select>
                                          <button
                                            className="p-1.5 bg-blue-600 text-white rounded"
                                            title="Save"
                                            onClick={() => {
                                              const key = getLicenseKey(order.id, 'ei');
                                              const status = (licenseEdits[key]?.status || 'YES') as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS';
                                              applyLicenseStatus(order.id, 'ei', status);
                                              setOpenLicenseDropdown(null);
                                            }}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </button>
                                          <button
                                            className="p-1.5 text-gray-500 hover:text-gray-700"
                                            title="Close"
                                            onClick={() => setOpenLicenseDropdown(null)}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-hmg-trigger="true"
                                    onClick={() => openHmgEditor(order.id)}
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
                                  >
                                    {getHmgStatusLabel(order.id)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openHmgDropdown === order.id && (
                                    <div ref={hmgDropdownRef} data-hmg-dropdown="true" className="absolute z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select HMG Status</p>
                                      <select
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs mb-3"
                                        value={hmgEdits[order.id]?.status || 'YES'}
                                        onChange={(e) => updateHmgEdit(order.id, { status: e.target.value as 'YES' | 'NO' })}
                                      >
                                        <option value="YES">YES</option>
                                        <option value="NO">NO</option>
                                      </select>
                                      <div className="flex items-center gap-2 mt-3">
                                        <button
                                          className="p-1.5 bg-blue-600 text-white rounded"
                                          title="Save"
                                          onClick={() => setOpenHmgDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>
                                        <button
                                          className="p-1.5 text-gray-500 hover:text-gray-700"
                                          title="Close"
                                          onClick={() => setOpenHmgDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-mrp-trigger="true"
                                    onClick={() => openMrpEditor(order.id)}
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
                                  >
                                    {getMrpStatusLabel(order.id)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openMrpDropdown === order.id && (
                                    <div ref={mrpDropdownRef} data-mrp-dropdown="true" className="absolute z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select MRP Review Status</p>
                                      <select
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                        value={mrpEdits[order.id]?.status || 'MRP REV'}
                                        onChange={(e) => updateMrpEdit(order.id, { status: e.target.value as 'MRP REV' | 'PO PLAN' })}
                                      >
                                        <option value="MRP REV">MRP REV</option>
                                        <option value="PO PLAN">PO PLAN</option>
                                      </select>
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          className="p-1.5 bg-blue-600 text-white rounded"
                                          title="Save"
                                          onClick={() => setOpenMrpDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>
                                        <button
                                          className="p-1.5 text-gray-500 hover:text-gray-700"
                                          title="Close"
                                          onClick={() => setOpenMrpDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <button
                                  className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="POC"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
                                  </svg>
                                </button>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <button
                                  data-comment-trigger="true"
                                  onClick={() => openCommentEditor(order.id)}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  {commentEdits[order.id]?.trim() ? commentEdits[order.id] : 'Add'}
                                </button>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">
                                {lastUpdatedDates[order.id] || '-'}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <button
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Action"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                          {/* Comment Modal */}
                          {openCommentModal && (
                            <tr>
                              <td colSpan={24} className="px-0 py-0">
                                <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center" onClick={() => setOpenCommentModal(null)}>
                                  <div 
                                    ref={commentModalRef}
                                    data-comment-modal="true"
                                    className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Comment</h3>
                                    <textarea
                                      autoFocus
                                      value={commentModalText}
                                      onChange={(e) => setCommentModalText(e.target.value)}
                                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                      rows={4}
                                      placeholder="Enter your comment here..."
                                    />
                                    <div className="flex items-center gap-2 mt-4">
                                      <button
                                        className="flex-1 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors font-medium"
                                        onClick={() => saveComment(openCommentModal)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition font-medium"
                                        onClick={() => setOpenCommentModal(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {!poPlanOrders.length && (
                            <tr>
                              <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={24}>
                                No orders found in PURCHASE PLAN.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
              {purchasePlanSubTab === 'rev-1' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Rev 1</h2>
                  <p className="text-gray-600">Revision 1 content will be displayed here.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'purchase-planner' && (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">#3 Connectivity Tracker</h2>
              <button
                onClick={addNewConnectivityRecord}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Record
              </button>
            </div>

            {/* Connectivity Tracker Table */}
            <div className="overflow-x-auto">
              {getConnectivityTrackerOrders().length === 0 && !showAddConnectivityRow ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">No records available. Add new records or create manually.</p>
                </div>
              ) : (
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-50">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-gray-50">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-gray-50">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-gray-50">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Req</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">ODR Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST. Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">COM Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">INV. Can_di</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Transition</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_Loc</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License ARCH</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License EI</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">HMG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FG_PLAN_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_MFG DATE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">TANK_CODE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FILLING_UNI_CDE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_FILLING_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*POC_</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*Comments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Comment Modal */}
                    {openCommentModal && (
                      <tr>
                        <td colSpan={26} className="px-0 py-0">
                          <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center" onClick={() => setOpenCommentModal(null)}>
                            <div 
                              ref={commentModalRef}
                              data-comment-modal="true"
                              className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Comment</h3>
                              <textarea
                                autoFocus
                                value={commentModalText}
                                onChange={(e) => setCommentModalText(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                rows={4}
                                placeholder="Enter your comment here..."
                              />
                              <div className="flex items-center gap-2 mt-4">
                                <button
                                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors font-medium"
                                  onClick={() => saveComment(openCommentModal)}
                                >
                                  Save
                                </button>
                                <button
                                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition font-medium"
                                  onClick={() => setOpenCommentModal(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* All Order Records */}
                    {getConnectivityTrackerOrders().map((order) => {
                      const recordData = connectivityRecords[order.id] || {};
                      const mfgProcess = getMfgProcess(order);
                      const transitionDate = getTransitionDate(order.estDelDate);
                      
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-0 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-12 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-700 min-w-[200px] sticky left-48 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">₹{order.unitRate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <input
                              type="text"
                              defaultValue={recordData.req || '-'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'req', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <input
                              type="text"
                              defaultValue={recordData.invCandi || '-'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'invCandi', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{transitionDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <select
                              defaultValue={recordData.mfgLoc || 'ARCHEESH LAB'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'mfgLoc', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            >
                              <option value="ARCHEESH LAB">ARCHEESH LAB</option>
                              <option value="EI FACTORY">EI FACTORY</option>
                              <option value="OTHER">OTHER</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${order.licenseArch === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {order.licenseArch}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${order.licenseEI === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {order.licenseEI}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">{mfgProcess}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <span 
                              onClick={() => openHmgEditor(order.id)}
                              className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200"
                            >
                              {getHmgStatusLabel(order.id)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                            <input
                              type="number"
                              defaultValue={recordData.fgPlanQty || order.qty}
                              onChange={(e) => updateConnectivityRecord(order.id, 'fgPlanQty', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <select
                              defaultValue={recordData.mfgUnit || ''}
                              onChange={(e) => updateConnectivityRecord(order.id, 'mfgUnit', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            >
                              <option value="">SELECT MFG UNIT</option>
                              <optgroup label="Select MFG Location">
                                <option value="ARCHEESH LAB (MFG 1)">ARCHEESH LAB (MFG 1)</option>
                                <option value="EI FACTORY (MFG 2)">EI FACTORY (MFG 2)</option>
                              </optgroup>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <input
                              type="date"
                              defaultValue={recordData.estMfgDate || order.estDelDate}
                              onChange={(e) => updateConnectivityRecord(order.id, 'estMfgDate', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <select
                              defaultValue={recordData.tankCode || ''}
                              onChange={(e) => updateConnectivityRecord(order.id, 'tankCode', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            >
                              <option value="">SELECT TANK CODE</option>
                              <option value="MANUAL">MANUAL</option>
                              <option value="10 KG">10 KG</option>
                              <option value="100 KG">100 KG</option>
                              <option value="150 KG">150 KG</option>
                              <option value="300 KG">300 KG</option>
                              <option value="750 KL WITH HMZ">750 KL WITH HMZ</option>
                              <option value="1 KL WITH HMZ">1 KL WITH HMZ</option>
                              <option value="1 KL WITHOUT HMZ">1 KL WITHOUT HMZ</option>
                              <option value="2 KL WITH HMZ">2 KL WITH HMZ</option>
                              <option value="2 KL WITHOUT HMZ">2 KL WITHOUT HMZ</option>
                              <option value="3 KL WITH HMZ">3 KL WITH HMZ</option>
                              <option value="3 KL WITHOUT HMZ">3 KL WITHOUT HMZ</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <input
                              type="text"
                              defaultValue={recordData.fillingUniCde || '-'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'fillingUniCde', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              placeholder="Code"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <input
                              type="date"
                              defaultValue={recordData.estFillingUnit || order.estDelDate}
                              onChange={(e) => updateConnectivityRecord(order.id, 'estFillingUnit', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-sm relative">
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() => {
                                  if (openPocModal === order.id) {
                                    setOpenPocModal(null);
                                    return;
                                  }
                                  setPocModalOrder(order);
                                  setOpenPocModal(order.id);
                                }}
                                className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors font-medium"
                              >
                                View POC
                              </button>
                              {openPocModal === order.id && pocModalOrder && (
                                <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 right-0">
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-gray-800">POC USERS</h3>
                                    <button
                                      onClick={() => setOpenPocModal(null)}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="1.5"
                                        stroke="currentColor"
                                        className="w-4 h-4"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <ul className="space-y-2 text-[11px]">
                                    <li>
                                      <span className="font-medium text-gray-700">CM_TEAM: </span>
                                      <span className="text-gray-600">TEJA</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">R&D PRODUCT: </span>
                                      <span className="text-gray-600">(id: 12, name: "BHAVYA")</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">PACKING: </span>
                                      <span className="text-gray-600">-</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">QUALITY PRODUCT: </span>
                                      <span className="text-gray-600">(id: 57, name: "SHIVA KUMAR")</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">QUALITY COMPLIANCE: </span>
                                      <span className="text-gray-600">-</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">LABEL DESIGN: </span>
                                      <span className="text-gray-600">TARUN</span>
                                    </li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm">
                            <button
                              onClick={() => openCommentEditor(order.id)}
                              className="px-2 py-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors font-medium"
                            >
                              {commentEdits[order.id] ? 'Edit' : 'Add'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <button
                              className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
                              title="Action"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* New Record Row (if adding) */}
                    {showAddConnectivityRow && newConnectivityRecord && (
                      <tr className="border-b border-gray-100 bg-green-50 hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm sticky left-0 z-10 bg-green-50">AUTO</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm sticky left-12 z-10 bg-green-50">
                          <input
                            type="text"
                            value={newConnectivityRecord.orderNo}
                            onChange={(e) => setNewConnectivityRecord({ ...newConnectivityRecord, orderNo: e.target.value })}
                            placeholder="Order No"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </td>
                        <td colSpan={24} className="px-4 py-3.5 text-center text-sm text-gray-600">
                          [New record row - Fill all fields and click Save]
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary Section */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{getConnectivityTrackerOrders().length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Qty</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{getConnectivityTrackerOrders().reduce((sum, o) => sum + o.qty, 0)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Value</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">₹{(getConnectivityTrackerOrders().reduce((sum, o) => sum + (o.qty * parseFloat(o.unitRate || '0')), 0) / 100000).toFixed(2)}L</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">License ARCH</p>
                  <p className="text-2xl font-bold text-purple-600 mt-2">{getConnectivityTrackerOrders().filter(o => o.licenseArch === 'yes').length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">License EI</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">{getConnectivityTrackerOrders().filter(o => o.licenseEI === 'yes').length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'production-planner' && (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">#4 Production Planner</h2>
              <button
                onClick={() => {}}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Record
              </button>
            </div>

            {/* Warehouse Filter */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-6">
                <span className="text-sm font-semibold text-gray-700">WAREHOUSE:</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="warehouse"
                      value="ALL"
                      checked={warehouseFilter === 'ALL'}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">All</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="warehouse"
                      value="ARCHEESH LAB"
                      checked={warehouseFilter === 'ARCHEESH LAB'}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">ARCHEESH LAB</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="warehouse"
                      value="EI FACTORY"
                      checked={warehouseFilter === 'EI FACTORY'}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">EI FACTORY</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Production Planner Table */}
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">No records available.</p>
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-50">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-gray-50">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-gray-50">Item SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-gray-50">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Order Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Order Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Req</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Material Request</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">ODR_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">COM_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Transition_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FG_PLAN_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License ARCH</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License EI</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">HMG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PRODUCT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PACKING</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_MFG</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">TANK_CODE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FILLING *line code*</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_FILLING DATE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">RM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Disp_sheet</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*Comments</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*POC</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter((order) => {
                      if (warehouseFilter === 'ALL') return true;
                      const mfgUnit = productionPlannerMfgUnits[order.id];
                      if (warehouseFilter === 'ARCHEESH LAB') return mfgUnit === 'ARCHEESH LAB (MFG 1)';
                      if (warehouseFilter === 'EI FACTORY') return mfgUnit === 'EI FACTORY (MFG 2)';
                      return false;
                    }).map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-0 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-12 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 min-w-[200px] sticky left-48 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.unitRate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">CRD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            defaultValue={order.qty}
                            placeholder="Enter QTY"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue={order.licenseArch === 'yes' ? 'YES' : 'NO'}
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                            <option value="APPLIED">APPLIED</option>
                            <option value="IN PROCESS">IN PROCESS</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue={order.licenseEI === 'yes' ? 'YES' : 'NO'}
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                            <option value="APPLIED">APPLIED</option>
                            <option value="IN PROCESS">IN PROCESS</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">HOT</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">YES</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Production Incharge</option>
                            <option value="PROD EXE 1">PROD EXE 1</option>
                            <option value="PROD EXE 2">PROD EXE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Package Incharge</option>
                            <option value="PACK EXE 1">PACK EXE 1</option>
                            <option value="PACK EXE 2">PACK EXE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            value={productionPlannerMfgUnits[order.id] || ''}
                            onChange={(e) => setProductionPlannerMfgUnits({ ...productionPlannerMfgUnits, [order.id]: e.target.value })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="">SELECT MFG UNIT</option>
                            <option value="ARCHEESH LAB (MFG 1)">ARCHEESH LAB (MFG 1)</option>
                            <option value="EI FACTORY (MFG 2)">EI FACTORY (MFG 2)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="">SELECT TANK CODE</option>
                            <option value="MANUAL">MANUAL</option>
                            <option value="10 KG">10 KG</option>
                            <option value="100 KG">100 KG</option>
                            <option value="750 KL WITH HMZ">750 KL WITH HMZ</option>
                            <option value="1 KL WITH HMZ">1 KL WITH HMZ</option>
                            <option value="2 KL WITH HMZ">2 KL WITH HMZ</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Filling Line Code</option>
                            <option value="TWO HEAD">TWO HEAD</option>
                            <option value="MANUAL LINE 1">MANUAL LINE 1</option>
                            <option value="MANUAL LINE 2">MANUAL LINE 2</option>
                            <option value="SINGLE HEAD 1">SINGLE HEAD 1</option>
                            <option value="SINGLE HEAD 2">SINGLE HEAD 2</option>
                            <option value="FOUR HEAD 1">FOUR HEAD 1</option>
                            <option value="FOUR HEAD 2">FOUR HEAD 2</option>
                            <option value="SIX HEAD">SIX HEAD</option>
                            <option value="TUBE LINE 1">TUBE LINE 1</option>
                            <option value="TUBE LINE 2">TUBE LINE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            value={rmReqDates[order.id] || ''}
                            onChange={(e) => setRmReqDates({ ...rmReqDates, [order.id]: e.target.value })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            value={pmReqDates[order.id] || ''}
                            onChange={(e) => setPmReqDates({ ...pmReqDates, [order.id]: e.target.value })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 text-sm">
                          <button
                            onClick={() => openCommentEditor(order.id)}
                            className="px-2 py-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors font-medium"
                          >
                            {commentEdits[order.id] ? 'Edit' : 'Add'}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-sm relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => {
                                if (openPocModal === order.id) {
                                  setOpenPocModal(null);
                                  return;
                                }
                                setPocModalOrder(order);
                                setOpenPocModal(order.id);
                              }}
                              className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors font-medium"
                            >
                              View POC
                            </button>
                            {openPocModal === order.id && pocModalOrder && (
                              <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 right-0">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-xs font-semibold text-gray-800">POC USERS</h3>
                                  <button
                                    onClick={() => setOpenPocModal(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth="1.5"
                                      stroke="currentColor"
                                      className="w-4 h-4"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <ul className="space-y-2 text-[11px]">
                                  <li>
                                    <span className="font-medium text-gray-700">CM_TEAM: </span>
                                    <span className="text-gray-600">TEJA</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">R&D PRODUCT: </span>
                                    <span className="text-gray-600">(id: 12, name: "BHAVYA")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">PACKING: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY PRODUCT: </span>
                                    <span className="text-gray-600">(id: 57, name: "SHIVA KUMAR")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY COMPLIANCE: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">LABEL DESIGN: </span>
                                    <span className="text-gray-600">TARUN</span>
                                  </li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <button
                            className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
                            title="Action"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeTab === 'production-tracker' && (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">#5 Production Tracker</h2>
              <button
                onClick={() => {}}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Record
              </button>
            </div>

            {/* Warehouse Filter and Search */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-6 mb-4">
                <span className="text-sm font-semibold text-gray-700">WAREHOUSE:</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tracker-warehouse"
                      value="ALL"
                      checked={trackerWarehouseFilter === 'ALL'}
                      onChange={(e) => setTrackerWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">All</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tracker-warehouse"
                      value="ARCHEESH LAB"
                      checked={trackerWarehouseFilter === 'ARCHEESH LAB'}
                      onChange={(e) => setTrackerWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">ARCHEESH LAB</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tracker-warehouse"
                      value="EI FACTORY"
                      checked={trackerWarehouseFilter === 'EI FACTORY'}
                      onChange={(e) => setTrackerWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">EI FACTORY</span>
                  </label>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={trackerSearchQuery}
                  onChange={(e) => setTrackerSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 w-64"
                />
              </div>
            </div>

            {/* Production Tracker Table */}
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">No records available.</p>
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-50">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-gray-50">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-gray-50">Item SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-gray-50">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Order Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Req</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Material Request</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">ODR_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">COM_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Transition_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">HMG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PRODUCT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PACKING</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FG_PLAN_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_MFG</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">TANK_CODE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FILLING *line code*</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_FILLING DATE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">RM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PM_DISPENSE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">RM_DISPENSE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">BUNDLE_NO</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">BUNDLE_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*POC</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Disp_sheet</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*Comments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Complete Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .filter((order) => {
                        // Filter by warehouse
                        if (trackerWarehouseFilter !== 'ALL') {
                          const mfgUnit = productionPlannerMfgUnits[order.id];
                          if (trackerWarehouseFilter === 'ARCHEESH LAB' && mfgUnit !== 'ARCHEESH LAB (MFG 1)') {
                            return false;
                          }
                          if (trackerWarehouseFilter === 'EI FACTORY' && mfgUnit !== 'EI FACTORY (MFG 2)') {
                            return false;
                          }
                        }
                        
                        // Filter by search query
                        if (trackerSearchQuery) {
                          const searchLower = trackerSearchQuery.toLowerCase();
                          return (
                            order.orderNo.toLowerCase().includes(searchLower) ||
                            order.itemName.toLowerCase().includes(searchLower) ||
                            order.sku.toLowerCase().includes(searchLower)
                          );
                        }
                        
                        return true;
                      })
                      .map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-0 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-12 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 min-w-[200px] sticky left-48 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.unitRate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">CRD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-blue-600">HOT</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-yellow-600">YES</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-blue-600">ADD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-blue-600">ADD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            defaultValue={order.qty}
                            placeholder="Enter QTY"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="">SELECT MFG UNIT</option>
                            <option value="ARCHEESH LAB (MFG 1)">ARCHEESH LAB (MFG 1)</option>
                            <option value="EI FACTORY (MFG 2)">EI FACTORY (MFG 2)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="">SELECT TANK CODE</option>
                            <option value="MANUAL">MANUAL</option>
                            <option value="10 KG">10 KG</option>
                            <option value="100 KG">100 KG</option>
                            <option value="750 KL WITH HMZ">750 KL WITH HMZ</option>
                            <option value="1 KL WITH HMZ">1 KL WITH HMZ</option>
                            <option value="2 KL WITH HMZ">2 KL WITH HMZ</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Filling Line Code</option>
                            <option value="TWO HEAD">TWO HEAD</option>
                            <option value="MANUAL LINE 1">MANUAL LINE 1</option>
                            <option value="MANUAL LINE 2">MANUAL LINE 2</option>
                            <option value="SINGLE HEAD 1">SINGLE HEAD 1</option>
                            <option value="SINGLE HEAD 2">SINGLE HEAD 2</option>
                            <option value="FOUR HEAD 1">FOUR HEAD 1</option>
                            <option value="FOUR HEAD 2">FOUR HEAD 2</option>
                            <option value="SIX HEAD">SIX HEAD</option>
                            <option value="TUBE LINE 1">TUBE LINE 1</option>
                            <option value="TUBE LINE 2">TUBE LINE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="text"
                            placeholder="BUNDLE NO"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            placeholder="QTY"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-sm relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => {
                                if (openPocModal === order.id) {
                                  setOpenPocModal(null);
                                  return;
                                }
                                setPocModalOrder(order);
                                setOpenPocModal(order.id);
                              }}
                              className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors font-medium"
                            >
                              View POC
                            </button>
                            {openPocModal === order.id && pocModalOrder && (
                              <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 right-0">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-xs font-semibold text-gray-800">POC USERS</h3>
                                  <button
                                    onClick={() => setOpenPocModal(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth="1.5"
                                      stroke="currentColor"
                                      className="w-4 h-4"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <ul className="space-y-2 text-[11px]">
                                  <li>
                                    <span className="font-medium text-gray-700">CM_TEAM: </span>
                                    <span className="text-gray-600">TEJA</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">R&D PRODUCT: </span>
                                    <span className="text-gray-600">(id: 12, name: "BHAVYA")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">PACKING: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY PRODUCT: </span>
                                    <span className="text-gray-600">(id: 57, name: "SHIVA KUMAR")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY COMPLIANCE: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">LABEL DESIGN: </span>
                                    <span className="text-gray-600">TARUN</span>
                                  </li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm">
                          <input
                            type="text"
                            placeholder="Select"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-sm">
                          <button
                            onClick={() => openCommentEditor(order.id)}
                            className="px-2 py-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors font-medium"
                          >
                            {commentEdits[order.id] ? 'Edit' : 'Add'}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <button
                            onClick={() => {
                              setBundleModalOpen(order.id);
                              setBundleQty('');
                            }}
                            className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-600 transition-colors"
                          >
                            Bundle
                          </button>
                          {bundleModalOpen === order.id && (
                            <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center" onClick={() => setBundleModalOpen(null)}>
                              <div 
                                className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Bundle Order - Planned Qty:</h3>
                                <p className="text-2xl font-bold text-gray-900 mb-4">{order.qty}.00</p>
                                <input
                                  type="number"
                                  value={bundleQty}
                                  onChange={(e) => setBundleQty(e.target.value)}
                                  placeholder="Enter quantity"
                                  className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                />
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => {
                                      setBundleModalOpen(null);
                                      setBundleQty('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors font-medium"
                                  >
                                    Submit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setBundleModalOpen(null);
                                      setBundleQty('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-medium"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeTab === 'goods-receiving' && (
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Goods Receiving</h1>
                  <p className="text-gray-500 text-sm mt-2">Manage purchase orders, GRNs, and receiving processes</p>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
              {/* Scrollable Tab Container */}
              <div className="overflow-x-auto">
                <div className="flex border-b border-gray-200 min-w-max md:min-w-full">
                  {[
                    {
                      id: 'po-requests' as GoodsReceivingTabType,
                      label: 'PO Requests',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    },
                    {
                      id: 'issued-pos' as GoodsReceivingTabType,
                      label: 'Issued P.O.s',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    },
                    {
                      id: 'ongoing-grns' as GoodsReceivingTabType,
                      label: 'Ongoing GRN\'s',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    },
                    {
                      id: 'mrn-fgs' as GoodsReceivingTabType,
                      label: 'MRN/FG\'s',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m0 0v10l8 4" /></svg>
                    },
                    {
                      id: 'print-labels' as GoodsReceivingTabType,
                      label: 'Print Labels',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    },
                    {
                      id: 'grn' as GoodsReceivingTabType,
                      label: 'GRN',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    },
                    {
                      id: 'proofing' as GoodsReceivingTabType,
                      label: 'Proofing',
                      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveGoodsReceivingTab(tab.id)}
                      className={`flex-1 px-4 md:px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                        activeGoodsReceivingTab === tab.id
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-b-2 border-amber-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="hidden sm:inline">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4 md:p-6">
                {/* PO Requests */}
                {activeGoodsReceivingTab === 'po-requests' && (
                  <PORequests />
                )}

                {/* Issued POs */}
                {activeGoodsReceivingTab === 'issued-pos' && (
                  <IssuedPOS />
                )}

                {/* Ongoing GRNs */}
                {activeGoodsReceivingTab === 'ongoing-grns' && (
                  <OngoingGRNs />
                )}

                {/* MRN/FGs */}
                {activeGoodsReceivingTab === 'mrn-fgs' && (
                  <MRNFGs />
                )}

                {/* Print Labels */}
                {activeGoodsReceivingTab === 'print-labels' && (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Labels</h3>
                    <p className="text-gray-500">Generate and print product labels</p>
                  </div>
                )}

                {/* GRN - Main Content */}
                {activeGoodsReceivingTab === 'grn' && (
                  <GRNList />
                )}

                {/* Proofing */}
                {activeGoodsReceivingTab === 'proofing' && <Proofing />}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'order-closure' && <div className="p-6">#6 Order Closure Content</div>}
      </div>
      </>
          )}
        </div>
      </main>

      {/* Task Detail Modal */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedTaskDetail.orderNo}</h2>
                  <p className="text-amber-100">{selectedTaskDetail.itemName}</p>
                </div>
                <button
                  onClick={() => setSelectedTaskDetail(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 font-medium mb-1">Order Type</p>
                  <p className="text-gray-800 font-semibold">{selectedTaskDetail.orderType}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 font-medium mb-1">SKU</p>
                  <p className="text-gray-800 font-semibold">{selectedTaskDetail.sku}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 font-medium mb-1">Quantity</p>
                  <p className="text-gray-800 font-semibold">{selectedTaskDetail.qty}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 font-medium mb-1">Unit Rate</p>
                  <p className="text-gray-800 font-semibold">{selectedTaskDetail.unitRate}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium mb-1">Order Date</p>
                  <p className="text-gray-800 font-semibold">
                    {selectedTaskDetail.odrDate ? new Date(selectedTaskDetail.odrDate).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <p className="text-sm text-amber-600 font-medium mb-1">Est. Delivery Date</p>
                  <p className="text-gray-800 font-semibold">
                    {selectedTaskDetail.estDelDate ? new Date(selectedTaskDetail.estDelDate).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-600 font-medium mb-1">Current Status</p>
                <p className="text-gray-800 font-semibold text-lg">{selectedTaskDetail.currentStatus}</p>
                {selectedTaskDetail.pocForCurrentStatus && (
                  <p className="text-sm text-gray-600 mt-2">POC: {selectedTaskDetail.pocForCurrentStatus}</p>
                )}
              </div>

              {/* Assignment Information */}
              {selectedTaskDetail.assignedTo && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <p className="text-sm text-indigo-600 font-medium mb-3">Assignment Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assigned Team</p>
                      <p className="text-gray-800 font-medium">{selectedTaskDetail.assignedTeam?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                      <p className="text-gray-800 font-medium">
                        {(() => {
                          const allMembers = teams.flatMap(t => [...(t.lead ? [t.lead] : []), ...t.staff]);
                          const member = allMembers.find(m => m.id === selectedTaskDetail.assignedTo);
                          return member?.name || selectedTaskDetail.assignedTo;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assigned By</p>
                      <p className="text-gray-800 font-medium">
                        {(() => {
                          const allLeads = teams.map(t => t.lead).filter(Boolean);
                          const lead = allLeads.find(l => l?.id === selectedTaskDetail.assignedBy);
                          return lead?.name || selectedTaskDetail.assignedBy;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assigned Date</p>
                      <p className="text-gray-800 font-medium">
                        {selectedTaskDetail.assignedAt ? new Date(selectedTaskDetail.assignedAt).toLocaleDateString('en-GB') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage Progress */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 font-medium mb-3">Stage Progress</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6].map((stage) => {
                    const status = selectedTaskDetail.stageProgress[stage];
                    const isCurrent = selectedTaskDetail.currentStage === stage;
                    return (
                      <div key={stage} className="flex-1">
                        <div className={`h-2 rounded-full ${
                          status === 'completed' ? 'bg-green-500' :
                          status === 'in-progress' ? 'bg-blue-500' :
                          'bg-gray-300'
                        } ${isCurrent ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>Planning</span>
                  <span>Design</span>
                  <span>Label</span>
                  <span>Production</span>
                  <span>Dispense</span>
                  <span>Invoice</span>
                </div>
              </div>

              {/* Comments */}
              {selectedTaskDetail.comments && (
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-2">Notes</p>
                  <p className="text-gray-700">{selectedTaskDetail.comments}</p>
                </div>
              )}

              {/* Priority Badge */}
              {selectedTaskDetail.priority && (
                <div className={`rounded-lg p-4 border ${getPriorityColor(selectedTaskDetail.priority)}`}>
                  <p className="text-sm font-medium mb-1">Priority Level</p>
                  <p className="font-bold text-lg capitalize">{selectedTaskDetail.priority}</p>
                </div>
              )}

              {/* Activity Timeline */}
              {selectedTaskDetail.activityLog && selectedTaskDetail.activityLog.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-700 font-medium">Activity Timeline</p>
                    <span className="text-xs text-gray-500">{selectedTaskDetail.activityLog.length} activities</span>
                  </div>
                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {selectedTaskDetail.activityLog.slice().reverse().map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                          {activity.action === 'Status Changed' && (
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          {activity.action === 'Task Assigned' && (
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                          {activity.action === 'Task Reassigned' && (
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          )}
                          {activity.action === 'Comment Added' && (
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          )}
                          {(activity.action === 'Order Created' || activity.action === 'Stage Advanced') && (
                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                            {activity.oldValue && activity.newValue && (
                              <span className="text-xs text-gray-500">
                                {activity.oldValue} → {activity.newValue}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{activity.details}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            by {activity.performedBy} • {activity.performedAt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Comment Section in Modal */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-700 font-medium mb-3">Add Comment</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newComment.trim()) {
                        handleAddComment(selectedTaskDetail.id, newComment);
                        // Re-fetch the updated order
                        const updatedOrder = orders.find(o => o.id === selectedTaskDetail.id);
                        if (updatedOrder) setSelectedTaskDetail(updatedOrder);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newComment.trim()) {
                        handleAddComment(selectedTaskDetail.id, newComment);
                        // Re-fetch the updated order
                        setTimeout(() => {
                          const updatedOrder = orders.find(o => o.id === selectedTaskDetail.id);
                          if (updatedOrder) setSelectedTaskDetail(updatedOrder);
                        }, 100);
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Attachments */}
              {selectedTaskDetail.attachments && selectedTaskDetail.attachments.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-700 font-medium">Attachments</p>
                    <span className="text-xs text-gray-500">{selectedTaskDetail.attachments.length} files</span>
                  </div>
                  <div className="space-y-2">
                    {selectedTaskDetail.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          attachment.type === 'pdf' ? 'bg-red-100 text-red-600' :
                          attachment.type === 'docx' ? 'bg-blue-100 text-blue-600' :
                          attachment.type === 'xlsx' ? 'bg-green-100 text-green-600' :
                          attachment.type === 'ai' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{attachment.size} • Uploaded {attachment.uploadedAt}</p>
                        </div>
                        <button className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* License Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-600 font-medium mb-1">License Arch</p>
                  <p className="text-gray-800 font-semibold">{selectedTaskDetail.licenseArch || 'N/A'}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-600 font-medium mb-1">License EI</p>
                  <p className="text-gray-800 font-semibold">{selectedTaskDetail.licenseEI || 'N/A'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setActiveSubPage('dashboard');
                    setSelectedTaskDetail(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-lg hover:shadow-xl"
                >
                  View in Dashboard
                </button>
                <button
                  onClick={() => setShowReassignModal(selectedTaskDetail)}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  Reassign
                </button>
                <button
                  onClick={() => setSelectedTaskDetail(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Task Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-1">Reassign Task</h2>
                  <p className="text-blue-100 text-sm">{showReassignModal.orderNo}</p>
                </div>
                <button
                  onClick={() => setShowReassignModal(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Current Assignment</p>
                <p className="text-gray-800 font-medium">{showReassignModal.assignedTo || 'Unassigned'} ({showReassignModal.assignedTeam?.replace('_', ' ') || 'No Team'})</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Team</label>
                <select
                  id="reassign-team"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={showReassignModal.assignedTeam || ''}
                >
                  <option value="">Select a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Team Member</label>
                <select
                  id="reassign-member"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={showReassignModal.assignedTo || ''}
                >
                  <option value="">Select a member...</option>
                  {teams.flatMap(team => [
                    ...(team.lead ? [{ ...team.lead, teamId: team.id, isLead: true }] : []),
                    ...team.staff.map(s => ({ ...s, teamId: team.id, isLead: false }))
                  ]).map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} {member.isLead ? '(Lead)' : ''} - {teams.find(t => t.id === member.teamId)?.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    const teamSelect = document.getElementById('reassign-team') as HTMLSelectElement;
                    const memberSelect = document.getElementById('reassign-member') as HTMLSelectElement;
                    if (teamSelect.value && memberSelect.value) {
                      handleReassignTask(showReassignModal.id, memberSelect.value, teamSelect.value);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  Reassign Task
                </button>
                <button
                  onClick={() => setShowReassignModal(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Management Modal */}
      {teamManagementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]" onClick={() => { setTeamManagementModal(false); setEditingMember(null); setEditingTeamName(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-6xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-indigo-100">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Team Management</h2>
                <p className="text-sm text-gray-600 mt-1">Manage team leads and staff assignments</p>
              </div>
              <button 
                onClick={() => { setTeamManagementModal(false); setEditingMember(null); setEditingTeamName(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              <div className="space-y-6">
                {teams.map((team) => (
                  <div key={team.id} className="border border-gray-200 rounded-lg p-5 bg-gradient-to-br from-white to-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div>
                          {editingTeamName === team.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={teamNameInput}
                                onChange={(e) => setTeamNameInput(e.target.value)}
                                className="px-2 py-1 border border-indigo-300 rounded text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveTeamName(team.id)}
                                className="p-1 text-green-600 hover:text-green-700"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingTeamName(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <h3 className="text-lg font-bold text-gray-800">{team.name}</h3>
                          )}
                          <p className="text-xs text-gray-500">{team.staff.length} staff members</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleEditTeamName(team.id, team.name)}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Edit Team
                      </button>
                    </div>

                    {/* Team Lead */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Team Lead</label>
                      {team.lead ? (
                        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {team.lead.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800">{team.lead.name}</p>
                            <p className="text-xs text-gray-500">{team.lead.email}</p>
                          </div>
                          <button 
                            onClick={() => handleEditMember(team.id, team.lead!, true)}
                            className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteMember(team.id, team.lead!.id, true)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <span className="px-2 py-1 bg-indigo-500 text-white text-xs font-medium rounded">Lead</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleAssignTeamLead(team.id)}
                          className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          + Assign Team Lead
                        </button>
                      )}
                    </div>

                    {/* Staff Members */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Staff Members</label>
                      <div className="space-y-2">
                        {team.staff.map((member) => (
                          <div key={member.id} className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors">
                            <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold text-xs">
                              {member.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.email}</p>
                            </div>
                            <button 
                              onClick={() => handleEditMember(team.id, member, false)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => handleDeleteMember(team.id, member.id, false)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => handleAddStaffMember(team.id)}
                          className="w-full p-2.5 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          + Add Staff Member
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setTeamManagementModal(false); setEditingMember(null); setEditingTeamName(null); }}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10002]" onClick={() => setEditingMember(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
              <h3 className="text-lg font-bold text-gray-800">
                {editingMember.member ? 'Edit' : 'Add'} {editingMember.isLead ? 'Team Lead' : 'Staff Member'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {teams.find(t => t.id === editingMember.teamId)?.name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={memberFormData.name}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={memberFormData.email}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMember}
                disabled={!memberFormData.name.trim() || !memberFormData.email.trim()}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editingMember.member ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHub;

