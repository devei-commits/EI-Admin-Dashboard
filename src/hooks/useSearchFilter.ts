import { useState, useMemo } from 'react';
import { useDebounce } from './useDebounce';

interface UseSearchFilterReturn<T> {
  search: string;
  setSearch: (value: string) => void;
  filtered: T[];
}

export function useSearchFilter<T extends Record<string, unknown>>(
  data: T[],
  fields: (keyof T)[]
): UseSearchFilterReturn<T> {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return data;
    const q = debouncedSearch.toLowerCase();
    return data.filter((item) =>
      fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q))
    );
  }, [data, debouncedSearch, fields]);

  return { search, setSearch, filtered };
}

export default useSearchFilter;
