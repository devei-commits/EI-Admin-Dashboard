import { useEffect } from 'react';

export function useAutoSave(key: string, data: unknown, intervalMs = 30000): void {
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [key, data, intervalMs]);
}

export default useAutoSave;
