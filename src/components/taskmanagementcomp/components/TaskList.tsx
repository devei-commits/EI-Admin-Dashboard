import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Pause,
  XCircle,
  Eye,
  Edit3,
  Trash2,
  MoreVertical,
  ChevronDown,
  Calendar,
  User,
  Tag,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface TaskListProps {
  currentRole: string;
  currentUser: { id?: string; name?: string } | null;
  filter: 'my' | 'team' | 'all';
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assignee: string;
  assigneeId: string;
  dueDate: string;
  createdAt: string;
  estimatedHours: number;
  loggedHours: number;
}

// Mock task data
const MOCK_TASKS: Task[] = [
  { id: 1, title: 'Review Formulation Report', description: 'Complete review of Q4 formulation reports', status: 'in-progress', priority: 'high', assignee: 'Anjali Verma', assigneeId: 'user-1', dueDate: '2026-01-27', createdAt: '2026-01-20', category: 'formulation', estimatedHours: 8, loggedHours: 4 },
  { id: 2, title: 'Quality Testing - Batch #4521', description: 'Run quality tests on batch 4521', status: 'pending', priority: 'urgent', assignee: 'Rahul Mehta', assigneeId: 'user-2', dueDate: '2026-01-25', createdAt: '2026-01-18', category: 'testing', estimatedHours: 12, loggedHours: 0 },
  { id: 3, title: 'Update Packaging Documentation', description: 'Update packaging specs for new products', status: 'completed', priority: 'medium', assignee: 'Krishna D', assigneeId: 'user-3', dueDate: '2026-01-24', createdAt: '2026-01-15', category: 'packaging', estimatedHours: 6, loggedHours: 6 },
  { id: 4, title: 'Client Meeting - Zenskinn', description: 'Prepare materials for Zenskinn client meeting', status: 'in-progress', priority: 'high', assignee: 'Priya Sharma', assigneeId: 'user-4', dueDate: '2026-01-26', createdAt: '2026-01-19', category: 'documentation', estimatedHours: 4, loggedHours: 2 },
  { id: 5, title: 'Raw Material Sourcing', description: 'Find alternative suppliers for raw materials', status: 'on-hold', priority: 'medium', assignee: 'Nikhil Barange', assigneeId: 'user-5', dueDate: '2026-01-28', createdAt: '2026-01-16', category: 'sourcing', estimatedHours: 10, loggedHours: 3 },
  { id: 6, title: 'Production Schedule Update', description: 'Update production schedule for February', status: 'pending', priority: 'low', assignee: 'Bindu Sree', assigneeId: 'user-6', dueDate: '2026-01-30', createdAt: '2026-01-21', category: 'production', estimatedHours: 5, loggedHours: 0 },
  { id: 7, title: 'Regulatory Compliance Check', description: 'Ensure all products meet regulatory standards', status: 'in-progress', priority: 'urgent', assignee: 'Anjali Verma', assigneeId: 'user-1', dueDate: '2026-01-25', createdAt: '2026-01-17', category: 'regulatory', estimatedHours: 16, loggedHours: 8 },
  { id: 8, title: 'Sample Preparation - MEDMANOR', description: 'Prepare samples for MEDMANOR presentation', status: 'completed', priority: 'high', assignee: 'Rahul Mehta', assigneeId: 'user-2', dueDate: '2026-01-23', createdAt: '2026-01-14', category: 'formulation', estimatedHours: 8, loggedHours: 8 },
  { id: 9, title: 'Inventory Audit', description: 'Conduct monthly inventory audit', status: 'pending', priority: 'medium', assignee: 'Krishna D', assigneeId: 'user-3', dueDate: '2026-01-29', createdAt: '2026-01-22', category: 'production', estimatedHours: 10, loggedHours: 0 },
  { id: 10, title: 'New Product R&D', description: 'Research and develop new skincare formula', status: 'in-progress', priority: 'high', assignee: 'Priya Sharma', assigneeId: 'user-4', dueDate: '2026-02-05', createdAt: '2026-01-10', category: 'formulation', estimatedHours: 40, loggedHours: 15 },
];

export function TaskList({ currentRole, currentUser, filter }: TaskListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'status'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Filter tasks based on view type and filters
  const filteredTasks = useMemo(() => {
    let tasks = [...MOCK_TASKS];

    // Apply view filter
    if (filter === 'my' && currentUser) {
      tasks = tasks.filter(t => t.assignee === currentUser.name || t.assigneeId === currentUser.id);
    }
    // team filter would filter by team members (not implemented yet)

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      tasks = tasks.filter(
        t =>
          t.title.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.assignee.toLowerCase().includes(term) ||
          t.category.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === priorityFilter);
    }

    // Apply sorting
    tasks.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'dueDate':
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return tasks;
  }, [filter, currentUser, searchTerm, statusFilter, priorityFilter, sortBy, sortOrder]);

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      'pending': <Clock className="w-4 h-4" />,
      'in-progress': <PlayCircle className="w-4 h-4" />,
      'completed': <CheckCircle2 className="w-4 h-4" />,
      'on-hold': <Pause className="w-4 h-4" />,
      'cancelled': <XCircle className="w-4 h-4" />,
    };
    return icons[status] || <Clock className="w-4 h-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700 border-amber-200',
      'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
      'completed': 'bg-green-100 text-green-700 border-green-200',
      'on-hold': 'bg-orange-100 text-orange-700 border-orange-200',
      'cancelled': 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-slate-100 text-slate-600',
      'medium': 'bg-blue-100 text-blue-600',
      'high': 'bg-orange-100 text-orange-600',
      'urgent': 'bg-red-100 text-red-600',
    };
    return colors[priority] || 'bg-gray-100 text-gray-600';
  };

  const getTitle = () => {
    switch (filter) {
      case 'my':
        return 'My Tasks';
      case 'team':
        return 'Team Tasks';
      case 'all':
        return 'All Tasks';
      default:
        return 'Tasks';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{getTitle()}</h1>
            <p className="text-amber-100 mt-1">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <button className="px-4 py-2 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilters ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-amber-200 text-gray-600 hover:bg-amber-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'status')}
              className="px-3 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-amber-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.map((task) => {
          const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          const isOverdue = daysLeft < 0 && task.status !== 'completed';
          const progress = task.estimatedHours > 0 ? Math.round((task.loggedHours / task.estimatedHours) * 100) : 0;

          return (
            <div
              key={task.id}
              className={`bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-shadow ${
                isOverdue ? 'border-red-200' : 'border-amber-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(task.status)}`}>
                      {getStatusIcon(task.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate">{task.title}</h3>
                      <p className="text-sm text-gray-500 truncate mt-1">{task.description}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {task.assignee}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {task.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Badges and Actions */}
                <div className="flex items-center gap-3 md:flex-shrink-0">
                  {/* Priority Badge */}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>

                  {/* Status Badge */}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                    {task.status.replace('-', ' ')}
                  </span>

                  {/* Overdue/Days Left */}
                  {task.status !== 'completed' && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isOverdue ? 'bg-red-100 text-red-700' : daysLeft <= 2 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {isOverdue ? 'Overdue' : `${daysLeft}d`}
                    </span>
                  )}

                  {/* Progress */}
                  <div className="hidden md:flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{progress}%</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTaskModal(true);
                      }}
                      className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-amber-100 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No tasks found</h3>
            <p className="text-gray-500">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Task Details</h2>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{selectedTask.title}</h3>
                <p className="text-gray-600 mt-2">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium mt-1 ${getStatusColor(selectedTask.status)}`}>
                    {getStatusIcon(selectedTask.status)}
                    {selectedTask.status.replace('-', ' ')}
                  </span>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Priority</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium mt-1 ${getPriorityColor(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Assignee</p>
                  <p className="font-medium text-gray-800 mt-1">{selectedTask.assignee}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium text-gray-800 mt-1">
                    {new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-800 mt-1 capitalize">{selectedTask.category}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Hours</p>
                  <p className="font-medium text-gray-800 mt-1">{selectedTask.loggedHours} / {selectedTask.estimatedHours}h</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">Progress</p>
                  <p className="text-sm font-medium text-gray-800">
                    {Math.round((selectedTask.loggedHours / selectedTask.estimatedHours) * 100)}%
                  </p>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                    style={{ width: `${Math.min((selectedTask.loggedHours / selectedTask.estimatedHours) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-amber-100 flex justify-end gap-3">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 border border-amber-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors">
                Edit Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
