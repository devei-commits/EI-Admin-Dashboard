import { useCallback, useEffect } from 'react';

// Analytics event types
type EventName = 
 | 'page_view'
 | 'button_click'
 | 'form_submit'
 | 'error'
 | 'search'
 | 'filter_change'
 | 'export_data'
 | 'order_status_change'
 | 'user_action';

interface AnalyticsEvent {
 event: EventName;
 properties?: Record<string, unknown>;
 timestamp: string;
 userId?: string;
 sessionId: string;
 page: string;
}

// Simple in-memory analytics store (replace with real analytics service)
const analyticsQueue: AnalyticsEvent[] = [];
let sessionId = '';

// Generate session ID
const getSessionId = () => {
 if (!sessionId) {
  sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
 }
 return sessionId;
};

// Send analytics to server (placeholder - replace with real implementation)
const sendAnalytics = async (_events: AnalyticsEvent[]) => {
 // In production, send to your analytics endpoint
 // console.log('[Analytics]', events);
 
 // Example: Send to your backend
 // await fetch('/api/analytics', {
 //  method: 'POST',
 //  headers: { 'Content-Type': 'application/json' },
 //  body: JSON.stringify(events),
 // });
};

// Flush analytics queue periodically
const flushQueue = () => {
 if (analyticsQueue.length > 0) {
  const events = [...analyticsQueue];
  analyticsQueue.length = 0;
  sendAnalytics(events);
 }
};

// Flush every 30 seconds
setInterval(flushQueue, 30000);

// Flush on page unload
if (typeof window !== 'undefined') {
 window.addEventListener('beforeunload', flushQueue);
}

export const useAnalytics = () => {
 const track = useCallback((event: EventName, properties?: Record<string, unknown>) => {
  const analyticsEvent: AnalyticsEvent = {
   event,
   properties,
   timestamp: new Date().toISOString(),
   sessionId: getSessionId(),
   page: typeof window !== 'undefined' ? window.location.pathname : '',
  };
  
  analyticsQueue.push(analyticsEvent);
  
  // Flush immediately for important events
  if (event === 'error' || event === 'form_submit') {
   flushQueue();
  }
 }, []);

 const trackPageView = useCallback((page: string) => {
  track('page_view', { page });
 }, [track]);

 const trackClick = useCallback((element: string, metadata?: Record<string, unknown>) => {
  track('button_click', { element, ...metadata });
 }, [track]);

 const trackSearch = useCallback((query: string, resultsCount: number) => {
  track('search', { query, resultsCount });
 }, [track]);

 const trackError = useCallback((error: Error, context?: Record<string, unknown>) => {
  track('error', { 
   message: error.message, 
   stack: error.stack,
   ...context 
  });
 }, [track]);

 return {
  track,
  trackPageView,
  trackClick,
  trackSearch,
  trackError,
 };
};

// Hook for automatic page view tracking
export const usePageTracking = () => {
 const { trackPageView } = useAnalytics();

 useEffect(() => {
  trackPageView(window.location.pathname);
 }, [trackPageView]);
};

export default useAnalytics;
