import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
 if (!data.length) {
  console.warn('No data to export');
  return;
 }

 const headers = Object.keys(data[0]);
 const csvContent = [
  headers.join(','),
  ...data.map(row => 
   headers.map(header => {
    const value = row[header];
    // Handle strings with commas or quotes
    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
     return `"${value.replace(/"/g, '""')}"`;
    }
    return value ?? '';
   }).join(',')
  )
 ].join('\n');

 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 saveAs(blob, `${filename}.csv`);
};

/**
 * Export data to Excel format
 */
export const exportToExcel = (
 data: Record<string, unknown>[], 
 filename: string,
 sheetName: string = 'Sheet1'
) => {
 if (!data.length) {
  console.warn('No data to export');
  return;
 }

 const worksheet = XLSX.utils.json_to_sheet(data);
 const workbook = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
 
 // Auto-size columns
 const maxWidth = 50;
 const colWidths = Object.keys(data[0]).map(key => {
  const maxLength = Math.max(
   key.length,
   ...data.map(row => String(row[key] ?? '').length)
  );
  return { wch: Math.min(maxLength + 2, maxWidth) };
 });
 worksheet['!cols'] = colWidths;

 const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
 const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 saveAs(blob, `${filename}.xlsx`);
};

/**
 * Export multiple sheets to Excel
 */
export const exportMultiSheetExcel = (
 sheets: { name: string; data: Record<string, unknown>[] }[],
 filename: string
) => {
 const workbook = XLSX.utils.book_new();
 
 sheets.forEach(sheet => {
  if (sheet.data.length > 0) {
   const worksheet = XLSX.utils.json_to_sheet(sheet.data);
   XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
 });

 const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
 const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 saveAs(blob, `${filename}.xlsx`);
};

/**
 * Format order data for export
 */
export const formatOrdersForExport = (orders: any[]) => {
 return orders.map(order => ({
  'Order ID': order.id,
  'Order No': order.orderNo,
  'Order Type': order.orderType,
  'SKU': order.sku,
  'Item Name': order.itemName,
  'Quantity': order.qty,
  'Unit Rate': order.unitRate,
  'Order Date': order.odrDate,
  'Est. Delivery': order.estDelDate,
  'Completion Date': order.comDate,
  'Current Stage': order.currentStage,
  'Status': order.currentStatus,
  'Comments': order.comments,
 }));
};
