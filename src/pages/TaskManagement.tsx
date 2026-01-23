/**
 * Task Management Page
 * Wrapper for the Task Management component with role-based access
 */

import React, { Suspense } from 'react';
import { TaskManagement as TaskManagementComponent } from '../components/taskmanagementcomp';

const LoadingFallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading Task Management...</p>
    </div>
  </div>
);

const TaskManagement: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TaskManagementComponent />
    </Suspense>
  );
};

export default TaskManagement;
