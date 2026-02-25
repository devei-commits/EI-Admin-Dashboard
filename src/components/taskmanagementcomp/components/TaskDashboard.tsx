import { useMemo } from 'react';
import {
 ClipboardList,
 Clock,
 CheckCircle2,
 AlertTriangle,
 TrendingUp,
 ArrowRight,
 PlayCircle,
 Pause,
 Users,
 Target,
 Calendar,
 BarChart2,
} from 'lucide-react';
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
 PieChart,
 Pie,
 Cell,
 LineChart,
 Line,
} from 'recharts';

interface TaskDashboardProps {
 currentRole: string;
 currentUser: { id?: string; name?: string } | null;
 onNavigate: (view: 'dashboard' | 'my-tasks' | 'team-tasks' | 'all-tasks' | 'settings') => void;
}

// Mock task data
const MOCK_TASKS = [
 { id: 1, title: 'Review Formulation Report', status: 'in-progress', priority: 'high', assignee: 'Anjali Verma', dueDate: '2026-01-27', category: 'formulation' },
 { id: 2, title: 'Quality Testing - Batch #4521', status: 'pending', priority: 'urgent', assignee: 'Rahul Mehta', dueDate: '2026-01-25', category: 'testing' },
 { id: 3, title: 'Update Packaging Documentation', status: 'completed', priority: 'medium', assignee: 'Krishna D', dueDate: '2026-01-24', category: 'packaging' },
 { id: 4, title: 'Client Meeting - Zenskinn', status: 'in-progress', priority: 'high', assignee: 'Priya Sharma', dueDate: '2026-01-26', category: 'documentation' },
 { id: 5, title: 'Raw Material Sourcing', status: 'on-hold', priority: 'medium', assignee: 'Nikhil Barange', dueDate: '2026-01-28', category: 'sourcing' },
 { id: 6, title: 'Production Schedule Update', status: 'pending', priority: 'low', assignee: 'Bindu Sree', dueDate: '2026-01-30', category: 'production' },
 { id: 7, title: 'Regulatory Compliance Check', status: 'in-progress', priority: 'urgent', assignee: 'Anjali Verma', dueDate: '2026-01-25', category: 'regulatory' },
 { id: 8, title: 'Sample Preparation - MEDMANOR', status: 'completed', priority: 'high', assignee: 'Rahul Mehta', dueDate: '2026-01-23', category: 'formulation' },
];

export function TaskDashboard({ currentRole, currentUser, onNavigate }: TaskDashboardProps) {
 // Calculate stats
 const stats = useMemo(() => {
  const total = MOCK_TASKS.length;
  const pending = MOCK_TASKS.filter(t => t.status === 'pending').length;
  const inProgress = MOCK_TASKS.filter(t => t.status === 'in-progress').length;
  const completed = MOCK_TASKS.filter(t => t.status === 'completed').length;
  const onHold = MOCK_TASKS.filter(t => t.status === 'on-hold').length;
  const overdue = MOCK_TASKS.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'completed').length;
  
  return { total, pending, inProgress, completed, onHold, overdue };
 }, []);

 // Status data for pie chart
 const statusData = useMemo(() => [
  { name: 'Pending', value: stats.pending, color: '#F59E0B' },
  { name: 'In Progress', value: stats.inProgress, color: '#3B82F6' },
  { name: 'Completed', value: stats.completed, color: '#10B981' },
  { name: 'On Hold', value: stats.onHold, color: '#EF4444' },
 ], [stats]);

 // Category data for bar chart
 const categoryData = useMemo(() => {
  const categories: Record<string, number> = {};
  MOCK_TASKS.forEach(task => {
   categories[task.category] = (categories[task.category] || 0) + 1;
  });
  return Object.entries(categories).map(([name, count]) => ({
   category: name.charAt(0).toUpperCase() + name.slice(1),
   count,
  }));
 }, []);

 // Timeline data
 const timelineData = useMemo(() => {
  return [
   { day: 'Mon', created: 3, completed: 2 },
   { day: 'Tue', created: 5, completed: 3 },
   { day: 'Wed', created: 2, completed: 4 },
   { day: 'Thu', created: 4, completed: 2 },
   { day: 'Fri', created: 6, completed: 5 },
   { day: 'Sat', created: 1, completed: 1 },
   { day: 'Sun', created: 0, completed: 0 },
  ];
 }, []);

 // Recent tasks
 const recentTasks = MOCK_TASKS.slice(0, 5);

 // Upcoming deadlines
 const upcomingDeadlines = MOCK_TASKS
  .filter(t => t.status !== 'completed')
  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  .slice(0, 4);

 const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
   'pending': 'bg-gray-100 text-slate-900',
   'in-progress': 'bg-blue-100 text-blue-700',
   'completed': 'bg-green-100 text-green-700',
   'on-hold': 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
 };

 return (
  <div className="space-y-6">
   {/* Welcome Header */}
   <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg">
    <div className="flex items-center justify-between">
     <div>
      <h1 className="text-2xl font-bold">Welcome back, {currentUser?.name || 'User'}!</h1>
      <p className="text-gray-100 mt-1">Here's your task overview for today</p>
     </div>
     <div className="hidden md:flex items-center gap-4">
      <div className="text-right">
       <p className="text-3xl font-bold">{stats.total}</p>
       <p className="text-gray-100 text-sm">Total Tasks</p>
      </div>
      <Target className="w-12 h-12 text-gray-200" />
     </div>
    </div>
   </div>

   {/* Stats Grid */}
   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
       <Clock className="w-5 h-5 text-slate-800" />
      </div>
      <div>
       <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
       <p className="text-xs text-gray-500">Pending</p>
      </div>
     </div>
    </div>

    <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-100 rounded-lg">
       <PlayCircle className="w-5 h-5 text-blue-600" />
      </div>
      <div>
       <p className="text-2xl font-bold text-gray-800">{stats.inProgress}</p>
       <p className="text-xs text-gray-500">In Progress</p>
      </div>
     </div>
    </div>

    <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100 hover:shadow-md transition-shadow">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-green-100 rounded-lg">
       <CheckCircle2 className="w-5 h-5 text-green-600" />
      </div>
      <div>
       <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
       <p className="text-xs text-gray-500">Completed</p>
      </div>
     </div>
    </div>

    <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-orange-100 rounded-lg">
       <Pause className="w-5 h-5 text-slate-800" />
      </div>
      <div>
       <p className="text-2xl font-bold text-gray-800">{stats.onHold}</p>
       <p className="text-xs text-gray-500">On Hold</p>
      </div>
     </div>
    </div>

    <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100 hover:shadow-md transition-shadow">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-red-100 rounded-lg">
       <AlertTriangle className="w-5 h-5 text-red-600" />
      </div>
      <div>
       <p className="text-2xl font-bold text-gray-800">{stats.overdue}</p>
       <p className="text-xs text-gray-500">Overdue</p>
      </div>
     </div>
    </div>

    <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100 hover:shadow-md transition-shadow">
     <div className="flex items-center gap-3">
      <div className="p-2 bg-purple-100 rounded-lg">
       <TrendingUp className="w-5 h-5 text-purple-600" />
      </div>
      <div>
       <p className="text-2xl font-bold text-gray-800">{Math.round((stats.completed / stats.total) * 100)}%</p>
       <p className="text-xs text-gray-500">Completion</p>
      </div>
     </div>
    </div>
   </div>

   {/* Charts Row */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Status Pie Chart */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
     <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-800">Task Status Overview</h3>
      <BarChart2 className="w-5 h-5 text-slate-700" />
     </div>
     <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
       <PieChart>
        <Pie
         data={statusData}
         cx="50%"
         cy="50%"
         innerRadius={60}
         outerRadius={90}
         paddingAngle={2}
         dataKey="value"
        >
         {statusData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
         ))}
        </Pie>
        <Tooltip />
       </PieChart>
      </ResponsiveContainer>
     </div>
     <div className="flex flex-wrap justify-center gap-4 mt-4">
      {statusData.map((item, index) => (
       <div key={index} className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
       </div>
      ))}
     </div>
    </div>

    {/* Category Bar Chart */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
     <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-800">Tasks by Category</h3>
      <ClipboardList className="w-5 h-5 text-slate-700" />
     </div>
     <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
       <BarChart data={categoryData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
       </BarChart>
      </ResponsiveContainer>
     </div>
    </div>
   </div>

   {/* Timeline Chart */}
   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
     <h3 className="font-semibold text-gray-800">Weekly Activity</h3>
     <TrendingUp className="w-5 h-5 text-slate-700" />
    </div>
    <div className="h-64">
     <ResponsiveContainer width="100%" height="100%">
      <LineChart data={timelineData}>
       <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
       <XAxis dataKey="day" tick={{ fontSize: 12 }} />
       <YAxis tick={{ fontSize: 12 }} />
       <Tooltip />
       <Line type="monotone" dataKey="created" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} name="Created" />
       <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Completed" />
      </LineChart>
     </ResponsiveContainer>
    </div>
   </div>

   {/* Bottom Row */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Recent Tasks */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
     <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-800">Recent Tasks</h3>
      <button
       onClick={() => onNavigate('my-tasks')}
       className="text-sm text-slate-800 hover:text-slate-900 flex items-center gap-1"
      >
       View All <ArrowRight className="w-4 h-4" />
      </button>
     </div>
     <div className="space-y-3">
      {recentTasks.map((task) => (
       <div
        key={task.id}
        className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors"
       >
        <div className="flex-1 min-w-0">
         <p className="font-medium text-gray-800 truncate">{task.title}</p>
         <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
          <Users className="w-3 h-3" /> {task.assignee}
         </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
         <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
          {task.status.replace('-', ' ')}
         </span>
        </div>
       </div>
      ))}
     </div>
    </div>

    {/* Upcoming Deadlines */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
     <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-800">Upcoming Deadlines</h3>
      <Calendar className="w-5 h-5 text-slate-700" />
     </div>
     <div className="space-y-3">
      {upcomingDeadlines.map((task) => {
       const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
       const isOverdue = daysLeft < 0;
       const isUrgent = daysLeft <= 2 && daysLeft >= 0;

       return (
        <div
         key={task.id}
         className={`p-3 rounded-lg border ${
          isOverdue
           ? 'bg-red-50 border-red-200'
           : isUrgent
           ? 'bg-orange-50 border-orange-200'
           : 'bg-gray-50/50 border-gray-200'
         }`}
        >
         <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
           <p className="font-medium text-gray-800 truncate">{task.title}</p>
           <p className="text-xs text-gray-500 mt-1">
            Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
           </p>
          </div>
          <div className="ml-4">
           <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
             isOverdue
              ? 'bg-red-100 text-red-700'
              : isUrgent
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-slate-900'
            }`}
           >
            {isOverdue ? 'Overdue' : `${daysLeft}d left`}
           </span>
          </div>
         </div>
        </div>
       );
      })}
     </div>
    </div>
   </div>
  </div>
 );
}
