import { useEffect } from 'react';

export function useDraftLoader<T>(key: string, setData: (data: Partial<T>) => void): void {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<T>;
        setData(parsed);
      }
    } catch {
      // ignore parse errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default useDraftLoader;
