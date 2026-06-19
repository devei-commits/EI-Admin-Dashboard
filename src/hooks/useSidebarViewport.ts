import { useEffect, useState } from 'react';

/** Tailwind defaults: md = 768px, lg = 1024px */
const MD_MIN = 768;
const LG_MIN = 1024;

export type SidebarViewportMode = 'mobile' | 'medium' | 'large';

function getViewportMode(width: number): SidebarViewportMode {
  if (width < MD_MIN) return 'mobile';
  if (width < LG_MIN) return 'medium';
  return 'large';
}

/** Responsive sidebar mode: mobile drawer, medium icon rail, large full sidebar. */
export function useSidebarViewport(): SidebarViewportMode {
  const [mode, setMode] = useState<SidebarViewportMode>(() =>
    typeof window !== 'undefined' ? getViewportMode(window.innerWidth) : 'large'
  );

  useEffect(() => {
    const onResize = () => setMode(getViewportMode(window.innerWidth));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return mode;
}
