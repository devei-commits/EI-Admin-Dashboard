import { useEffect, useCallback, RefObject } from 'react';

/**
 * useOutsideClick Hook
 * Detects clicks outside of specified elements and triggers a callback.
 * Useful for closing dropdowns, modals, or popups when clicking outside.
 * 
 * @param isActive Whether the outside click detection is active
 * @param onOutsideClick Callback function to execute when clicking outside
 * @param excludeRefs Optional array of refs to exclude from outside click detection
 * 
 * @example
 * const dropdownRef = useRef<HTMLDivElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 * 
 * useOutsideClick(isOpen, () => setIsOpen(false), [dropdownRef]);
 * 
 * return (
 *  <div ref={dropdownRef}>
 *   {isOpen && <Dropdown />}
 *  </div>
 * );
 */
export function useOutsideClick(
 isActive: boolean,
 onOutsideClick: () => void,
 excludeRefs?: RefObject<HTMLElement | null>[]
): void {
 const handleClick = useCallback(
  (event: MouseEvent) => {
   // Check if click is inside any of the excluded refs
   if (excludeRefs?.length) {
    const isInsideExcluded = excludeRefs.some(
     (ref) => ref.current && ref.current.contains(event.target as Node)
    );
    if (isInsideExcluded) return;
   }
   
   onOutsideClick();
  },
  [onOutsideClick, excludeRefs]
 );

 useEffect(() => {
  if (!isActive) return;

  // Add listener on next tick to avoid immediate trigger
  const timeoutId = setTimeout(() => {
   document.addEventListener('click', handleClick);
  }, 0);

  return () => {
   clearTimeout(timeoutId);
   document.removeEventListener('click', handleClick);
  };
 }, [isActive, handleClick]);
}

/**
 * useClickAway Hook (Alternative API)
 * Similar to useOutsideClick but works with a single ref.
 * 
 * @param ref Reference to the element to detect clicks outside of
 * @param handler Callback function to execute when clicking outside
 * 
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * 
 * useClickAway(ref, () => {
 *  console.log('Clicked outside!');
 * });
 * 
 * return <div ref={ref}>Click outside me</div>;
 */
export function useClickAway<T extends HTMLElement = HTMLElement>(
 ref: RefObject<T | null>,
 handler: (event: MouseEvent | TouchEvent) => void
): void {
 useEffect(() => {
  const listener = (event: MouseEvent | TouchEvent) => {
   const el = ref.current;
   
   // Do nothing if clicking ref's element or descendent elements
   if (!el || el.contains(event.target as Node)) {
    return;
   }

   handler(event);
  };

  document.addEventListener('mousedown', listener);
  document.addEventListener('touchstart', listener);

  return () => {
   document.removeEventListener('mousedown', listener);
   document.removeEventListener('touchstart', listener);
  };
 }, [ref, handler]);
}

export default useOutsideClick;
