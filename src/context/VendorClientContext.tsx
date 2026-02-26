import React, { createContext, useContext, useState, useEffect } from 'react';
import { vendorsData } from '../data/zohoVendorsSeed';
import { clientsData } from '../data/zohoClientsSeed';

export interface VendorClient {
 id: string;
 type: 'vendor' | 'client';
 name: string;
 email: string;
 phone: string;
 location: string;
 country: string;
 city: string;
 category: string;
 rating: number;
 status: 'active' | 'inactive' | 'pending';
 moq: string;
 leadTime: string;
 paymentTerms: string;
 notes: string;
 createdAt: string;
 lastModified: string;
 data: Record<string, any>;
}

interface VendorClientContextType {
 vendorClients: VendorClient[];
 addVendorClient: (vendorClient: VendorClient) => void;
 updateVendorClient: (id: string, vendorClient: Partial<VendorClient>) => void;
 deleteVendorClient: (id: string) => void;
}

const VendorClientContext = createContext<VendorClientContextType | undefined>(undefined);

export const VendorClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [vendorClients, setVendorClients] = useState<VendorClient[]>([]);

 const normalizeEntityCode = (entry: VendorClient): VendorClient => {
  const fallbackCode =
   entry.data?.entityCode ||
   entry.data?.customerNumber ||
   entry.data?.cfContactId ||
   entry.data?.contactId ||
   entry.id;

  return {
   ...entry,
   data: {
    ...entry.data,
    entityCode: String(fallbackCode ?? ''),
   },
  };
 };

 // Load from localStorage on mount
 useEffect(() => {
  const seeded = [...vendorsData, ...clientsData].map(normalizeEntityCode);
  const stored = localStorage.getItem('vendorClients');

  if (stored) {
   try {
    const parsed = JSON.parse(stored) as VendorClient[];
    const merged = [...parsed];
    const existingIds = new Set(parsed.map(entry => entry.id));
    seeded.forEach(entry => {
     if (!existingIds.has(entry.id)) {
      merged.push(entry);
     }
    });
    setVendorClients(merged.map(normalizeEntityCode));
    return;
   } catch {
   }
  }

  setVendorClients(seeded);
 }, []);

 // Save to localStorage whenever changed
 useEffect(() => {
  localStorage.setItem('vendorClients', JSON.stringify(vendorClients));
 }, [vendorClients]);

 const addVendorClient = (vendorClient: VendorClient) => {
  setVendorClients(prev => [...prev, vendorClient]);
 };

 const updateVendorClient = (id: string, updates: Partial<VendorClient>) => {
  setVendorClients(prev =>
   prev.map(vc => vc.id === id ? { ...vc, ...updates, lastModified: new Date().toISOString() } : vc)
  );
 };

 const deleteVendorClient = (id: string) => {
  setVendorClients(prev => prev.filter(vc => vc.id !== id));
 };

 return (
  <VendorClientContext.Provider value={{ vendorClients, addVendorClient, updateVendorClient, deleteVendorClient }}>
   {children}
  </VendorClientContext.Provider>
 );
};

export const useVendorClient = () => {
 const context = useContext(VendorClientContext);
 if (!context) {
  throw new Error('useVendorClient must be used within VendorClientProvider');
 }
 return context;
};
