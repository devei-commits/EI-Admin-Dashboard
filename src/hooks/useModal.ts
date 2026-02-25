import { useState, useCallback } from 'react';

/**
 * Modal state and handlers
 */
export interface UseModalReturn<T = unknown> {
 /** Whether the modal is open */
 isOpen: boolean;
 /** Data associated with the modal (e.g., item being edited) */
 data: T | null;
 /** Open the modal */
 open: (data?: T) => void;
 /** Close the modal */
 close: () => void;
 /** Toggle the modal */
 toggle: () => void;
 /** Open with specific data */
 openWith: (data: T) => void;
}

/**
 * useModal Hook
 * Manages modal open/close state and associated data.
 * 
 * @template T The type of data associated with the modal
 * @param initialOpen Whether the modal starts open
 * @returns Modal state and handlers
 * 
 * @example
 * const editModal = useModal<User>();
 * 
 * return (
 *  <>
 *   <button onClick={() => editModal.openWith(user)}>Edit</button>
 *   {editModal.isOpen && (
 *    <Modal onClose={editModal.close}>
 *     <EditUserForm user={editModal.data} />
 *    </Modal>
 *   )}
 *  </>
 * );
 */
export function useModal<T = unknown>(initialOpen = false): UseModalReturn<T> {
 const [isOpen, setIsOpen] = useState(initialOpen);
 const [data, setData] = useState<T | null>(null);

 const open = useCallback((newData?: T) => {
  if (newData !== undefined) {
   setData(newData);
  }
  setIsOpen(true);
 }, []);

 const close = useCallback(() => {
  setIsOpen(false);
  // Clear data after a short delay to allow for exit animations
  setTimeout(() => setData(null), 150);
 }, []);

 const toggle = useCallback(() => {
  setIsOpen(prev => !prev);
 }, []);

 const openWith = useCallback((newData: T) => {
  setData(newData);
  setIsOpen(true);
 }, []);

 return {
  isOpen,
  data,
  open,
  close,
  toggle,
  openWith,
 };
}

/**
 * Confirmation dialog state and handlers
 */
export interface UseConfirmReturn {
 /** Whether the confirm dialog is open */
 isOpen: boolean;
 /** The message to display */
 message: string;
 /** Title for the dialog */
 title: string;
 /** Show the confirm dialog */
 confirm: (options: { title?: string; message: string }) => Promise<boolean>;
 /** Handle confirm action */
 onConfirm: () => void;
 /** Handle cancel action */
 onCancel: () => void;
}

/**
 * useConfirm Hook
 * Manages confirmation dialog state with promise-based API.
 * 
 * @returns Confirmation dialog state and handlers
 * 
 * @example
 * const { isOpen, message, confirm, onConfirm, onCancel } = useConfirm();
 * 
 * const handleDelete = async () => {
 *  const confirmed = await confirm({ 
 *   title: 'Delete Item',
 *   message: 'Are you sure you want to delete this item?' 
 *  });
 *  if (confirmed) {
 *   deleteItem(itemId);
 *  }
 * };
 */
export function useConfirm(): UseConfirmReturn {
 const [isOpen, setIsOpen] = useState(false);
 const [message, setMessage] = useState('');
 const [title, setTitle] = useState('Confirm');
 const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

 const confirm = useCallback(
  (options: { title?: string; message: string }): Promise<boolean> => {
   setTitle(options.title || 'Confirm');
   setMessage(options.message);
   setIsOpen(true);

   return new Promise<boolean>(resolve => {
    setResolveRef(() => resolve);
   });
  },
  []
 );

 const onConfirm = useCallback(() => {
  setIsOpen(false);
  resolveRef?.(true);
  setResolveRef(null);
 }, [resolveRef]);

 const onCancel = useCallback(() => {
  setIsOpen(false);
  resolveRef?.(false);
  setResolveRef(null);
 }, [resolveRef]);

 return {
  isOpen,
  message,
  title,
  confirm,
  onConfirm,
  onCancel,
 };
}

export default useModal;
