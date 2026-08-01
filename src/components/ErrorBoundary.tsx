import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
 children: ReactNode;
 fallback?: ReactNode;
 onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
 hasError: boolean;
 error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
 public state: State = {
  hasError: false,
  error: null,
 };

 public static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  this.props.onError?.(error, errorInfo);
  
  // You can send to error tracking service here
  // Example: Sentry.captureException(error);
 }

 private handleRetry = () => {
  this.setState({ hasError: false, error: null });
 };

 public render() {
  if (this.state.hasError) {
   if (this.props.fallback) {
    return this.props.fallback;
   }

   return (
    <div className="min-h-100 flex items-center justify-center p-8">
     <div className="text-center max-w-md">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-err-soft flex items-center justify-center">
       <svg className="w-8 h-8 text-err" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
       </svg>
      </div>
      <h2 className="text-xl font-bold text-ink mb-2">Something went wrong</h2>
      <p className="text-ink-2 mb-4">
       An unexpected error occurred. Please try again.
      </p>
      {this.state.error && (
       <details className="text-left mb-4 p-3 bg-surface-2 rounded-lg text-sm">
        <summary className="cursor-pointer text-ink-3 font-medium">Error details</summary>
        <pre className="mt-2 text-err overflow-auto text-xs">
         {this.state.error.message}
         {import.meta.env.DEV && this.state.error.stack && (
          <>\n\nStack trace:\n{this.state.error.stack}</>
         )}
        </pre>
       </details>
      )}
      <button
       onClick={this.handleRetry}
       className="px-6 py-2 bg-ink text-white rounded-lg hover:bg-ink transition-colors font-medium"
      >
       Try Again
      </button>
     </div>
    </div>
   );
  }

  return this.props.children;
 }
}

export default ErrorBoundary;
