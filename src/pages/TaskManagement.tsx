/**
 * Task Management Page
 * PIS-themed task management system with dashboard and task views
 */

import React, { Suspense } from 'react';
import TaskApp from '../components/taskmanagementcomp/TaskApp';

const LoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading Task Management...</p>
    </div>
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
