/**
 * Task Management Service
 * Handles all task-related API operations with role-based filtering
 */

import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskFilters,
  TaskSortConfig,
  TaskDashboardStats,
  CreateTaskPayload,
  UpdateTaskPayload,
  LogTimePayload,
  CompleteStagePayload,
  CurrentUser,
  UserRole,
  TeamMember,
  Team,
  DEFAULT_TASK_STAGES,
  ROLE_PERMISSIONS,
  TimeEntry,
} from '../types/task.types';
import { ServiceResult, PaginatedResponse } from '../types/api.types';

// ==================== Mock Data Generators ====================
const generateTaskCode = (): string => {
  const prefix = 'TASK';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}${month}-${random}`;
};

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

// ==================== Mock Teams Data ====================
const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'R&D Team',
    managerId: 'user-manager-1',
    managerName: 'Dr. Priya Sharma',
    teamLeadId: 'user-lead-1',
    teamLeadName: 'Rahul Mehta',
    department: 'Research & Development',
    members: [
      { id: 'user-rd-1', name: 'Anjali Verma', email: 'anjali@eisthetic.com', role: 'staff', department: 'Research & Development', managerId: 'user-manager-1', teamLeadId: 'user-lead-1', activeTasks: 3 },
      { id: 'user-rd-2', name: 'Vikram Singh', email: 'vikram@eisthetic.com', role: 'staff', department: 'Research & Development', managerId: 'user-manager-1', teamLeadId: 'user-lead-1', activeTasks: 2 },
      { id: 'user-rd-3', name: 'Neha Gupta', email: 'neha@eisthetic.com', role: 'staff', department: 'Research & Development', managerId: 'user-manager-1', teamLeadId: 'user-lead-1', activeTasks: 4 },
    ],
  },
  {
    id: 'team-2',
    name: 'Quality Control',
    managerId: 'user-manager-2',
    managerName: 'Suresh Kumar',
    teamLeadId: 'user-lead-2',
    teamLeadName: 'Kavita Patel',
    department: 'Quality Assurance',
    members: [
      { id: 'user-qa-1', name: 'Amit Joshi', email: 'amit@eisthetic.com', role: 'staff', department: 'Quality Assurance', managerId: 'user-manager-2', teamLeadId: 'user-lead-2', activeTasks: 2 },
      { id: 'user-qa-2', name: 'Ritu Sharma', email: 'ritu@eisthetic.com', role: 'staff', department: 'Quality Assurance', managerId: 'user-manager-2', teamLeadId: 'user-lead-2', activeTasks: 3 },
    ],
  },
  {
    id: 'team-3',
    name: 'Production Team',
    managerId: 'user-manager-3',
    managerName: 'Arun Nair',
    teamLeadId: 'user-lead-3',
    teamLeadName: 'Deepak Reddy',
    department: 'Production',
    members: [
      { id: 'user-prod-1', name: 'Sanjay Rao', email: 'sanjay@eisthetic.com', role: 'staff', department: 'Production', managerId: 'user-manager-3', teamLeadId: 'user-lead-3', activeTasks: 2 },
      { id: 'user-prod-2', name: 'Meera Das', email: 'meera@eisthetic.com', role: 'staff', department: 'Production', managerId: 'user-manager-3', teamLeadId: 'user-lead-3', activeTasks: 1 },
    ],
  },
  {
    id: 'team-4',
    name: 'Packaging Team',
    managerId: 'user-manager-4',
    managerName: 'Lakshmi Iyer',
    department: 'Packaging',
    members: [
      { id: 'user-pkg-1', name: 'Rajesh Menon', email: 'rajesh@eisthetic.com', role: 'staff', department: 'Packaging', managerId: 'user-manager-4', activeTasks: 3 },
      { id: 'user-pkg-2', name: 'Pooja Saxena', email: 'pooja@eisthetic.com', role: 'staff', department: 'Packaging', managerId: 'user-manager-4', activeTasks: 2 },
    ],
  },
];

// ==================== Mock Tasks Data ====================
const generateMockTasks = (): Task[] => {
  const statuses: TaskStatus[] = ['pending', 'in-progress', 'on-hold', 'completed', 'cancelled'];
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  const categories: TaskCategory[] = ['formulation', 'testing', 'quality', 'packaging', 'documentation', 'production', 'regulatory', 'sourcing'];
  
  const _allMembers = mockTeams.flatMap(team => [
    ...team.members,
    { id: team.managerId, name: team.managerName, email: `${team.managerId}@eisthetic.com`, role: 'manager' as UserRole, department: team.department, activeTasks: 1 },
    ...(team.teamLeadId ? [{ id: team.teamLeadId, name: team.teamLeadName || '', email: `${team.teamLeadId}@eisthetic.com`, role: 'team-lead' as UserRole, department: team.department, managerId: team.managerId, activeTasks: 2 }] : []),
  ]);

  // Product development tasks matching the PIS system
  const taskTitles = [
    'Body Lotion Formulation - Stage 1 BD Intake',
    'Anti-Aging Serum Development - Client Requirements',
    'Dandruff Control Shampoo - Quality Testing',
    'Facial Cleanser - R&D Lead Review',
    'Healing Ointment - Stability Testing',
    'Cooling Gel Formulation - Packaging Design',
    'New Shampoo Request - BD Manager Review',
    'Moisturizing Cream - Raw Material Sourcing',
    'Sunscreen SPF50 - Regulatory Documentation',
    'Hair Serum - Production Scale-up',
    'Vitamin C Face Wash - QA Testing in Progress',
    'Herbal Body Wash - Formulation Development',
    'Anti-Acne Gel - Clinical Trial Preparation',
    'Baby Lotion - Safety Assessment',
    'Hand Sanitizer - Batch Production',
    'Lip Balm Variant - Packaging Finalization',
    'Eye Cream Formula - Active Ingredient Review',
    'Beard Oil - Market Research Analysis',
    'Aloe Vera Gel - BOM Preparation',
    'Night Repair Cream - Vendor Coordination',
    'Whitening Serum - Compliance Check',
    'Hair Mask Treatment - Sample Preparation',
    'Foot Cream - Cost Analysis',
    'Anti-Dandruff Conditioner - Trial Batch',
  ];

  // Clients from the PIS system
  const clientNames = [
    'Acme Personal Care',
    'Dawn Sanitizing',
    'MedTech Solutions',
    'Global Pharma Inc',
    'Nova Cosmetics',
    'Orchid Wellness',
    'BioHealth Labs',
    'NatureCare Products',
  ];
  
  // Projects matching product development workflow
  const projectNames = [
    'Body Lotion Formulation',
    'Anti-Aging Serum',
    'Dandruff Control Shampoo',
    'Facial Cleanser',
    'Healing Ointment',
    'Cooling Gel',
    'QA Testing in Progress',
    'R&D Development Active',
  ];

  // Product codes similar to PIS system
  const generateProductCode = (index: number): string => {
    const prefixes = ['EI/PIS/JAN/25', 'EI/PIS/DEC/24', 'EI/PIS/MAY/24', 'SJ-FRM'];
    const prefix = prefixes[index % prefixes.length];
    return `${prefix}/${(index + 1).toString().padStart(4, '0')}`;
  };

  // Task descriptions matching product development
  const taskDescriptions = [
    'Complete BD intake process for body lotion formulation. Capture client requirements, target market, and pricing expectations.',
    'Gather detailed client requirements for anti-aging serum including active ingredients, target age group, and packaging preferences.',
    'Perform comprehensive quality testing for dandruff control shampoo including pH balance, viscosity, and microbial testing.',
    'R&D Lead to review facial cleanser formulation for ingredient compatibility and efficacy assessment.',
    'Conduct 3-month stability testing for healing ointment under various temperature and humidity conditions.',
    'Design packaging mockups for cooling gel including label design, bottle specifications, and sustainability options.',
    'BD Manager to review new shampoo formulation request and provide commercial viability assessment.',
    'Source raw materials for moisturizing cream including shea butter, glycerin, and hyaluronic acid.',
    'Prepare regulatory documentation for Sunscreen SPF50 including safety data sheets and compliance certificates.',
    'Scale up hair serum production from lab batch to commercial batch with quality parameters.',
    'Complete QA testing for Vitamin C face wash including preservative efficacy and antioxidant stability.',
    'Develop formulation for herbal body wash using natural extracts and essential oils.',
    'Prepare clinical trial documentation for anti-acne gel including protocol and consent forms.',
    'Complete safety assessment for baby lotion including dermatological testing and allergen screening.',
    'Produce commercial batch of hand sanitizer with 70% alcohol content and moisturizing agents.',
    'Finalize packaging design for lip balm variant including color options and display box.',
    'Review active ingredients for eye cream formula focusing on peptides and retinol derivatives.',
    'Conduct market research analysis for beard oil including competitor analysis and pricing strategy.',
    'Prepare Bill of Materials for aloe vera gel including raw materials, packaging, and labor costs.',
    'Coordinate with vendors for night repair cream ingredients including ceramides and niacinamide.',
    'Verify regulatory compliance for whitening serum including ingredient restrictions and labeling requirements.',
    'Prepare product samples for hair mask treatment for client approval and market testing.',
    'Complete cost analysis for foot cream including manufacturing, packaging, and distribution costs.',
    'Produce trial batch of anti-dandruff conditioner for stability and efficacy testing.',
  ];

  // Tags related to cosmetics industry
  const productTags = [
    ['skincare', 'formulation'],
    ['haircare', 'R&D'],
    ['quality', 'testing'],
    ['packaging', 'design'],
    ['regulatory', 'compliance'],
    ['production', 'scale-up'],
    ['clinical', 'safety'],
    ['natural', 'herbal'],
  ];

  return taskTitles.map((title, index) => {
    const team = mockTeams[index % mockTeams.length];
    const assignee = team.members[index % team.members.length] || team.members[0];
    const statusIndex = index % statuses.length;
    const status = statuses[statusIndex];
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 30));
    
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 20) + 5);
    
    const estimatedHours = Math.floor(Math.random() * 40) + 8;
    const loggedHours = status === 'completed' ? estimatedHours : Math.floor(Math.random() * estimatedHours);
    
    // Generate stages with completion based on status
    const completedStagesCount = status === 'completed' ? 8 : 
                                  status === 'pending' ? 0 :
                                  Math.floor(Math.random() * 6) + 1;
    
    const stages = DEFAULT_TASK_STAGES.map((stage, stageIndex) => ({
      ...stage,
      id: `stage-${index}-${stageIndex}`,
      isCompleted: stageIndex < completedStagesCount,
      completedAt: stageIndex < completedStagesCount ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      completedBy: stageIndex < completedStagesCount ? assignee.name : undefined,
    }));

    const isOverdue = status !== 'completed' && new Date(dueDate) < new Date();

    return {
      id: `task-${index + 1}`,
      taskCode: generateProductCode(index),
      title,
      description: taskDescriptions[index % taskDescriptions.length],
      category: categories[index % categories.length],
      priority: priorities[index % priorities.length],
      status: isOverdue && status === 'in-progress' ? 'overdue' : status,
      tags: productTags[index % productTags.length],
      stages,
      currentStage: completedStagesCount + 1,
      currentStageName: stages[completedStagesCount]?.name || stages[stages.length - 1].name,
      assignee: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
        role: assignee.role,
        department: assignee.department,
      },
      createdBy: {
        id: team.managerId,
        name: team.managerName,
        role: 'manager',
      },
      teamId: team.id,
      teamName: team.name,
      startDate: startDate.toISOString(),
      dueDate: dueDate.toISOString(),
      estimatedHours,
      loggedHours,
      timeEntries: [],
      projectId: `project-${(index % 8) + 1}`,
      projectName: projectNames[index % projectNames.length],
      clientName: clientNames[index % clientNames.length],
      createdAt: startDate.toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: status === 'completed' ? dueDate.toISOString() : undefined,
      isOverdue,
      isBlocked: index % 7 === 0,
      blockedReason: index % 7 === 0 ? 'Waiting for external dependency' : undefined,
    };
  });
};

let mockTasks = generateMockTasks();

// ==================== Role-Based Filtering ====================
const filterTasksByRole = (tasks: Task[], currentUser: CurrentUser): Task[] => {
  const permissions = ROLE_PERMISSIONS[currentUser.role];
  
  if (permissions.canViewAllTasks) {
    return tasks;
  }
  
  if (permissions.canViewTeamTasks) {
    // Manager sees all tasks from their team members
    if (currentUser.role === 'manager') {
      return tasks.filter(task => 
        task.createdBy.id === currentUser.id ||
        task.assignee.id === currentUser.id ||
        task.teamId === currentUser.teamId ||
        mockTeams.some(team => 
          team.managerId === currentUser.id && 
          team.members.some(member => member.id === task.assignee.id)
        )
      );
    }
    
    // Team Lead sees tasks from their team members
    if (currentUser.role === 'team-lead') {
      return tasks.filter(task =>
        task.assignee.id === currentUser.id ||
        mockTeams.some(team =>
          team.teamLeadId === currentUser.id &&
          (team.members.some(member => member.id === task.assignee.id) ||
           task.teamId === team.id)
        )
      );
    }
  }
  
  // Staff only sees their own tasks
  return tasks.filter(task => task.assignee.id === currentUser.id);
};

// ==================== Service Functions ====================

/**
 * Get all tasks with role-based filtering
 */
export const getTasks = async (
  currentUser: CurrentUser,
  filters?: TaskFilters,
  sort?: TaskSortConfig,
  page: number = 1,
  pageSize: number = 10
): Promise<ServiceResult<PaginatedResponse<Task>>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let filteredTasks = filterTasksByRole([...mockTasks], currentUser);
    
    // Apply filters
    if (filters) {
      if (filters.status?.length) {
        filteredTasks = filteredTasks.filter(task => filters.status!.includes(task.status));
      }
      if (filters.priority?.length) {
        filteredTasks = filteredTasks.filter(task => filters.priority!.includes(task.priority));
      }
      if (filters.category?.length) {
        filteredTasks = filteredTasks.filter(task => filters.category!.includes(task.category));
      }
      if (filters.assigneeId) {
        filteredTasks = filteredTasks.filter(task => task.assignee.id === filters.assigneeId);
      }
      if (filters.teamId) {
        filteredTasks = filteredTasks.filter(task => task.teamId === filters.teamId);
      }
      if (filters.isOverdue !== undefined) {
        filteredTasks = filteredTasks.filter(task => task.isOverdue === filters.isOverdue);
      }
      if (filters.isBlocked !== undefined) {
        filteredTasks = filteredTasks.filter(task => task.isBlocked === filters.isBlocked);
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filteredTasks = filteredTasks.filter(task =>
          task.title.toLowerCase().includes(term) ||
          task.taskCode.toLowerCase().includes(term) ||
          task.assignee.name.toLowerCase().includes(term) ||
          task.projectName?.toLowerCase().includes(term)
        );
      }
      if (filters.currentStage !== undefined) {
        filteredTasks = filteredTasks.filter(task => task.currentStage === filters.currentStage);
      }
    }
    
    // Apply sorting
    if (sort) {
      filteredTasks.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'startDate':
            comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            break;
          case 'dueDate':
            comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            break;
          case 'priority':
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
            break;
          case 'status':
            comparison = a.status.localeCompare(b.status);
            break;
          case 'loggedHours':
            comparison = a.loggedHours - b.loggedHours;
            break;
          case 'currentStage':
            comparison = a.currentStage - b.currentStage;
            break;
        }
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    }
    
    // Pagination
    const total = filteredTasks.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedTasks = filteredTasks.slice(startIndex, startIndex + pageSize);
    
    return {
      success: true,
      data: {
        data: paginatedTasks,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
        success: true,
      },
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to fetch tasks',
        code: 'FETCH_TASKS_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Get task by ID
 */
export const getTaskById = async (
  taskId: string,
  currentUser: CurrentUser
): Promise<ServiceResult<Task>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const task = mockTasks.find(t => t.id === taskId);
    
    if (!task) {
      return {
        success: false,
        error: {
          message: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    const allowedTasks = filterTasksByRole([task], currentUser);
    if (allowedTasks.length === 0) {
      return {
        success: false,
        error: {
          message: 'You do not have permission to view this task',
          code: 'PERMISSION_DENIED',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    return {
      success: true,
      data: task,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to fetch task',
        code: 'FETCH_TASK_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Create a new task
 */
export const createTask = async (
  payload: CreateTaskPayload,
  currentUser: CurrentUser
): Promise<ServiceResult<Task>> => {
  try {
    const permissions = ROLE_PERMISSIONS[currentUser.role];
    if (!permissions.canCreateTask) {
      return {
        success: false,
        error: {
          message: 'You do not have permission to create tasks',
          code: 'PERMISSION_DENIED',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Find assignee details
    const allMembers = mockTeams.flatMap(team => [
      ...team.members,
      { id: team.managerId, name: team.managerName, email: '', role: 'manager' as UserRole, department: team.department, activeTasks: 0 },
    ]);
    
    const assignee = allMembers.find(m => m.id === payload.assigneeId);
    if (!assignee) {
      return {
        success: false,
        error: {
          message: 'Assignee not found',
          code: 'ASSIGNEE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    const stages = DEFAULT_TASK_STAGES.map((stage, _index) => ({
      ...stage,
      id: generateId(),
      isCompleted: false,
    }));
    
    const newTask: Task = {
      id: generateId(),
      taskCode: generateTaskCode(),
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
      status: 'pending',
      tags: payload.tags,
      stages,
      currentStage: 1,
      currentStageName: stages[0].name,
      assignee: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email || '',
        role: assignee.role,
        department: assignee.department,
      },
      createdBy: {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      },
      teamId: payload.teamId,
      teamName: mockTeams.find(t => t.id === payload.teamId)?.name,
      startDate: payload.startDate,
      dueDate: payload.dueDate,
      estimatedHours: payload.estimatedHours,
      loggedHours: 0,
      timeEntries: [],
      projectId: payload.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOverdue: false,
      isBlocked: false,
    };
    
    mockTasks.unshift(newTask);
    
    return {
      success: true,
      data: newTask,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to create task',
        code: 'CREATE_TASK_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Update a task
 */
export const updateTask = async (
  taskId: string,
  payload: UpdateTaskPayload,
  currentUser: CurrentUser
): Promise<ServiceResult<Task>> => {
  try {
    const permissions = ROLE_PERMISSIONS[currentUser.role];
    if (!permissions.canEditTask) {
      return {
        success: false,
        error: {
          message: 'You do not have permission to edit tasks',
          code: 'PERMISSION_DENIED',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: {
          message: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    mockTasks[taskIndex] = {
      ...mockTasks[taskIndex],
      ...payload,
      updatedAt: new Date().toISOString(),
      completedAt: payload.status === 'completed' ? new Date().toISOString() : mockTasks[taskIndex].completedAt,
    };
    
    return {
      success: true,
      data: mockTasks[taskIndex],
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to update task',
        code: 'UPDATE_TASK_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Complete a stage
 */
export const completeStage = async (
  payload: CompleteStagePayload,
  currentUser: CurrentUser
): Promise<ServiceResult<Task>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const taskIndex = mockTasks.findIndex(t => t.id === payload.taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: {
          message: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    const task = mockTasks[taskIndex];
    const stageIndex = task.stages.findIndex(s => s.id === payload.stageId);
    
    if (stageIndex === -1) {
      return {
        success: false,
        error: {
          message: 'Stage not found',
          code: 'STAGE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    task.stages[stageIndex].isCompleted = true;
    task.stages[stageIndex].completedAt = new Date().toISOString();
    task.stages[stageIndex].completedBy = currentUser.name;
    
    // Update current stage
    const nextIncompleteStage = task.stages.find(s => !s.isCompleted);
    task.currentStage = nextIncompleteStage ? nextIncompleteStage.order : task.stages.length;
    task.currentStageName = nextIncompleteStage ? nextIncompleteStage.name : 'Completed';
    
    // Check if all stages are complete
    if (task.stages.every(s => s.isCompleted)) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
    } else {
      task.status = 'in-progress';
    }
    
    task.updatedAt = new Date().toISOString();
    mockTasks[taskIndex] = task;
    
    return {
      success: true,
      data: task,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to complete stage',
        code: 'COMPLETE_STAGE_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Log time for a task
 */
export const logTime = async (
  payload: LogTimePayload,
  currentUser: CurrentUser
): Promise<ServiceResult<Task>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const taskIndex = mockTasks.findIndex(t => t.id === payload.taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: {
          message: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    const timeEntry: TimeEntry = {
      id: generateId(),
      taskId: payload.taskId,
      userId: currentUser.id,
      userName: currentUser.name,
      date: payload.date,
      hours: payload.hours,
      description: payload.description,
      createdAt: new Date().toISOString(),
    };
    
    mockTasks[taskIndex].timeEntries.push(timeEntry);
    mockTasks[taskIndex].loggedHours += payload.hours;
    mockTasks[taskIndex].updatedAt = new Date().toISOString();
    
    return {
      success: true,
      data: mockTasks[taskIndex],
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to log time',
        code: 'LOG_TIME_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Get dashboard stats
 */
export const getTaskDashboardStats = async (
  currentUser: CurrentUser
): Promise<ServiceResult<TaskDashboardStats>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const tasks = filterTasksByRole([...mockTasks], currentUser);
    
    const stats: TaskDashboardStats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      overdueTasks: tasks.filter(t => t.isOverdue || t.status === 'overdue').length,
      onHoldTasks: tasks.filter(t => t.status === 'on-hold').length,
      byPriority: {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length,
        urgent: tasks.filter(t => t.priority === 'urgent').length,
      },
      byCategory: {
        formulation: tasks.filter(t => t.category === 'formulation').length,
        testing: tasks.filter(t => t.category === 'testing').length,
        quality: tasks.filter(t => t.category === 'quality').length,
        packaging: tasks.filter(t => t.category === 'packaging').length,
        documentation: tasks.filter(t => t.category === 'documentation').length,
        production: tasks.filter(t => t.category === 'production').length,
        regulatory: tasks.filter(t => t.category === 'regulatory').length,
        sourcing: tasks.filter(t => t.category === 'sourcing').length,
        other: tasks.filter(t => t.category === 'other').length,
      },
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        'in-progress': tasks.filter(t => t.status === 'in-progress').length,
        'on-hold': tasks.filter(t => t.status === 'on-hold').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
        overdue: tasks.filter(t => t.status === 'overdue').length,
      },
      teamPerformance: mockTeams.map(team => {
        const teamTasks = tasks.filter(t => t.teamId === team.id);
        const completedTeamTasks = teamTasks.filter(t => t.status === 'completed');
        return {
          teamId: team.id,
          teamName: team.name,
          totalTasks: teamTasks.length,
          completedTasks: completedTeamTasks.length,
          avgCompletionTime: completedTeamTasks.length > 0 ? 5.5 : 0,
          onTimePercentage: completedTeamTasks.length > 0 ? 78 : 0,
        };
      }),
      hoursStats: {
        totalEstimated: tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
        totalLogged: tasks.reduce((sum, t) => sum + t.loggedHours, 0),
        thisWeekLogged: tasks.reduce((sum, t) => sum + Math.min(t.loggedHours, 8), 0),
      },
    };
    
    return {
      success: true,
      data: stats,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to fetch dashboard stats',
        code: 'FETCH_STATS_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Get teams for assignment dropdown
 */
export const getTeams = async (): Promise<ServiceResult<Team[]>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      success: true,
      data: mockTeams,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to fetch teams',
        code: 'FETCH_TEAMS_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Get team members for assignment dropdown
 */
export const getTeamMembers = async (teamId?: string): Promise<ServiceResult<TeamMember[]>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let members: TeamMember[] = [];
    
    if (teamId) {
      const team = mockTeams.find(t => t.id === teamId);
      if (team) {
        members = [...team.members];
      }
    } else {
      members = mockTeams.flatMap(team => team.members);
    }
    
    return {
      success: true,
      data: members,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to fetch team members',
        code: 'FETCH_MEMBERS_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Delete a task
 */
export const deleteTask = async (
  taskId: string,
  currentUser: CurrentUser
): Promise<ServiceResult<boolean>> => {
  try {
    const permissions = ROLE_PERMISSIONS[currentUser.role];
    if (!permissions.canDeleteTask) {
      return {
        success: false,
        error: {
          message: 'You do not have permission to delete tasks',
          code: 'PERMISSION_DENIED',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: {
          message: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString(),
        },
      };
    }
    
    mockTasks.splice(taskIndex, 1);
    
    return {
      success: true,
      data: true,
    };
  } catch (_error) {
    return {
      success: false,
      error: {
        message: 'Failed to delete task',
        code: 'DELETE_TASK_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  }
};

