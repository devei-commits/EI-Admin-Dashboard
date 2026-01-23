/**
 * Task Management Types
 * Comprehensive type definitions for task management with role-based access
 */

// ==================== Task Status & Priority ====================
export type TaskStatus = 
  | 'pending' 
  | 'in-progress' 
  | 'on-hold' 
  | 'completed' 
  | 'cancelled'
  | 'overdue';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Product development categories matching EI cosmetics workflow
export type TaskCategory = 
  | 'formulation' 
  | 'testing' 
  | 'quality' 
  | 'packaging' 
  | 'documentation' 
  | 'production'
  | 'regulatory'
  | 'sourcing'
  | 'other';

// ==================== Role Types ====================
export type UserRole = 
  | 'super-admin' 
  | 'admin' 
  | 'manager' 
  | 'team-lead' 
  | 'staff'
  | 'viewer';

export interface RolePermissions {
  canViewAllTasks: boolean;
  canViewTeamTasks: boolean;
  canViewOwnTasks: boolean;
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  canAssignTask: boolean;
  canApproveTask: boolean;
  canExportTasks: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  'super-admin': {
    canViewAllTasks: true,
    canViewTeamTasks: true,
    canViewOwnTasks: true,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canApproveTask: true,
    canExportTasks: true,
  },
  'admin': {
    canViewAllTasks: true,
    canViewTeamTasks: true,
    canViewOwnTasks: true,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canApproveTask: true,
    canExportTasks: true,
  },
  'manager': {
    canViewAllTasks: false,
    canViewTeamTasks: true,
    canViewOwnTasks: true,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: false,
    canAssignTask: true,
    canApproveTask: true,
    canExportTasks: true,
  },
  'team-lead': {
    canViewAllTasks: false,
    canViewTeamTasks: true,
    canViewOwnTasks: true,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: false,
    canAssignTask: true,
    canApproveTask: false,
    canExportTasks: true,
  },
  'staff': {
    canViewAllTasks: false,
    canViewTeamTasks: false,
    canViewOwnTasks: true,
    canCreateTask: false,
    canEditTask: false,
    canDeleteTask: false,
    canAssignTask: false,
    canApproveTask: false,
    canExportTasks: false,
  },
  'viewer': {
    canViewAllTasks: false,
    canViewTeamTasks: false,
    canViewOwnTasks: true,
    canCreateTask: false,
    canEditTask: false,
    canDeleteTask: false,
    canAssignTask: false,
    canApproveTask: false,
    canExportTasks: false,
  },
};

// ==================== Task Stages ====================
export interface TaskStage {
  id: string;
  name: string;
  shortName: string;
  order: number;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
}

// Product Development Stages matching PIS workflow
export const DEFAULT_TASK_STAGES: Omit<TaskStage, 'id' | 'isCompleted'>[] = [
  { name: 'BD Intake', shortName: 'BD', order: 1 },
  { name: 'Client Requirements', shortName: 'REQ', order: 2 },
  { name: 'R&D Lead Review', shortName: 'R&D', order: 3 },
  { name: 'Formulation Development', shortName: 'FORM', order: 4 },
  { name: 'Lab Testing', shortName: 'LAB', order: 5 },
  { name: 'Quality Review', shortName: 'QA', order: 6 },
  { name: 'Stability Testing', shortName: 'STAB', order: 7 },
  { name: 'Production Ready', shortName: 'PROD', order: 8 },
];

// ==================== Time Tracking ====================
export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  date: string;
  hours: number;
  description: string;
  createdAt: string;
}

export interface TaskTimeStats {
  estimatedHours: number;
  loggedHours: number;
  remainingHours: number;
  percentComplete: number;
  isOverBudget: boolean;
}

// ==================== Team & Assignee ====================
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
  managerId?: string;
  teamLeadId?: string;
  activeTasks: number;
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  teamLeadId?: string;
  teamLeadName?: string;
  members: TeamMember[];
  department: string;
}

// ==================== Main Task Interface ====================
export interface Task {
  id: string;
  taskCode: string;
  title: string;
  description: string;
  
  // Classification
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  tags?: string[];
  
  // Stages
  stages: TaskStage[];
  currentStage: number;
  currentStageName: string;
  
  // Assignment
  assignee: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    department: string;
  };
  createdBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  teamId?: string;
  teamName?: string;
  
  // Time Tracking
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  loggedHours: number;
  timeEntries: TimeEntry[];
  
  // Project Link (optional)
  projectId?: string;
  projectName?: string;
  clientName?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Flags
  isOverdue: boolean;
  isBlocked: boolean;
  blockedReason?: string;
}

// ==================== Dashboard Stats ====================
export interface TaskDashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  onHoldTasks: number;
  
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  
  byCategory: Record<TaskCategory, number>;
  
  byStatus: Record<TaskStatus, number>;
  
  teamPerformance: {
    teamId: string;
    teamName: string;
    totalTasks: number;
    completedTasks: number;
    avgCompletionTime: number;
    onTimePercentage: number;
  }[];
  
  hoursStats: {
    totalEstimated: number;
    totalLogged: number;
    thisWeekLogged: number;
  };
}

// ==================== Filter & Query Types ====================
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category?: TaskCategory[];
  assigneeId?: string;
  teamId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  isOverdue?: boolean;
  isBlocked?: boolean;
  searchTerm?: string;
  currentStage?: number;
}

export interface TaskSortConfig {
  field: 'title' | 'startDate' | 'dueDate' | 'priority' | 'status' | 'loggedHours' | 'currentStage';
  direction: 'asc' | 'desc';
}

// ==================== Action Payloads ====================
export interface CreateTaskPayload {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  assigneeId: string;
  teamId?: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  projectId?: string;
  tags?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  tags?: string[];
  isBlocked?: boolean;
  blockedReason?: string;
}

export interface LogTimePayload {
  taskId: string;
  hours: number;
  date: string;
  description: string;
}

export interface CompleteStagePayload {
  taskId: string;
  stageId: string;
}

// ==================== Current User Context ====================
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  teamId?: string;
  managerId?: string;
  teamLeadId?: string;
  permissions: RolePermissions;
}
