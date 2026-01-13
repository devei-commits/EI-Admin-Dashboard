import { useEffect } from 'react';

export function useScrollToTop(trigger?: any) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [trigger]);
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
