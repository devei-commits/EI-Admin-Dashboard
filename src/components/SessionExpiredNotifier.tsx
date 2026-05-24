import { useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { SESSION_EXPIRED_EVENT } from '../lib/apiClient';

/** Shows a toast when the API client clears an expired session. */
export default function SessionExpiredNotifier() {
  const { addToast } = useToast();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      addToast('warning', detail?.message ?? 'Session expired. Please log in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, [addToast]);

  return null;
}
