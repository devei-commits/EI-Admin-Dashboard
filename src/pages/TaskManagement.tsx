/**
 * Task Management Page
 * PIS-themed task management system with dashboard and task views
 */

import React, { Suspense } from 'react';
import TaskApp from '../components/taskmanagementcomp/TaskApp';
import { TableSkeleton } from '../components/ui/Skeleton';

const LoadingFallback = () => (
 <div className="min-h-screen bg-slate-50 p-6">
  <TableSkeleton rows={8} cols={5} />
 </div>
);

const TaskManagement: React.FC = () => {
 return (
  <Suspense fallback={<LoadingFallback />}>
   <TaskApp />
  </Suspense>
 );
};

export default TaskManagement;
