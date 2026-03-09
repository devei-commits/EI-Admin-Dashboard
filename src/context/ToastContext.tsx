import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const TOAST_DURATION_MS = 2000;

interface Toast {
 id: string;
 type: 'success' | 'error' | 'warning' | 'info';
 message: string;
}

interface ToastContextType {
 toasts: Toast[];
 addToast: (type: Toast['type'], message: string) => void;
 removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [toasts, setToasts] = useState<Toast[]>([]);
 const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setToasts((prev) => [...prev, { id, type, message }]);

  const timeoutId = setTimeout(() => {
   setToasts((prev) => prev.filter((t) => t.id !== id));
   timeoutsRef.current = timeoutsRef.current.filter((t) => t !== timeoutId);
  }, TOAST_DURATION_MS);
  timeoutsRef.current.push(timeoutId);
 }, []);

 useEffect(() => {
  return () => {
   timeoutsRef.current.forEach(clearTimeout);
   timeoutsRef.current = [];
  };
 }, []);

 const removeToast = useCallback((id: string) => {
  setToasts((prev) => prev.filter((t) => t.id !== id));
 }, []);

 return (
  <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
   {children}
   {/* Toast Container */}
   <div className="fixed top-4 right-4 z-100 flex flex-col gap-2">
    {toasts.map((toast) => (
     <div
      key={toast.id}
      className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-75 animate-slide-in ${
       toast.type === 'success' ? 'bg-green-500 text-white' :
       toast.type === 'error' ? 'bg-red-500 text-white' :
       toast.type === 'warning' ? 'bg-yellow-500 text-white' :
       'bg-blue-500 text-white'
      }`}
     >
      <span className="text-lg">
       {toast.type === 'success' && 'OK'}
       {toast.type === 'error' && '!'}
       {toast.type === 'warning' && '!'}
       {toast.type === 'info' && 'i'}
      </span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
       onClick={() => removeToast(toast.id)}
       className="text-white/80 hover:text-white"
      >
       X
      </button>
     </div>
    ))}
   </div>
  </ToastContext.Provider>
 );
};

export const useToast = () => {
 const context = useContext(ToastContext);
 if (!context) {
  throw new Error('useToast must be used within ToastProvider');
 }
 return context;
};
