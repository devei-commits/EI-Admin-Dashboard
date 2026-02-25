import React, { ReactNode } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * Higher-order component wrapper for ErrorBoundary
 * Extracted to a separate file for React Fast Refresh compatibility
 */
export const withErrorBoundary = <P extends object>(
 WrappedComponent: React.ComponentType<P>,
 fallback?: ReactNode
) => {
 return function WithErrorBoundary(props: P) {
  return (
   <ErrorBoundary fallback={fallback}>
    <WrappedComponent {...props} />
   </ErrorBoundary>
  );
 };
};

export default withErrorBoundary;
