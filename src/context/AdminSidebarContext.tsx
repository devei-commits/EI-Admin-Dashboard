import { createContext, useContext, type ReactNode } from 'react';

export type AdminSidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
};

const AdminSidebarContext = createContext<AdminSidebarContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  value: AdminSidebarContextValue;
};

export function AdminSidebarProvider({ children, value }: ProviderProps) {
  return <AdminSidebarContext.Provider value={value}>{children}</AdminSidebarContext.Provider>;
}

export function useAdminSidebar(): AdminSidebarContextValue | null {
  return useContext(AdminSidebarContext);
}
