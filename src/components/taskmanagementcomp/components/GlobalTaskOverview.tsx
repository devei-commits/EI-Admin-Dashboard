import React, { useState, useMemo } from 'react';
import {
 Search,
 Filter,
 ChevronDown,
 ChevronUp,
 ArrowRight,
 Edit3,
 Eye,
 Clock,
 CheckCircle2,
 PlayCircle,
 AlertTriangle,
 Calendar,
 User,
 Package,
 Layers,
 TrendingUp,
 RefreshCw,
 Download,
 X,
 Save,
 ChevronLeft,
 ChevronRight as ChevronRightIcon,
} from 'lucide-react';

// ==================== TYPES ====================
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

interface GlobalTask {
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
 currentStage: number;
 stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'>;
 assignedTeam?: string;
 assignedTo?: string;
 assignedBy?: string;
 assignedAt?: string;
 priority?: 'high' | 'medium' | 'low';
 activityLog?: ActivityLogEntry[];
 attachments?: Attachment[];
}

// ==================== STAGE DEFINITIONS ====================
const STAGES = [
 { id: 1, name: 'Planning', color: 'bg-blue-500' },
 { id: 2, name: 'Design', color: 'bg-purple-500' },
 { id: 3, name: 'Label', color: 'bg-pink-500' },
 { id: 4, name: 'Production', color: 'bg-orange-500' },
 { id: 5, name: 'Packaging', color: 'bg-slate-700' },
 { id: 6, name: 'Dispatch', color: 'bg-green-500' },
 { id: 7, name: 'Closed', color: 'bg-gray-500' },
];

const TEAM_NAMES: Record<string, string> = {
 CMT: 'POC CMT Team',
 RND_PRODUCT: 'POC R&D Product Team',
 QUALITY_COMPLIANCE: 'POC Quality Compliance Team',
 LABEL_DESIGN: 'POC Label Design Team',
 PRODUCTION: 'Production Team',
 DISPATCH: 'Dispatch Team',
};

const TEAM_MEMBERS: Record<string, string> = {
 'staff-1': 'Priya Sharma',
 'staff-2': 'Amit Patel',
 'staff-3': 'Neha Singh',
 'staff-4': 'Kavita Desai',
 'staff-5': 'Ravi Verma',
 'staff-6': 'Sunita Joshi',
 'staff-7': 'Anil Mehta',
 'staff-8': 'Vijay Iyer',
 'staff-9': 'Deepa Rao',
 'staff-10': 'Kiran Kulkarni',
 'staff-11': 'Pooja Menon',
 'staff-12': 'Sanjay Gupta',
 'lead-1': 'Rajesh Kumar',
 'lead-2': 'Dr. Suresh Reddy',
 'lead-3': 'Meera Nair',
 'lead-4': 'Arjun Bhat',
};

// ==================== MOCK DATA - All Tasks from System ====================
const ALL_SYSTEM_TASKS: GlobalTask[] = [
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
  activityLog: [],
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
  activityLog: [],
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
  activityLog: [],
  attachments: []
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
  activityLog: [],
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
  activityLog: [],
  attachments: []
 },
 {
  id: '7',
  orderNo: 'EI/PIS/APR/24/0078',
  orderType: 'MODIFIED',
  sku: 'LBLD24032-1',
  itemName: 'Label Compliance Check',
  qty: 4500,
  unitRate: '₹52.00',
  odrDate: '2024-04-08',
  estDelDate: '2025-06-15',
  comDate: 'N/A',
  licenseArch: 'yes',
  licenseEI: 'no',
  stage: 'Label',
  currentStatus: 'In Progress',
  pocForCurrentStatus: 'PharmaDesign Co',
  comments: 'Regulatory compliance check ongoing',
  currentStage: 3,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'in-progress', 4: 'pending', 5: 'pending', 6: 'pending' },
  assignedTeam: 'QUALITY_COMPLIANCE',
  assignedTo: 'staff-8',
  assignedBy: 'lead-3',
  assignedAt: '2024-04-10',
  priority: 'medium',
  activityLog: [],
  attachments: []
 },
 // Production Tasks (Stage 4)
 {
  id: '8',
  orderNo: 'EI/PIS/FEB/24/0033',
  orderType: 'NEW ORDER',
  sku: 'PROD24001-1',
  itemName: 'Batch Production - Serum Line',
  qty: 10000,
  unitRate: '₹180.00',
  odrDate: '2024-02-05',
  estDelDate: '2025-04-10',
  comDate: 'N/A',
  licenseArch: 'yes',
  licenseEI: 'yes',
  stage: 'Production',
  currentStatus: 'In Progress',
  pocForCurrentStatus: 'GlowCare Inc',
  comments: 'Production batch running on schedule',
  currentStage: 4,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'in-progress', 5: 'pending', 6: 'pending' },
  assignedTeam: 'PRODUCTION',
  assignedTo: 'staff-6',
  assignedBy: 'lead-2',
  assignedAt: '2024-02-08',
  priority: 'high',
  activityLog: [],
  attachments: []
 },
 {
  id: '9',
  orderNo: 'EI/PIS/JAN/24/0015',
  orderType: 'REORDER',
  sku: 'PROD24002-1',
  itemName: 'Manufacturing - Cream Base',
  qty: 7500,
  unitRate: '₹95.00',
  odrDate: '2024-01-12',
  estDelDate: '2025-03-20',
  comDate: 'N/A',
  licenseArch: 'no',
  licenseEI: 'yes',
  stage: 'Production',
  currentStatus: 'Pending',
  pocForCurrentStatus: 'SkinFirst Ltd',
  comments: 'Awaiting raw material delivery',
  currentStage: 4,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'pending', 5: 'pending', 6: 'pending' },
  assignedTeam: 'PRODUCTION',
  assignedTo: 'staff-7',
  assignedBy: 'lead-2',
  assignedAt: '2024-01-15',
  priority: 'medium',
  activityLog: [],
  attachments: []
 },
 // Packaging Tasks (Stage 5)
 {
  id: '10',
  orderNo: 'EI/PIS/DEC/23/0290',
  orderType: 'NEW ORDER',
  sku: 'PACK23045-1',
  itemName: 'Final Packaging - Holiday Edition',
  qty: 15000,
  unitRate: '₹35.00',
  odrDate: '2023-12-01',
  estDelDate: '2025-02-15',
  comDate: 'N/A',
  licenseArch: 'yes',
  licenseEI: 'yes',
  stage: 'Packaging',
  currentStatus: 'In Progress',
  pocForCurrentStatus: 'FestiveBox Corp',
  comments: 'Special holiday packaging in progress',
  currentStage: 5,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'in-progress', 6: 'pending' },
  assignedTeam: 'PRODUCTION',
  assignedTo: 'staff-3',
  assignedBy: 'lead-1',
  assignedAt: '2023-12-05',
  priority: 'high',
  activityLog: [],
  attachments: []
 },
 {
  id: '11',
  orderNo: 'EI/PIS/NOV/23/0275',
  orderType: 'MODIFIED',
  sku: 'PACK23038-1',
  itemName: 'Eco-Friendly Packaging Conversion',
  qty: 8000,
  unitRate: '₹42.00',
  odrDate: '2023-11-15',
  estDelDate: '2025-01-30',
  comDate: 'N/A',
  licenseArch: 'yes',
  licenseEI: 'no',
  stage: 'Packaging',
  currentStatus: 'Pending',
  pocForCurrentStatus: 'GreenPack Solutions',
  comments: 'Sustainable material sourcing pending',
  currentStage: 5,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'pending', 6: 'pending' },
  assignedTeam: 'QUALITY_COMPLIANCE',
  assignedTo: 'staff-9',
  assignedBy: 'lead-3',
  assignedAt: '2023-11-18',
  priority: 'low',
  activityLog: [],
  attachments: []
 },
 // Dispatch Tasks (Stage 6)
 {
  id: '12',
  orderNo: 'EI/PIS/OCT/23/0250',
  orderType: 'NEW ORDER',
  sku: 'DISP23001-1',
  itemName: 'Dispatch - North Region',
  qty: 20000,
  unitRate: '₹28.00',
  odrDate: '2023-10-10',
  estDelDate: '2025-01-05',
  comDate: 'N/A',
  licenseArch: 'yes',
  licenseEI: 'yes',
  stage: 'Dispatch',
  currentStatus: 'In Progress',
  pocForCurrentStatus: 'LogiPrime',
  comments: 'Shipment scheduled for next week',
  currentStage: 6,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'in-progress' },
  assignedTeam: 'DISPATCH',
  assignedTo: 'staff-2',
  assignedBy: 'lead-1',
  assignedAt: '2023-10-12',
  priority: 'high',
  activityLog: [],
  attachments: []
 },
 {
  id: '13',
  orderNo: 'EI/PIS/SEP/23/0230',
  orderType: 'REORDER',
  sku: 'DISP23002-1',
  itemName: 'Dispatch - Export Consignment',
  qty: 5000,
  unitRate: '₹65.00',
  odrDate: '2023-09-20',
  estDelDate: '2024-12-28',
  comDate: 'N/A',
  licenseArch: 'yes',
  licenseEI: 'yes',
  stage: 'Dispatch',
  currentStatus: 'Pending',
  pocForCurrentStatus: 'GlobalShip Ltd',
  comments: 'Export documentation pending',
  currentStage: 6,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'pending' },
  assignedTeam: 'DISPATCH',
  assignedTo: 'staff-10',
  assignedBy: 'lead-3',
  assignedAt: '2023-09-22',
  priority: 'medium',
  activityLog: [],
  attachments: []
 },
 // Closed Tasks (Stage 7)
 {
  id: '14',
  orderNo: 'EI/PIS/AUG/23/0200',
  orderType: 'NEW ORDER',
  sku: 'COMP23001-1',
  itemName: 'Completed Order - Skincare Range',
  qty: 12000,
  unitRate: '₹150.00',
  odrDate: '2023-08-05',
  estDelDate: '2024-11-30',
  comDate: '2024-11-28',
  licenseArch: 'yes',
  licenseEI: 'yes',
  stage: 'Closed',
  currentStatus: 'Completed',
  pocForCurrentStatus: 'BeautyFirst',
  comments: 'Successfully delivered - all milestones met',
  currentStage: 7,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'completed' },
  assignedTeam: 'CMT',
  assignedTo: 'staff-1',
  assignedBy: 'lead-1',
  assignedAt: '2023-08-08',
  priority: 'high',
  activityLog: [],
  attachments: []
 },
 {
  id: '15',
  orderNo: 'EI/PIS/JUL/23/0180',
  orderType: 'MODIFIED',
  sku: 'COMP23002-1',
  itemName: 'Completed Order - Hair Care Set',
  qty: 9000,
  unitRate: '₹120.00',
  odrDate: '2023-07-12',
  estDelDate: '2024-10-15',
  comDate: '2024-10-10',
  licenseArch: 'yes',
  licenseEI: 'no',
  stage: 'Closed',
  currentStatus: 'Completed',
  pocForCurrentStatus: 'HairGlow',
  comments: 'Order closed - customer satisfied',
  currentStage: 7,
  stageProgress: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'completed' },
  assignedTeam: 'RND_PRODUCT',
  assignedTo: 'staff-4',
  assignedBy: 'lead-2',
  assignedAt: '2023-07-15',
  priority: 'medium',
  activityLog: [],
  attachments: []
 },
];

// ==================== COMPONENT ====================
export function GlobalTaskOverview() {
 const [tasks, setTasks] = useState<GlobalTask[]>(ALL_SYSTEM_TASKS);
 const [searchTerm, setSearchTerm] = useState('');
 const [stageFilter, setStageFilter] = useState<string>('all');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [priorityFilter, setPriorityFilter] = useState<string>('all');
 const [teamFilter, setTeamFilter] = useState<string>('all');
 const [sortBy, setSortBy] = useState<'estDelDate' | 'priority' | 'stage' | 'orderNo'>('estDelDate');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
 const [showFilters, setShowFilters] = useState(false);
 const [selectedTask, setSelectedTask] = useState<GlobalTask | null>(null);
 const [showTaskModal, setShowTaskModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showPushModal, setShowPushModal] = useState(false);
 const [showAddTaskModal, setShowAddTaskModal] = useState(false);
 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 10;

 // Edit form state
 const [editForm, setEditForm] = useState<{
  status: string;
  priority: string;
  assignedTo: string;
  comments: string;
 }>({
  status: '',
  priority: '',
  assignedTo: '',
  comments: '',
 });

 // Add task form state
 const [addTaskForm, setAddTaskForm] = useState<{
  title: string;
  clientName: string;
  dueDate: string;
  assignTo: string;
  priority: string;
  description: string;
  createdBy: string;
  setReminder: boolean;
 }>({
  title: '',
  clientName: '',
  dueDate: '',
  assignTo: '',
  priority: 'Very Low',
  description: '',
  createdBy: '',
  setReminder: false,
 });

 // Filter and sort tasks
 const filteredTasks = useMemo(() => {
  let result = [...tasks];

  // Search filter
  if (searchTerm) {
   const term = searchTerm.toLowerCase();
   result = result.filter(
    t =>
     t.orderNo.toLowerCase().includes(term) ||
     t.itemName.toLowerCase().includes(term) ||
     t.sku.toLowerCase().includes(term) ||
     t.pocForCurrentStatus.toLowerCase().includes(term) ||
     (t.assignedTo && TEAM_MEMBERS[t.assignedTo]?.toLowerCase().includes(term))
   );
  }

  // Stage filter
  if (stageFilter !== 'all') {
   result = result.filter(t => t.stage === stageFilter);
  }

  // Status filter
  if (statusFilter !== 'all') {
   result = result.filter(t => t.currentStatus === statusFilter);
  }

  // Priority filter
  if (priorityFilter !== 'all') {
   result = result.filter(t => t.priority === priorityFilter);
  }

  // Team filter
  if (teamFilter !== 'all') {
   result = result.filter(t => t.assignedTeam === teamFilter);
  }

  // Sorting
  result.sort((a, b) => {
   let comparison = 0;
   switch (sortBy) {
    case 'estDelDate':
     comparison = new Date(a.estDelDate).getTime() - new Date(b.estDelDate).getTime();
     break;
    case 'priority':
     const priorityOrder = { high: 0, medium: 1, low: 2 };
     comparison = (priorityOrder[a.priority || 'low'] || 2) - (priorityOrder[b.priority || 'low'] || 2);
     break;
    case 'stage':
     comparison = a.currentStage - b.currentStage;
     break;
    case 'orderNo':
     comparison = a.orderNo.localeCompare(b.orderNo);
     break;
   }
   return sortOrder === 'asc' ? comparison : -comparison;
  });

  return result;
 }, [tasks, searchTerm, stageFilter, statusFilter, priorityFilter, teamFilter, sortBy, sortOrder]);

 // Pagination
 const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
 const paginatedTasks = filteredTasks.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
 );

 // Stats
 const stats = useMemo(() => {
  const total = tasks.length;
  const byStage = STAGES.reduce((acc, stage) => {
   acc[stage.name] = tasks.filter(t => t.stage === stage.name).length;
   return acc;
  }, {} as Record<string, number>);
  const pending = tasks.filter(t => t.currentStatus === 'Pending').length;
  const inProgress = tasks.filter(t => t.currentStatus === 'In Progress').length;
  const completed = tasks.filter(t => t.currentStatus === 'Completed').length;
  const highPriority = tasks.filter(t => t.priority === 'high').length;
  const overdue = tasks.filter(t => {
   const dueDate = new Date(t.estDelDate);
   return dueDate < new Date() && t.currentStatus !== 'Completed';
  }).length;

  return { total, byStage, pending, inProgress, completed, highPriority, overdue };
 }, [tasks]);

 // Get status color
 const getStatusColor = (status: string) => {
  switch (status) {
   case 'Pending':
    return 'bg-gray-100 text-slate-900 border-gray-200';
   case 'In Progress':
    return 'bg-blue-100 text-blue-700 border-blue-200';
   case 'Completed':
    return 'bg-green-100 text-green-700 border-green-200';
   case 'On Hold':
    return 'bg-orange-100 text-orange-700 border-orange-200';
   case 'Cancelled':
    return 'bg-gray-100 text-gray-700 border-gray-200';
   default:
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }
 };

 // Get priority color
 const getPriorityColor = (priority?: string) => {
  switch (priority) {
   case 'high':
    return 'bg-red-100 text-red-600';
   case 'medium':
    return 'bg-gray-100 text-slate-800';
   case 'low':
    return 'bg-slate-100 text-slate-600';
   default:
    return 'bg-gray-100 text-gray-500';
  }
 };

 // Get stage color
 const getStageColor = (stage: string) => {
  const stageObj = STAGES.find(s => s.name === stage);
  return stageObj?.color || 'bg-gray-500';
 };

 // Check if overdue
 const isOverdue = (task: GlobalTask) => {
  const dueDate = new Date(task.estDelDate);
  return dueDate < new Date() && task.currentStatus !== 'Completed';
 };

 // Handle view task
 const handleViewTask = (task: GlobalTask) => {
  setSelectedTask(task);
  setShowTaskModal(true);
 };

 // Handle edit task
 const handleEditTask = (task: GlobalTask) => {
  setSelectedTask(task);
  setEditForm({
   status: task.currentStatus,
   priority: task.priority || 'medium',
   assignedTo: task.assignedTo || '',
   comments: task.comments,
  });
  setShowEditModal(true);
 };

 // Handle save edit
 const handleSaveEdit = () => {
  if (!selectedTask) return;

  setTasks(prev =>
   prev.map(t =>
    t.id === selectedTask.id
     ? {
       ...t,
       currentStatus: editForm.status,
       priority: editForm.priority as 'high' | 'medium' | 'low',
       assignedTo: editForm.assignedTo,
       comments: editForm.comments,
       activityLog: [
        ...(t.activityLog || []),
        {
         id: `log-${Date.now()}`,
         action: 'Task Updated',
         performedBy: 'Current User',
         performedAt: new Date().toISOString(),
         details: 'Task details updated via Task Management',
        },
       ],
      }
     : t
   )
  );
  setShowEditModal(false);
  setSelectedTask(null);
 };

 // Handle push (advance stage)
 const handlePushTask = (task: GlobalTask) => {
  setSelectedTask(task);
  setShowPushModal(true);
 };

 // Handle add task
 const handleAddTask = () => {
  if (!addTaskForm.title.trim() || !addTaskForm.assignTo) {
   alert('Please fill in required fields: Title and Assign To');
   return;
  }

  const newTask: GlobalTask = {
   id: `task-${Date.now()}`,
   orderNo: `ORD-${String(tasks.length + 1).padStart(5, '0')}`,
   orderType: 'Standard',
   sku: 'TBD',
   itemName: addTaskForm.title,
   stage: 'Planning',
   currentStage: 1,
   currentStatus: 'Pending',
   priority: addTaskForm.priority as 'high' | 'medium' | 'low',
   qty: 0,
   unitRate: '0',
   odrDate: new Date().toISOString(),
   estDelDate: addTaskForm.dueDate || new Date().toISOString(),
   comDate: '',
   licenseArch: '',
   licenseEI: '',
   pocForCurrentStatus: addTaskForm.assignTo,
   assignedTeam: 'CMT',
   assignedTo: addTaskForm.assignTo,
   comments: addTaskForm.description,
   stageProgress: {
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending',
    5: 'pending',
    6: 'pending',
    7: 'pending',
   },
   activityLog: [
    {
     id: `log-${Date.now()}`,
     action: 'Task Created',
     performedBy: addTaskForm.createdBy || 'Current User',
     performedAt: new Date().toISOString(),
     details: `New task created${addTaskForm.clientName ? ` for client: ${addTaskForm.clientName || 'NA'}` : ' (Client: NA)'}`,
    },
   ],
   attachments: [],
  };

  setTasks(prev => [newTask, ...prev]);
  setShowAddTaskModal(false);
  
  // Reset form
  setAddTaskForm({
   title: '',
   clientName: '',
   dueDate: '',
   assignTo: '',
   priority: 'Very Low',
   description: '',
   createdBy: '',
   setReminder: false,
  });
 };

 // Handle confirm push
 const handleConfirmPush = () => {
  if (!selectedTask || selectedTask.currentStage >= 7) return;

  const newStage = selectedTask.currentStage + 1;
  const newStageName = STAGES.find(s => s.id === newStage)?.name || 'Unknown';
  const oldStageName = selectedTask.stage;

  setTasks(prev =>
   prev.map(t =>
    t.id === selectedTask.id
     ? {
       ...t,
       currentStage: newStage,
       stage: newStageName,
       currentStatus: 'Pending',
       stageProgress: {
        ...t.stageProgress,
        [t.currentStage]: 'completed',
        [newStage]: 'pending',
       },
       activityLog: [
        ...(t.activityLog || []),
        {
         id: `log-${Date.now()}`,
         action: 'Stage Advanced',
         performedBy: 'Current User',
         performedAt: new Date().toISOString(),
         details: `Task pushed to next stage`,
         oldValue: oldStageName,
         newValue: newStageName,
        },
       ],
      }
     : t
   )
  );
  setShowPushModal(false);
  setSelectedTask(null);
 };

 // Toggle sort
 const toggleSort = (field: typeof sortBy) => {
  if (sortBy === field) {
   setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
   setSortBy(field);
   setSortOrder('asc');
  }
 };

 // Reset filters
 const resetFilters = () => {
  setSearchTerm('');
  setStageFilter('all');
  setStatusFilter('all');
  setPriorityFilter('all');
  setTeamFilter('all');
  setCurrentPage(1);
 };

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
     <div>
      <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
       <Layers className="w-8 h-8" />
       Global Task Overview
      </h1>
      <p className="text-gray-100 mt-2">
       Manage all tasks across the entire system • {filteredTasks.length} of {stats.total} tasks
      </p>
     </div>
     <div className="flex items-center gap-3">
      <button
       onClick={() => setShowAddTaskModal(true)}
       className="px-4 py-2 bg-white text-slate-800 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
      >
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
       </svg>
       Add Task
      </button>
      <button
       onClick={resetFilters}
       className="px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors flex items-center gap-2"
      >
       <RefreshCw className="w-4 h-4" />
       Reset
      </button>
      <button className="px-4 py-2 bg-white text-slate-800 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
       <Download className="w-4 h-4" />
       Export
      </button>
     </div>
    </div>
   </div>

   {/* Stats Cards */}
   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-100 rounded-lg">
       <Package className="w-5 h-5 text-blue-600" />
      </div>
      <div>
       <p className="text-xs text-gray-500">Total Tasks</p>
       <p className="text-xl font-bold text-gray-800">{stats.total}</p>
      </div>
     </div>
    </div>
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
       <Clock className="w-5 h-5 text-slate-800" />
      </div>
      <div>
       <p className="text-xs text-gray-500">Pending</p>
       <p className="text-xl font-bold text-slate-800">{stats.pending}</p>
      </div>
     </div>
    </div>
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-100 rounded-lg">
       <PlayCircle className="w-5 h-5 text-blue-600" />
      </div>
      <div>
       <p className="text-xs text-gray-500">In Progress</p>
       <p className="text-xl font-bold text-blue-600">{stats.inProgress}</p>
      </div>
     </div>
    </div>
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-green-100 rounded-lg">
       <CheckCircle2 className="w-5 h-5 text-green-600" />
      </div>
      <div>
       <p className="text-xs text-gray-500">Completed</p>
       <p className="text-xl font-bold text-green-600">{stats.completed}</p>
      </div>
     </div>
    </div>
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-red-100 rounded-lg">
       <AlertTriangle className="w-5 h-5 text-red-600" />
      </div>
      <div>
       <p className="text-xs text-gray-500">High Priority</p>
       <p className="text-xl font-bold text-red-600">{stats.highPriority}</p>
      </div>
     </div>
    </div>
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-orange-100 rounded-lg">
       <Calendar className="w-5 h-5 text-slate-800" />
      </div>
      <div>
       <p className="text-xs text-gray-500">Overdue</p>
       <p className="text-xl font-bold text-slate-800">{stats.overdue}</p>
      </div>
     </div>
    </div>
   </div>

   {/* Stage Distribution */}
   <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <h3 className="text-sm font-medium text-gray-700 mb-3">Tasks by Stage</h3>
    <div className="flex flex-wrap gap-2">
     {STAGES.map(stage => (
      <button
       key={stage.id}
       onClick={() => setStageFilter(stageFilter === stage.name ? 'all' : stage.name)}
       className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        stageFilter === stage.name
         ? `${stage.color} text-white`
         : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
       }`}
      >
       {stage.name}: {stats.byStage[stage.name] || 0}
      </button>
     ))}
    </div>
   </div>

   {/* Search and Filters */}
   <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex flex-col md:flex-row gap-4">
     {/* Search */}
     <div className="flex-1 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
       type="text"
       placeholder="Search by Order No, Item, SKU, POC, or Assignee..."
       value={searchTerm}
       onChange={(e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
       }}
       className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
      />
     </div>

     {/* Filter Toggle */}
     <button
      onClick={() => setShowFilters(!showFilters)}
      className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
       showFilters ? 'bg-gray-100 text-slate-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
     >
      <Filter className="w-4 h-4" />
      Filters
      {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
     </button>
    </div>

    {/* Expanded Filters */}
    {showFilters && (
     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
      {/* Status Filter */}
      <div>
       <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
       <select
        value={statusFilter}
        onChange={(e) => {
         setStatusFilter(e.target.value);
         setCurrentPage(1);
        }}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
       >
        <option value="all">All Statuses</option>
        <option value="Pending">Pending</option>
        <option value="In Progress">In Progress</option>
        <option value="Completed">Completed</option>
        <option value="On Hold">On Hold</option>
       </select>
      </div>

      {/* Priority Filter */}
      <div>
       <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
       <select
        value={priorityFilter}
        onChange={(e) => {
         setPriorityFilter(e.target.value);
         setCurrentPage(1);
        }}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
       >
        <option value="all">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
       </select>
      </div>

      {/* Team Filter */}
      <div>
       <label className="block text-xs font-medium text-gray-500 mb-1">Team</label>
       <select
        value={teamFilter}
        onChange={(e) => {
         setTeamFilter(e.target.value);
         setCurrentPage(1);
        }}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
       >
        <option value="all">All Teams</option>
        {Object.entries(TEAM_NAMES).map(([key, name]) => (
         <option key={key} value={key}>{name}</option>
        ))}
       </select>
      </div>

      {/* Sort By */}
      <div>
       <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
       <select
        value={`${sortBy}-${sortOrder}`}
        onChange={(e) => {
         const [field, order] = e.target.value.split('-');
         setSortBy(field as typeof sortBy);
         setSortOrder(order as 'asc' | 'desc');
        }}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
       >
        <option value="estDelDate-asc">Due Date (Earliest)</option>
        <option value="estDelDate-desc">Due Date (Latest)</option>
        <option value="priority-asc">Priority (High First)</option>
        <option value="priority-desc">Priority (Low First)</option>
        <option value="stage-asc">Stage (1→7)</option>
        <option value="stage-desc">Stage (7→1)</option>
        <option value="orderNo-asc">Order No (A→Z)</option>
        <option value="orderNo-desc">Order No (Z→A)</option>
       </select>
      </div>
     </div>
    )}
   </div>

   {/* Task Table - Desktop */}
   <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
     <table className="w-full">
      <thead className="bg-gray-50">
       <tr>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
         <button onClick={() => toggleSort('orderNo')} className="flex items-center gap-1 hover:text-slate-800">
          Order No
          {sortBy === 'orderNo' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
         </button>
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item / Task</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
         <button onClick={() => toggleSort('stage')} className="flex items-center gap-1 hover:text-slate-800">
          Stage
          {sortBy === 'stage' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
         </button>
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
         <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 hover:text-slate-800">
          Priority
          {sortBy === 'priority' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
         </button>
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned To</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
         <button onClick={() => toggleSort('estDelDate')} className="flex items-center gap-1 hover:text-slate-800">
          Due Date
          {sortBy === 'estDelDate' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
         </button>
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
       {paginatedTasks.length === 0 ? (
        <tr>
         <td colSpan={8} className="px-4 py-12 text-center">
          <div className="flex flex-col items-center text-gray-500">
           <Package className="w-12 h-12 mb-3 text-gray-300" />
           <p className="font-medium">No tasks found</p>
           <p className="text-sm">Try adjusting your filters</p>
          </div>
         </td>
        </tr>
       ) : (
        paginatedTasks.map((task) => (
         <tr key={task.id} className={`hover:bg-gray-50/50 transition-colors ${isOverdue(task) ? 'bg-red-50/30' : ''}`}>
          <td className="px-4 py-3">
           <div className="text-sm font-medium text-gray-900">{task.orderNo}</div>
           <div className="text-xs text-gray-500">{task.orderType}</div>
          </td>
          <td className="px-4 py-3">
           <div className="text-sm font-medium text-gray-800 truncate max-w-[200px]" title={task.itemName}>
            {task.itemName}
           </div>
           <div className="text-xs text-gray-500">{task.sku}</div>
          </td>
          <td className="px-4 py-3">
           <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium text-white ${getStageColor(task.stage)}`}>
            {task.stage}
           </span>
          </td>
          <td className="px-4 py-3">
           <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(task.currentStatus)}`}>
            {task.currentStatus}
           </span>
          </td>
          <td className="px-4 py-3">
           <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}>
            {task.priority || 'N/A'}
           </span>
          </td>
          <td className="px-4 py-3">
           <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
             <User className="w-3 h-3 text-slate-800" />
            </div>
            <div>
             <div className="text-sm text-gray-800">
              {task.assignedTo ? TEAM_MEMBERS[task.assignedTo] || 'Unknown' : 'Unassigned'}
             </div>
             <div className="text-xs text-gray-500">
              {task.assignedTeam ? TEAM_NAMES[task.assignedTeam]?.split(' ')[1] || task.assignedTeam : ''}
             </div>
            </div>
           </div>
          </td>
          <td className="px-4 py-3">
           <div className={`flex items-center gap-1.5 ${isOverdue(task) ? 'text-red-600' : 'text-gray-700'}`}>
            {isOverdue(task) && <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm">{new Date(task.estDelDate).toLocaleDateString()}</span>
           </div>
          </td>
          <td className="px-4 py-3">
           <div className="flex items-center justify-center gap-1">
            <button
             onClick={() => handleViewTask(task)}
             className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
             title="View Details"
            >
             <Eye className="w-4 h-4" />
            </button>
            <button
             onClick={() => handleEditTask(task)}
             className="p-1.5 text-gray-500 hover:text-slate-800 hover:bg-gray-50 rounded-lg transition-colors"
             title="Edit Task"
            >
             <Edit3 className="w-4 h-4" />
            </button>
            {task.currentStage < 7 && (
             <button
              onClick={() => handlePushTask(task)}
              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Push to Next Stage"
             >
              <ArrowRight className="w-4 h-4" />
             </button>
            )}
           </div>
          </td>
         </tr>
        ))
       )}
      </tbody>
     </table>
    </div>

    {/* Pagination */}
    {totalPages > 1 && (
     <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
      <div className="text-sm text-gray-500">
       Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks
      </div>
      <div className="flex items-center gap-2">
       <button
        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
       >
        <ChevronLeft className="w-4 h-4" />
       </button>
       {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let pageNum;
        if (totalPages <= 5) {
         pageNum = i + 1;
        } else if (currentPage <= 3) {
         pageNum = i + 1;
        } else if (currentPage >= totalPages - 2) {
         pageNum = totalPages - 4 + i;
        } else {
         pageNum = currentPage - 2 + i;
        }
        return (
         <button
          key={pageNum}
          onClick={() => setCurrentPage(pageNum)}
          className={`w-8 h-8 rounded-lg text-sm font-medium ${
           currentPage === pageNum
            ? 'bg-slate-800 text-white'
            : 'border border-gray-200 text-gray-600 hover:bg-white'
          }`}
         >
          {pageNum}
         </button>
        );
       })}
       <button
        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
       >
        <ChevronRightIcon className="w-4 h-4" />
       </button>
      </div>
     </div>
    )}
   </div>

   {/* Task Cards - Mobile */}
   <div className="md:hidden space-y-3">
    {paginatedTasks.length === 0 ? (
     <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p className="font-medium text-gray-500">No tasks found</p>
      <p className="text-sm text-gray-400">Try adjusting your filters</p>
     </div>
    ) : (
     paginatedTasks.map((task) => (
      <div key={task.id} className={`bg-white rounded-xl shadow-sm border ${isOverdue(task) ? 'border-red-200 bg-red-50/30' : 'border-gray-100'} p-4`}>
       <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
         <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-gray-800">{task.orderNo}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}>
           {task.priority || 'N/A'}
          </span>
         </div>
         <p className="text-sm text-gray-600 truncate" title={task.itemName}>{task.itemName}</p>
         <p className="text-xs text-gray-400">{task.sku}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
         <button
          onClick={() => handleViewTask(task)}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
         >
          <Eye className="w-4 h-4" />
         </button>
         <button
          onClick={() => handleEditTask(task)}
          className="p-2 text-gray-500 hover:text-slate-800 hover:bg-gray-50 rounded-lg"
         >
          <Edit3 className="w-4 h-4" />
         </button>
        </div>
       </div>
       <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
         <span className="text-gray-500">Stage:</span>
         <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getStageColor(task.stage)}`}>
          {task.stage}
         </span>
        </div>
        <div className="flex items-center gap-2">
         <span className="text-gray-500">Status:</span>
         <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(task.currentStatus)}`}>
          {task.currentStatus}
         </span>
        </div>
        <div className="flex items-center gap-2">
         <User className="w-3 h-3 text-gray-400" />
         <span className="text-gray-700 truncate">
          {task.assignedTo ? TEAM_MEMBERS[task.assignedTo] || 'Unknown' : 'Unassigned'}
         </span>
        </div>
        <div className={`flex items-center gap-2 ${isOverdue(task) ? 'text-red-600' : 'text-gray-700'}`}>
         {isOverdue(task) && <AlertTriangle className="w-3 h-3" />}
         <Calendar className="w-3 h-3 text-gray-400" />
         <span>{new Date(task.estDelDate).toLocaleDateString()}</span>
        </div>
       </div>
       {task.currentStage < 7 && (
        <button
         onClick={() => handlePushTask(task)}
         className="w-full mt-3 py-2 bg-gray-50 text-slate-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
         <ArrowRight className="w-4 h-4" />
         Push to Next Stage
        </button>
       )}
      </div>
     ))
    )}

    {/* Mobile Pagination */}
    {totalPages > 1 && (
     <div className="flex items-center justify-between px-2 py-3">
      <button
       onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
       disabled={currentPage === 1}
       className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm disabled:opacity-50"
      >
       Previous
      </button>
      <span className="text-sm text-gray-500">
       {currentPage} / {totalPages}
      </span>
      <button
       onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
       disabled={currentPage === totalPages}
       className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm disabled:opacity-50"
      >
       Next
      </button>
     </div>
    )}
   </div>

   {/* View Task Modal */}
   {showTaskModal && selectedTask && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
     <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="sticky top-0 bg-slate-800 p-6 rounded-t-2xl">
       <div className="flex items-center justify-between">
        <div>
         <h2 className="text-xl font-bold text-white">{selectedTask.orderNo}</h2>
         <p className="text-gray-100 text-sm mt-1">{selectedTask.itemName}</p>
        </div>
        <button
         onClick={() => setShowTaskModal(false)}
         className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
         <X className="w-5 h-5 text-white" />
        </button>
       </div>
      </div>
      <div className="p-6 space-y-6">
       {/* Task Info Grid */}
       <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Stage</p>
         <p className={`text-sm font-medium mt-1 inline-block px-2 py-0.5 rounded text-white ${getStageColor(selectedTask.stage)}`}>
          {selectedTask.stage}
         </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Status</p>
         <p className={`text-sm font-medium mt-1 inline-block px-2 py-0.5 rounded border ${getStatusColor(selectedTask.currentStatus)}`}>
          {selectedTask.currentStatus}
         </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Priority</p>
         <p className={`text-sm font-medium mt-1 inline-block px-2 py-0.5 rounded capitalize ${getPriorityColor(selectedTask.priority)}`}>
          {selectedTask.priority || 'N/A'}
         </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Quantity</p>
         <p className="text-sm font-medium text-gray-800 mt-1">{selectedTask.qty.toLocaleString()} units</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Order Date</p>
         <p className="text-sm font-medium text-gray-800 mt-1">{new Date(selectedTask.odrDate).toLocaleDateString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Due Date</p>
         <p className={`text-sm font-medium mt-1 ${isOverdue(selectedTask) ? 'text-red-600' : 'text-gray-800'}`}>
          {new Date(selectedTask.estDelDate).toLocaleDateString()}
          {isOverdue(selectedTask) && ' (Overdue)'}
         </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Assigned Team</p>
         <p className="text-sm font-medium text-gray-800 mt-1">
          {selectedTask.assignedTeam ? TEAM_NAMES[selectedTask.assignedTeam] || selectedTask.assignedTeam : 'Unassigned'}
         </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
         <p className="text-xs text-gray-500">Assigned To</p>
         <p className="text-sm font-medium text-gray-800 mt-1">
          {selectedTask.assignedTo ? TEAM_MEMBERS[selectedTask.assignedTo] || 'Unknown' : 'Unassigned'}
         </p>
        </div>
       </div>

       {/* Comments */}
       {selectedTask.comments && (
        <div className="bg-gray-50 rounded-lg p-4">
         <p className="text-xs font-medium text-slate-900 mb-2">Comments</p>
         <p className="text-sm text-gray-700">{selectedTask.comments}</p>
        </div>
       )}

       {/* Stage Progress */}
       <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Stage Progress</p>
        <div className="flex items-center gap-2">
         {STAGES.slice(0, 6).map((stage, _index) => {
          const progress = selectedTask.stageProgress[stage.id];
          return (
           <div key={stage.id} className="flex-1 relative">
            <div
             className={`h-2 rounded-full ${
              progress === 'completed'
               ? 'bg-green-500'
               : progress === 'in-progress'
               ? 'bg-blue-500'
               : 'bg-gray-200'
             }`}
            />
            <p className="text-xs text-center mt-1 text-gray-500">{stage.name}</p>
           </div>
          );
         })}
        </div>
       </div>

       {/* Activity Log */}
       {selectedTask.activityLog && selectedTask.activityLog.length > 0 && (
        <div>
         <p className="text-xs font-medium text-gray-500 mb-3">Recent Activity</p>
         <div className="space-y-2 max-h-40 overflow-y-auto">
          {selectedTask.activityLog.slice(-5).reverse().map(log => (
           <div key={log.id} className="flex items-start gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-slate-800 mt-1.5 flex-shrink-0" />
            <div>
             <p className="text-gray-800">{log.action}</p>
             <p className="text-xs text-gray-500">{log.performedBy} • {new Date(log.performedAt).toLocaleString()}</p>
            </div>
           </div>
          ))}
         </div>
        </div>
       )}

       {/* Action Buttons */}
       <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button
         onClick={() => {
          setShowTaskModal(false);
          handleEditTask(selectedTask);
         }}
         className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
         <Edit3 className="w-4 h-4" />
         Edit Task
        </button>
        {selectedTask.currentStage < 7 && (
         <button
          onClick={() => {
           setShowTaskModal(false);
           handlePushTask(selectedTask);
          }}
          className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
         >
          <ArrowRight className="w-4 h-4" />
          Push to Next Stage
         </button>
        )}
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Edit Task Modal */}
   {showEditModal && selectedTask && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
     <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
      <div className="bg-slate-800 p-5 rounded-t-2xl">
       <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Edit Task</h2>
        <button
         onClick={() => setShowEditModal(false)}
         className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
         <X className="w-5 h-5 text-white" />
        </button>
       </div>
       <p className="text-gray-100 text-sm mt-1">{selectedTask.orderNo}</p>
      </div>
      <div className="p-5 space-y-4">
       {/* Status */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
         value={editForm.status}
         onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
         className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="Pending">Pending</option>
         <option value="In Progress">In Progress</option>
         <option value="Completed">Completed</option>
         <option value="On Hold">On Hold</option>
        </select>
       </div>

       {/* Priority */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select
         value={editForm.priority}
         onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
         className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="high">High</option>
         <option value="medium">Medium</option>
         <option value="low">Low</option>
        </select>
       </div>

       {/* Assigned To */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
        <select
         value={editForm.assignedTo}
         onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
         className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="">Unassigned</option>
         {Object.entries(TEAM_MEMBERS).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
         ))}
        </select>
       </div>

       {/* Comments */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
        <textarea
         value={editForm.comments}
         onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
         rows={3}
         className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700 resize-none"
         placeholder="Add comments..."
        />
       </div>

       {/* Buttons */}
       <div className="flex gap-3 pt-2">
        <button
         onClick={() => setShowEditModal(false)}
         className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
         Cancel
        </button>
        <button
         onClick={handleSaveEdit}
         className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
         <Save className="w-4 h-4" />
         Save Changes
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Push Task Modal */}
   {showPushModal && selectedTask && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
     <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-5 rounded-t-2xl">
       <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Push Task to Next Stage</h2>
        <button
         onClick={() => setShowPushModal(false)}
         className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
         <X className="w-5 h-5 text-white" />
        </button>
       </div>
      </div>
      <div className="p-5 space-y-4">
       <div className="text-center">
        <p className="text-gray-600 mb-4">
         Are you sure you want to push this task to the next stage?
        </p>
        <div className="flex items-center justify-center gap-4 mb-4">
         <div className="text-center">
          <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium text-white ${getStageColor(selectedTask.stage)}`}>
           {selectedTask.stage}
          </span>
          <p className="text-xs text-gray-500 mt-1">Current</p>
         </div>
         <ArrowRight className="w-6 h-6 text-green-500" />
         <div className="text-center">
          <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium text-white ${getStageColor(STAGES.find(s => s.id === selectedTask.currentStage + 1)?.name || '')}`}>
           {STAGES.find(s => s.id === selectedTask.currentStage + 1)?.name || 'N/A'}
          </span>
          <p className="text-xs text-gray-500 mt-1">Next</p>
         </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-left">
         <p className="text-sm text-slate-900">
          <strong>Order:</strong> {selectedTask.orderNo}
         </p>
         <p className="text-sm text-slate-900 mt-1">
          <strong>Item:</strong> {selectedTask.itemName}
         </p>
        </div>
       </div>

       {/* Buttons */}
       <div className="flex gap-3 pt-2">
        <button
         onClick={() => setShowPushModal(false)}
         className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
         Cancel
        </button>
        <button
         onClick={handleConfirmPush}
         className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
        >
         <TrendingUp className="w-4 h-4" />
         Confirm Push
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Add Task Modal */}
   {showAddTaskModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
     <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8">
      <div className="bg-slate-800 p-5 rounded-t-2xl">
       <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">New Task</h2>
        <button
         onClick={() => setShowAddTaskModal(false)}
         className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
         <X className="w-5 h-5 text-white" />
        </button>
       </div>
      </div>
      <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
       {/* Title */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
         Title <span className="text-red-500">*</span>
        </label>
        <input
         type="text"
         value={addTaskForm.title}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, title: e.target.value })}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
         placeholder="Enter task title"
        />
       </div>

       {/* Client Name */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
        <input
         type="text"
         value={addTaskForm.clientName}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, clientName: e.target.value })}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
         placeholder="NA"
        />
        <p className="text-xs text-gray-500 mt-1">Leave empty to show as "NA"</p>
       </div>

       {/* Due Date */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
        <input
         type="date"
         value={addTaskForm.dueDate}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, dueDate: e.target.value })}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        />
       </div>

       {/* Assign To */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
         Assign To <span className="text-red-500">*</span>
        </label>
        <select
         value={addTaskForm.assignTo}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, assignTo: e.target.value })}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="">Select User</option>
         {Object.entries(TEAM_MEMBERS).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
         ))}
        </select>
       </div>

       {/* Priority */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select
         value={addTaskForm.priority}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, priority: e.target.value })}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="Very Low">Very Low</option>
         <option value="low">Low</option>
         <option value="medium">Medium</option>
         <option value="high">High</option>
         <option value="Very High">Very High</option>
        </select>
       </div>

       {/* Description */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
         value={addTaskForm.description}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, description: e.target.value })}
         rows={4}
         maxLength={10000}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700 resize-none"
         placeholder="Max. 10000 characters"
        />
        <p className="text-xs text-gray-500 mt-1">
         {addTaskForm.description.length}/10000 characters
        </p>
       </div>

       {/* Created By */}
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
        <select
         value={addTaskForm.createdBy}
         onChange={(e) => setAddTaskForm({ ...addTaskForm, createdBy: e.target.value })}
         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
        >
         <option value="">Select User</option>
         {Object.entries(TEAM_MEMBERS).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
         ))}
        </select>
       </div>

       {/* Set Reminder */}
       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <label className="text-sm font-medium text-gray-700">Set Reminder</label>
        <button
         type="button"
         onClick={() => setAddTaskForm({ ...addTaskForm, setReminder: !addTaskForm.setReminder })}
         className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          addTaskForm.setReminder ? 'bg-slate-800' : 'bg-gray-300'
         }`}
        >
         <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
           addTaskForm.setReminder ? 'translate-x-6' : 'translate-x-1'
          }`}
         />
        </button>
       </div>

       {/* Buttons */}
       <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
         onClick={() => setShowAddTaskModal(false)}
         className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
         Cancel
        </button>
        <button
         onClick={handleAddTask}
         className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 hover: transition-colors flex items-center justify-center gap-2"
        >
         <Save className="w-4 h-4" />
         Save Task
        </button>
       </div>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
