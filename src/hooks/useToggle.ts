import { useState, useCallback } from 'react';

/**
 * Toggle state and handlers
 */
export interface UseToggleReturn {
 /** Current toggle state */
 value: boolean;
 /** Set toggle to true */
 on: () => void;
 /** Set toggle to false */
 off: () => void;
 /** Toggle the state */
 toggle: () => void;
 /** Set specific value */
 set: (value: boolean) => void;
}

/**
 * useToggle Hook
 * Simple boolean toggle state management.
 * 
 * @param initialValue Initial toggle state (default: false)
 * @returns Toggle state and handlers
 * 
 * @example
 * const { value: isOpen, toggle, on, off } = useToggle(false);
 * 
 * return (
 *  <>
 *   <button onClick={toggle}>{isOpen ? 'Close' : 'Open'}</button>
 *   {isOpen && <Panel onClose={off} />}
 *  </>
 * );
 */
export function useToggle(initialValue = false): UseToggleReturn {
 const [value, setValue] = useState(initialValue);

 const on = useCallback(() => setValue(true), []);
 const off = useCallback(() => setValue(false), []);
 const toggle = useCallback(() => setValue(prev => !prev), []);
 const set = useCallback((newValue: boolean) => setValue(newValue), []);

 return { value, on, off, toggle, set };
}

/**
 * Selection state for multiple items
 */
export interface UseSelectionReturn<T> {
 /** Currently selected items */
 selected: T[];
 /** Check if an item is selected */
 isSelected: (item: T) => boolean;
 /** Select an item */
 select: (item: T) => void;
 /** Deselect an item */
 deselect: (item: T) => void;
 /** Toggle item selection */
 toggle: (item: T) => void;
 /** Select all items */
 selectAll: (items: T[]) => void;
 /** Clear all selections */
 clear: () => void;
 /** Check if all items are selected */
 isAllSelected: (items: T[]) => boolean;
 /** Check if some items are selected */
 isSomeSelected: (items: T[]) => boolean;
}

/**
 * useSelection Hook
 * Manages multi-select state for a list of items.
 * 
 * @template T The type of items being selected
 * @param getKey Function to get unique key from item (default: uses item as key)
 * @returns Selection state and handlers
 * 
 * @example
 * const selection = useSelection<Order>(order => order.id);
 * 
 * return (
 *  <>
 *   <input
 *    type="checkbox"
 *    checked={selection.isAllSelected(orders)}
 *    onChange={() => selection.isAllSelected(orders) ? selection.clear() : selection.selectAll(orders)}
 *   />
 *   {orders.map(order => (
 *    <input
 *     key={order.id}
 *     type="checkbox"
 *     checked={selection.isSelected(order)}
 *     onChange={() => selection.toggle(order)}
 *    />
 *   ))}
 *   <button disabled={selection.selected.length === 0}>
 *    Delete Selected ({selection.selected.length})
 *   </button>
 *  </>
 * );
 */
export function useSelection<T>(
 getKey: (item: T) => string | number = (item) => item as unknown as string
): UseSelectionReturn<T> {
 const [selectedMap, setSelectedMap] = useState<Map<string | number, T>>(new Map());

 const selected = Array.from(selectedMap.values());

 const isSelected = useCallback(
  (item: T) => selectedMap.has(getKey(item)),
  [selectedMap, getKey]
 );

 const select = useCallback(
  (item: T) => {
   setSelectedMap(prev => {
    const next = new Map(prev);
    next.set(getKey(item), item);
    return next;
   });
  },
  [getKey]
 );

 const deselect = useCallback(
  (item: T) => {
   setSelectedMap(prev => {
    const next = new Map(prev);
    next.delete(getKey(item));
    return next;
   });
  },
  [getKey]
 );

 const toggle = useCallback(
  (item: T) => {
   if (isSelected(item)) {
    deselect(item);
   } else {
    select(item);
   }
  },
  [isSelected, select, deselect]
 );

 const selectAll = useCallback(
  (items: T[]) => {
   setSelectedMap(new Map(items.map(item => [getKey(item), item])));
  },
  [getKey]
 );

 const clear = useCallback(() => {
  setSelectedMap(new Map());
 }, []);

 const isAllSelected = useCallback(
  (items: T[]) => items.length > 0 && items.every(item => selectedMap.has(getKey(item))),
  [selectedMap, getKey]
 );

 const isSomeSelected = useCallback(
  (items: T[]) => items.some(item => selectedMap.has(getKey(item))),
  [selectedMap, getKey]
 );

 return {
  selected,
  isSelected,
  select,
  deselect,
  toggle,
  selectAll,
  clear,
  isAllSelected,
  isSomeSelected,
 };
}

export default useToggle;
