/**
 * Task Management Component
 * Comprehensive task tracking with role-based access, stages, and hours logging
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  User,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Timer,
  Eye,
  Edit3,
  Trash2,
  MoreVertical,
  Download,
  TrendingUp,
  BarChart2,
  ListFilter,
  Check,
  X,
  PlayCircle,
  ArrowRight,
  Tag,
  Building2,
  FolderKanban,
  Target,
  Layers,
  Activity,
} from 'lucide-react';
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
  CurrentUser,
  UserRole,
  Team,
  TeamMember,
  ROLE_PERMISSIONS,
  DEFAULT_TASK_STAGES,
} from '../../types/task.types';
import * as taskService from '../../services/task.service';

// ==================== Helper Functions ====================
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getDaysRemaining = (dueDate: string): number => {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ==================== Mock Current User (Replace with real auth) ====================
const getMockCurrentUser = (role: UserRole): CurrentUser => {
  const users: Record<UserRole, CurrentUser> = {
    'super-admin': {
      id: 'user-super-admin',
      name: 'EI Admin',
      email: 'admin@eisthetic.com',
      role: 'super-admin',
      department: 'Administration',
      permissions: ROLE_PERMISSIONS['super-admin'],
    },
    'admin': {
      id: 'user-admin',
      name: 'System Admin',
      email: 'sysadmin@eisthetic.com',
      role: 'admin',
      department: 'Administration',
      permissions: ROLE_PERMISSIONS['admin'],
    },
    'manager': {
      id: 'user-manager-1',
      name: 'Dr. Priya Sharma',
      email: 'priya@eisthetic.com',
      role: 'manager',
      department: 'Research & Development',
      teamId: 'team-1',
      permissions: ROLE_PERMISSIONS['manager'],
    },
    'team-lead': {
      id: 'user-lead-1',
      name: 'Rahul Mehta',
      email: 'rahul@eisthetic.com',
      role: 'team-lead',
      department: 'Research & Development',
      teamId: 'team-1',
      managerId: 'user-manager-1',
      permissions: ROLE_PERMISSIONS['team-lead'],
    },
    'staff': {
      id: 'user-rd-1',
      name: 'Anjali Verma',
      email: 'anjali@eisthetic.com',
      role: 'staff',
      department: 'Research & Development',
      teamId: 'team-1',
      managerId: 'user-manager-1',
      teamLeadId: 'user-lead-1',
      permissions: ROLE_PERMISSIONS['staff'],
    },
    'viewer': {
      id: 'user-viewer',
      name: 'Guest User',
      email: 'guest@eisthetic.com',
      role: 'viewer',
      department: 'Guest',
      permissions: ROLE_PERMISSIONS['viewer'],
    },
  };
  return users[role];
};

// ==================== Status Badge Component ====================
const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const config: Record<TaskStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    'pending': { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock size={12} />, label: 'Pending' },
    'in-progress': { bg: 'bg-blue-100', text: 'text-blue-700', icon: <PlayCircle size={12} />, label: 'In Progress' },
    'on-hold': { bg: 'bg-orange-100', text: 'text-orange-700', icon: <Pause size={12} />, label: 'On Hold' },
    'completed': { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 size={12} />, label: 'Completed' },
    'cancelled': { bg: 'bg-gray-100', text: 'text-gray-700', icon: <XCircle size={12} />, label: 'Cancelled' },
    'overdue': { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle size={12} />, label: 'Overdue' },
  };
  
  const { bg, text, icon, label } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      {label}
    </span>
  );
};

// ==================== Priority Badge Component ====================
const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const config: Record<TaskPriority, { bg: string; text: string; label: string }> = {
    'low': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' },
    'medium': { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Medium' },
    'high': { bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' },
    'urgent': { bg: 'bg-red-100', text: 'text-red-600', label: 'Urgent' },
  };
  
  const { bg, text, label } = config[priority];
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

// ==================== Category Badge Component ====================
const CategoryBadge: React.FC<{ category: TaskCategory }> = ({ category }) => {
  const config: Record<TaskCategory, { bg: string; label: string }> = {
    'formulation': { bg: 'bg-violet-100 text-violet-700', label: 'Formulation' },
    'testing': { bg: 'bg-cyan-100 text-cyan-700', label: 'Testing' },
    'quality': { bg: 'bg-green-100 text-green-700', label: 'Quality' },
    'packaging': { bg: 'bg-pink-100 text-pink-700', label: 'Packaging' },
    'documentation': { bg: 'bg-emerald-100 text-emerald-700', label: 'Documentation' },
    'production': { bg: 'bg-amber-100 text-amber-700', label: 'Production' },
    'regulatory': { bg: 'bg-indigo-100 text-indigo-700', label: 'Regulatory' },
    'sourcing': { bg: 'bg-rose-100 text-rose-700', label: 'Sourcing' },
    'other': { bg: 'bg-gray-100 text-gray-700', label: 'Other' },
  };
  
  const { bg, label } = config[category];
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
};

// ==================== Stage Progress Component ====================
const StageProgress: React.FC<{ stages: Task['stages']; currentStage: number }> = ({ stages, currentStage }) => {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => (
        <div
          key={stage.id}
          className={`group relative w-7 h-7 rounded flex items-center justify-center text-xs font-medium cursor-pointer transition-all ${
            stage.isCompleted
              ? 'bg-green-500 text-white shadow-sm'
              : index + 1 === currentStage
              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200'
              : 'bg-gray-200 text-gray-500'
          }`}
          title={`${stage.name} - ${stage.isCompleted ? 'Completed' : index + 1 === currentStage ? 'Current' : 'Pending'}`}
        >
          {stage.isCompleted ? (
            <Check size={14} className="stroke-[3]" />
          ) : (
            <span>{index + 1}</span>
          )}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            {stage.name}
            {stage.completedBy && (
              <div className="text-gray-300 text-[10px]">by {stage.completedBy}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==================== Hours Progress Component ====================
const HoursProgress: React.FC<{ logged: number; estimated: number }> = ({ logged, estimated }) => {
  const percentage = estimated > 0 ? Math.min((logged / estimated) * 100, 100) : 0;
  const isOverBudget = logged > estimated;
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverBudget ? 'bg-red-500' : percentage > 80 ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-600'}`}>
        {logged}h / {estimated}h
      </span>
    </div>
  );
};

// ==================== Dashboard Stats Card ====================
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  color: string;
  onClick?: () => void;
}> = ({ title, value, icon, trend, color, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer ${
      onClick ? 'hover:border-amber-200' : ''
    }`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
            <span>{Math.abs(trend)}% from last week</span>
          </div>
        )}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

// ==================== Task Detail Modal ====================
const TaskDetailModal: React.FC<{
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, updates: UpdateTaskPayload) => void;
  onLogTime: (taskId: string, hours: number, description: string) => void;
  onCompleteStage: (taskId: string, stageId: string) => void;
  currentUser: CurrentUser;
}> = ({ task, isOpen, onClose, onUpdate, onLogTime, onCompleteStage, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'stages' | 'time'>('details');
  const [logHours, setLogHours] = useState<string>('');
  const [logDescription, setLogDescription] = useState<string>('');
  
  if (!isOpen || !task) return null;
  
  const canEdit = currentUser.permissions.canEditTask;
  const daysRemaining = getDaysRemaining(task.dueDate);
  
  const handleLogTime = () => {
    if (logHours && parseFloat(logHours) > 0) {
      onLogTime(task.id, parseFloat(logHours), logDescription);
      setLogHours('');
      setLogDescription('');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-amber-100 text-sm font-mono">{task.taskCode}</span>
              <h2 className="text-xl font-bold mt-1">{task.title}</h2>
              <div className="flex items-center gap-3 mt-2 text-amber-100 text-sm">
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {task.assignee.name}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 size={14} />
                  {task.teamName}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { key: 'details', label: 'Details', icon: <FolderKanban size={16} /> },
              { key: 'stages', label: 'Stages', icon: <Layers size={16} /> },
              { key: 'time', label: 'Time Log', icon: <Timer size={16} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'text-amber-600 border-b-2 border-amber-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                  <StatusBadge status={task.status} />
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Priority</p>
                  <PriorityBadge priority={task.priority} />
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Category</p>
                  <CategoryBadge category={task.category} />
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Stage</p>
                  <span className="text-sm font-medium text-gray-900">{task.currentStageName}</span>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
                <p className="text-gray-700">{task.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Timeline</p>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Start Date</span>
                      <span className="font-medium">{formatDate(task.startDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Due Date</span>
                      <span className={`font-medium ${task.isOverdue ? 'text-red-600' : ''}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Days Remaining</span>
                      <span className={`font-medium ${daysRemaining < 0 ? 'text-red-600' : daysRemaining < 3 ? 'text-amber-600' : 'text-green-600'}`}>
                        {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Hours</p>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <HoursProgress logged={task.loggedHours} estimated={task.estimatedHours} />
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estimated</span>
                        <span className="font-medium">{task.estimatedHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Logged</span>
                        <span className="font-medium">{task.loggedHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Remaining</span>
                        <span className="font-medium">
                          {Math.max(0, task.estimatedHours - task.loggedHours)}h
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {task.projectName && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Project</p>
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <FolderKanban size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{task.projectName}</p>
                      {task.clientName && (
                        <p className="text-sm text-gray-500">{task.clientName}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'stages' && (
            <div className="space-y-4">
              {task.stages.map((stage, index) => {
                const isNext = !stage.isCompleted && index === task.currentStage - 1;
                return (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      stage.isCompleted
                        ? 'bg-green-50 border-green-200'
                        : isNext
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        stage.isCompleted
                          ? 'bg-green-500 text-white'
                          : isNext
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {stage.isCompleted ? <Check size={20} /> : stage.order}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{stage.name}</p>
                      {stage.isCompleted && stage.completedBy && (
                        <p className="text-sm text-gray-500">
                          Completed by {stage.completedBy} on {formatDateShort(stage.completedAt!)}
                        </p>
                      )}
                    </div>
                    {canEdit && isNext && (
                      <button
                        onClick={() => onCompleteStage(task.id, stage.id)}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle2 size={16} />
                        Complete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {activeTab === 'time' && (
            <div className="space-y-6">
              {/* Log Time Form */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-900 mb-3">Log Time</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Description</label>
                    <input
                      type="text"
                      value={logDescription}
                      onChange={(e) => setLogDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="What did you work on?"
                    />
                  </div>
                </div>
                <button
                  onClick={handleLogTime}
                  disabled={!logHours || parseFloat(logHours) <= 0}
                  className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Time Entry
                </button>
              </div>
              
              {/* Time Entries List */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Time Entries</h4>
                {task.timeEntries.length > 0 ? (
                  <div className="space-y-2">
                    {task.timeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                          <Timer size={16} className="text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{entry.hours}h - {entry.description || 'No description'}</p>
                          <p className="text-sm text-gray-500">{entry.userName} • {formatDate(entry.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Timer size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No time entries yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== Create Task Modal ====================
const CreateTaskModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateTaskPayload) => void;
  teams: Team[];
  members: TeamMember[];
}> = ({ isOpen, onClose, onCreate, teams, members }) => {
  const [formData, setFormData] = useState<CreateTaskPayload>({
    title: '',
    description: '',
    category: 'formulation',
    priority: 'medium',
    assigneeId: '',
    teamId: '',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedHours: 8,
  });
  
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<TeamMember[]>([]);
  
  useEffect(() => {
    if (formData.teamId) {
      const team = teams.find(t => t.id === formData.teamId);
      if (team) {
        setSelectedTeamMembers(members.filter(m => 
          team.members.some(tm => tm.id === m.id)
        ));
      }
    } else {
      setSelectedTeamMembers(members);
    }
  }, [formData.teamId, teams, members]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.assigneeId) {
      onCreate(formData);
      onClose();
      setFormData({
        title: '',
        description: '',
        category: 'formulation',
        priority: 'medium',
        assigneeId: '',
        teamId: '',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimatedHours: 8,
      });
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Create New Task</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter task title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter task description"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TaskCategory })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="formulation">Formulation</option>
                <option value="testing">Testing</option>
                <option value="quality">Quality</option>
                <option value="packaging">Packaging</option>
                <option value="documentation">Documentation</option>
                <option value="production">Production</option>
                <option value="regulatory">Regulatory</option>
                <option value="sourcing">Sourcing</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={formData.teamId}
                onChange={(e) => setFormData({ ...formData, teamId: e.target.value, assigneeId: '' })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee *</label>
              <select
                required
                value={formData.assigneeId}
                onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select Assignee</option>
                {selectedTeamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Est. Hours</label>
              <input
                type="number"
                min="1"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: parseInt(e.target.value) || 8 })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== Main Task Management Component ====================
const TaskManagement: React.FC = () => {
  // Role Selector State (for demo - replace with real auth)
  const [selectedRole, setSelectedRole] = useState<UserRole>('super-admin');
  const currentUser = useMemo(() => getMockCurrentUser(selectedRole), [selectedRole]);
  
  // Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskDashboardStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;
  
  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<TaskFilters>({});
  const [sortConfig, setSortConfig] = useState<TaskSortConfig>({ field: 'startDate', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // View Mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [tasksResult, statsResult, teamsResult, membersResult] = await Promise.all([
        taskService.getTasks(
          currentUser,
          { ...filters, searchTerm: searchTerm || undefined },
          sortConfig,
          page,
          pageSize
        ),
        taskService.getTaskDashboardStats(currentUser),
        taskService.getTeams(),
        taskService.getTeamMembers(),
      ]);
      
      if (tasksResult.success && tasksResult.data) {
        setTasks(tasksResult.data.data);
        setTotalPages(tasksResult.data.pagination.totalPages);
        setTotalItems(tasksResult.data.pagination.total);
      }
      
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
      
      if (teamsResult.success && teamsResult.data) {
        setTeams(teamsResult.data);
      }
      
      if (membersResult.success && membersResult.data) {
        setMembers(membersResult.data);
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [currentUser, filters, searchTerm, sortConfig, page]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Handlers
  const handleCreateTask = async (payload: CreateTaskPayload) => {
    const result = await taskService.createTask(payload, currentUser);
    if (result.success) {
      fetchData();
    }
  };
  
  const handleUpdateTask = async (taskId: string, updates: UpdateTaskPayload) => {
    const result = await taskService.updateTask(taskId, updates, currentUser);
    if (result.success && result.data) {
      setTasks(prev => prev.map(t => t.id === taskId ? result.data! : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(result.data);
      }
    }
  };
  
  const handleLogTime = async (taskId: string, hours: number, description: string) => {
    const result = await taskService.logTime(
      { taskId, hours, date: new Date().toISOString(), description },
      currentUser
    );
    if (result.success && result.data) {
      setTasks(prev => prev.map(t => t.id === taskId ? result.data! : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(result.data);
      }
    }
  };
  
  const handleCompleteStage = async (taskId: string, stageId: string) => {
    const result = await taskService.completeStage({ taskId, stageId }, currentUser);
    if (result.success && result.data) {
      setTasks(prev => prev.map(t => t.id === taskId ? result.data! : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(result.data);
      }
      fetchData(); // Refresh stats
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    const result = await taskService.deleteTask(taskId, currentUser);
    if (result.success) {
      fetchData();
    }
  };
  
  const handleSort = (field: TaskSortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  
  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPage(1);
  };
  
  const hasActiveFilters = Object.keys(filters).some(
    key => filters[key as keyof TaskFilters] !== undefined
  ) || searchTerm;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-white">
                <FolderKanban size={24} />
              </div>
              Task Management
            </h1>
            <p className="text-gray-500 mt-1">
              {currentUser.role === 'super-admin' || currentUser.role === 'admin'
                ? 'Manage and track all tasks across teams'
                : currentUser.role === 'manager' || currentUser.role === 'team-lead'
                ? `Tasks from your team (${currentUser.department})`
                : 'Your assigned tasks'}
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Role Selector (Demo Only) */}
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2">
              <span className="text-xs text-gray-500">Role:</span>
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value as UserRole);
                  setPage(1);
                }}
                className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
              >
                <option value="super-admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="team-lead">Team Lead</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            
            <button
              onClick={fetchData}
              className="p-2.5 text-gray-600 hover:text-amber-600 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-amber-200 transition-colors"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            
            {currentUser.permissions.canExportTasks && (
              <button className="p-2.5 text-gray-600 hover:text-amber-600 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-amber-200 transition-colors">
                <Download size={18} />
              </button>
            )}
            
            {currentUser.permissions.canCreateTask && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all"
              >
                <Plus size={18} />
                New Task
              </button>
            )}
          </div>
        </div>
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              title="Total Tasks"
              value={stats.totalTasks}
              icon={<Layers size={24} className="text-white" />}
              color="bg-gradient-to-br from-slate-600 to-slate-700"
              onClick={() => clearFilters()}
            />
            <StatCard
              title="In Progress"
              value={stats.inProgressTasks}
              icon={<PlayCircle size={24} className="text-white" />}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
              onClick={() => setFilters({ status: ['in-progress'] })}
            />
            <StatCard
              title="Pending"
              value={stats.pendingTasks}
              icon={<Clock size={24} className="text-white" />}
              color="bg-gradient-to-br from-amber-500 to-amber-600"
              onClick={() => setFilters({ status: ['pending'] })}
            />
            <StatCard
              title="Completed"
              value={stats.completedTasks}
              icon={<CheckCircle2 size={24} className="text-white" />}
              color="bg-gradient-to-br from-green-500 to-green-600"
              onClick={() => setFilters({ status: ['completed'] })}
            />
            <StatCard
              title="Overdue"
              value={stats.overdueTasks}
              icon={<AlertTriangle size={24} className="text-white" />}
              color="bg-gradient-to-br from-red-500 to-red-600"
              onClick={() => setFilters({ isOverdue: true })}
            />
            <StatCard
              title="Hours Logged"
              value={`${stats.hoursStats.totalLogged}h`}
              icon={<Timer size={24} className="text-white" />}
              color="bg-gradient-to-br from-violet-500 to-violet-600"
            />
          </div>
        )}
        
        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tasks by title, code, assignee, or project..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter Toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter size={16} />
                Filters
                {hasActiveFilters && (
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-xs flex items-center justify-center">
                    !
                  </span>
                )}
              </button>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  <ListFilter size={16} />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  <BarChart2 size={16} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={filters.status?.[0] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    status: e.target.value ? [e.target.value as TaskStatus] : undefined,
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <select
                  value={filters.priority?.[0] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    priority: e.target.value ? [e.target.value as TaskPriority] : undefined,
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={filters.category?.[0] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    category: e.target.value ? [e.target.value as TaskCategory] : undefined,
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All Categories</option>
                  <option value="formulation">Formulation</option>
                  <option value="testing">Testing</option>
                  <option value="quality">Quality</option>
                  <option value="packaging">Packaging</option>
                  <option value="production">Production</option>
                  <option value="regulatory">Regulatory</option>
                  <option value="sourcing">Sourcing</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Team</label>
                <select
                  value={filters.teamId || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    teamId: e.target.value || undefined,
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        
        {/* Task Table */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-amber-50 to-orange-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Assignee
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('currentStage')}
                        className="flex items-center gap-1 hover:text-amber-600"
                      >
                        Stages
                        {sortConfig.field === 'currentStage' && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Current Stage
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('startDate')}
                        className="flex items-center gap-1 hover:text-amber-600"
                      >
                        Start Date
                        {sortConfig.field === 'startDate' && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('loggedHours')}
                        className="flex items-center gap-1 hover:text-amber-600"
                      >
                        Hours
                        {sortConfig.field === 'loggedHours' && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </button>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <RefreshCw size={20} className="animate-spin" />
                          Loading tasks...
                        </div>
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="text-gray-500">
                          <FolderKanban size={40} className="mx-auto mb-2 opacity-50" />
                          <p>No tasks found</p>
                          {hasActiveFilters && (
                            <button
                              onClick={clearFilters}
                              className="mt-2 text-amber-600 hover:underline"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr
                        key={task.id}
                        className={`hover:bg-amber-50/50 transition-colors ${
                          task.isBlocked ? 'bg-orange-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-1 h-12 rounded-full ${
                                task.priority === 'urgent' ? 'bg-red-500' :
                                task.priority === 'high' ? 'bg-orange-500' :
                                task.priority === 'medium' ? 'bg-blue-500' :
                                'bg-gray-300'
                              }`}
                            />
                            <div>
                              <p className="font-medium text-gray-900 line-clamp-1">{task.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-gray-500">{task.taskCode}</span>
                                <CategoryBadge category={task.category} />
                                {task.isBlocked && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                    <AlertTriangle size={10} />
                                    Blocked
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {task.assignee.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{task.assignee.name}</p>
                              <p className="text-xs text-gray-500">{task.teamName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StageProgress stages={task.stages} currentStage={task.currentStage} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                            <Target size={12} />
                            Stage {task.currentStage}: {task.currentStageName.split(' ')[0]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">{formatDate(task.startDate)}</p>
                            <p className={`text-xs ${task.isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                              Due: {formatDateShort(task.dueDate)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <HoursProgress logged={task.loggedHours} estimated={task.estimatedHours} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowDetailModal(true);
                              }}
                              className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            {currentUser.permissions.canEditTask && (
                              <button
                                onClick={() => {
                                  setSelectedTask(task);
                                  setShowDetailModal(true);
                                }}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit3 size={16} />
                              </button>
                            )}
                            {currentUser.permissions.canDeleteTask && (
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalItems)} of {totalItems} tasks
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-amber-500 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Card View */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <RefreshCw size={20} className="animate-spin text-gray-500" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                No tasks found
              </div>
            ) : (
              tasks.map(task => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all overflow-hidden cursor-pointer"
                  onClick={() => {
                    setSelectedTask(task);
                    setShowDetailModal(true);
                  }}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 line-clamp-2">{task.title}</p>
                        <p className="text-xs font-mono text-gray-500 mt-1">{task.taskCode}</p>
                      </div>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {task.assignee.name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-600">{task.assignee.name}</span>
                    </div>
                    
                    <StageProgress stages={task.stages} currentStage={task.currentStage} />
                    
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <StatusBadge status={task.status} />
                      <span className="text-xs text-gray-500">
                        {task.loggedHours}h / {task.estimatedHours}h
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Modals */}
        <TaskDetailModal
          task={selectedTask}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTask(null);
          }}
          onUpdate={handleUpdateTask}
          onLogTime={handleLogTime}
          onCompleteStage={handleCompleteStage}
          currentUser={currentUser}
        />
        
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTask}
          teams={teams}
          members={members}
        />
      </div>
    </div>
  );
};

export default TaskManagement;
