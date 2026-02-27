import React, { createContext, useContext, useState, useEffect } from 'react';
import { ZOHO_ITEM_SEED } from '../data/zohoItemsSeed';
import { ZOHO_RAW_MATERIALS_SEED } from '../data/zohoRawMaterialsSeed';

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

 const mapZohoRowToMaster = (row: any): MasterItem => {
  const createdRaw = String(row['Created Time'] || '');
  const modifiedRaw = String(row['Last Modified Time'] || createdRaw);

  const toIso = (val: string) => {
   if (!val) return new Date().toISOString();
   // Expecting 'YYYY-MM-DD HH:mm:ss'
   const normalized = val.replace(' ', 'T');
   const d = new Date(normalized);
   return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  const inferType = (): MasterItem['type'] => {
   const cat = String(row['CF.ITEM CATEGORY'] || row['Category Name'] || '').toLowerCase();
   if (cat.includes('packaging') || cat.includes('spm')) return 'packaging';
   return 'bom';
  };

  const name = String(row['Item Name'] || '').trim() || 'Imported Item';
  const code =
   String(row.SKU || row['CF.Material Code'] || row['Item ID'] || '').trim() ||
   `IM-${Date.now().toString().slice(-6)}`;

  return {
   id: String(row['Item ID'] || code || Date.now().toString()),
   type: inferType(),
   name,
   code,
   createdAt: toIso(createdRaw),
   lastModified: toIso(modifiedRaw),
   data: row,
  };
 };

 const mapRawMaterialsSeedToMaster = (rows: any[]): MasterItem[] => {
  const grouped = new Map<string, { baseRow: any; mappedItems: Array<{ name: string; sku: string; quantity: string }> }>();

  rows.forEach((row) => {
   const compositeId = String(row['Composite Item ID'] || row['Composite Item Name'] || row['SKU'] || Date.now().toString());
   const mappedName = String(row['Mapped Item Name'] || '').trim();
   const mappedSku = String(row['Mapped Item SKU'] || '').trim();
   const mappedQuantity = String(row['Mapped Quantity'] || '').trim();

   if (!grouped.has(compositeId)) {
    grouped.set(compositeId, { baseRow: row, mappedItems: [] });
   }

   if (mappedName || mappedSku || mappedQuantity) {
    grouped.get(compositeId)?.mappedItems.push({
     name: mappedName || '-',
     sku: mappedSku || '-',
     quantity: mappedQuantity || '-',
    });
   }
  });

  const now = new Date().toISOString();
  return Array.from(grouped.entries()).map(([compositeId, group]) => {
   const baseRow = group.baseRow || {};
   const compositeName = String(baseRow['Composite Item Name'] || '').trim() || 'Raw Composite';
   const compositeSku = String(baseRow['SKU'] || '').trim() || `RM-${compositeId.slice(-6)}`;

   return {
    id: compositeId,
    type: 'raw-material',
    name: compositeName,
    code: compositeSku,
    createdAt: now,
    lastModified: now,
    data: {
     compositeItemId: compositeId,
     compositeItemName: compositeName,
     sku: compositeSku,
     unit: String(baseRow['Unit'] || '').trim(),
     status: String(baseRow['Status'] || '').trim(),
     mappedItems: group.mappedItems,
    },
   };
  });
 };

 const mergeSeedItems = (existing: MasterItem[], seeded: MasterItem[]) => {
  const existingIds = new Set(existing.map((item) => item.id));
  return [...existing, ...seeded.filter((item) => !existingIds.has(item.id))];
 };

 // Load from localStorage on mount; if empty, seed from Zoho export
 useEffect(() => {
  const stored = localStorage.getItem('mastersItems');
    if (stored) {
   try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
     if (parsed.length > 0) {
            const rawSeeded = mapRawMaterialsSeedToMaster(ZOHO_RAW_MATERIALS_SEED);
            setItems(mergeSeedItems(parsed, rawSeeded));
            return;
     }
     // If it's an empty array, fall through and seed
    } else {
    localStorage.removeItem('mastersItems');
   }
   } catch {
    localStorage.removeItem('mastersItems');
   }
  }

  // No existing data – bootstrap from Zoho seed
    const seeded = ZOHO_ITEM_SEED.map(mapZohoRowToMaster);
    const rawSeeded = mapRawMaterialsSeedToMaster(ZOHO_RAW_MATERIALS_SEED);
    setItems([...seeded, ...rawSeeded]);
 }, []);

 // Save to localStorage whenever items change
 useEffect(() => {
  localStorage.setItem('mastersItems', JSON.stringify(items));
 }, [items]);

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
