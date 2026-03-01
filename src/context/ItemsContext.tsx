import React, { createContext, useContext, useState } from 'react';

export interface MasterItem {
 id: string;
 type: 'raw-material' | 'bom' | 'packaging';
 name: string;
 code: string;
 createdAt: string;
 lastModified: string;
 data: any;
}

interface ItemsContextType {
 items: MasterItem[];
 addItem: (item: MasterItem) => void;
 updateItem: (id: string, item: MasterItem) => void;
 deleteItem: (id: string) => void;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

export const ItemsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [items, setItems] = useState<MasterItem[]>([]);

 // No localStorage: pure backend integration; masters data from API in respective pages (e.g. SwapMaterialModal uses raw materials API)

 const addItem = (item: MasterItem) => {
  setItems((prev) => [...prev, item]);
 };

 const updateItem = (id: string, updatedItem: MasterItem) => {
  setItems((prev) =>
   prev.map((item) => (item.id === id ? updatedItem : item))
  );
 };

 const deleteItem = (id: string) => {
  setItems((prev) => prev.filter((item) => item.id !== id));
 };

 return (
  <ItemsContext.Provider value={{ items, addItem, updateItem, deleteItem }}>
   {children}
  </ItemsContext.Provider>
 );
};

export const useItems = () => {
 const context = useContext(ItemsContext);
 if (!context) {
  throw new Error('useItems must be used within ItemsProvider');
 }
 return context;
};
