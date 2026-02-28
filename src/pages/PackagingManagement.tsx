import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput, Pagination } from '../components/ui';

type TabType = 'management' | 'list';

interface PackagingItem {
 id: string;
 packageCode: string;
 packageName: string;
 packageSKU: string;
 bottom: string;
 capType: string;
 bottomName: string;
 bottomMaterial: string;
 capName: string;
 capMaterial: string;
 bottomColor: string;
 capColor: string;
 bottomWeight: string;
 capWeight: string;
 dispenserVolume: string;
 minimumOrderQuantity: string;
 budget: string;
 comments: string;
 status: 'active' | 'inactive';
 createdAt: string;
}

const PACKAGING_STORAGE_KEY = 'eisthetic_packaging_items';

const defaultPackagingItems: PackagingItem[] = [
 { id: 'PKG001', packageCode: 'PKG-BTL-001', packageName: '30ml Dropper Bottle', packageSKU: 'SKU-DRP-30',
  bottom: 'round', capType: 'dropper', bottomName: 'Amber Glass', bottomMaterial: 'glass', capName: 'Black Dropper',
  capMaterial: 'plastic', bottomColor: 'Amber', capColor: 'Black', bottomWeight: '45g', capWeight: '8g',
  dispenserVolume: '30ml', minimumOrderQuantity: '1000', budget: 'medium', comments: 'Standard serum bottle',
  status: 'active', createdAt: '2024-01-10' },
 { id: 'PKG002', packageCode: 'PKG-JAR-001', packageName: '50ml Cream Jar', packageSKU: 'SKU-JAR-50',
  bottom: 'flat', capType: 'screw', bottomName: 'Frosted Glass', bottomMaterial: 'glass', capName: 'Gold Lid',
  capMaterial: 'metal', bottomColor: 'Frosted White', capColor: 'Gold', bottomWeight: '85g', capWeight: '25g',
  dispenserVolume: '50ml', minimumOrderQuantity: '500', budget: 'high', comments: 'Premium cream jar',
  status: 'active', createdAt: '2024-01-15' },
 { id: 'PKG003', packageCode: 'PKG-PMP-001', packageName: '100ml Pump Bottle', packageSKU: 'SKU-PMP-100',
  bottom: 'round', capType: 'pump', bottomName: 'Clear PET', bottomMaterial: 'plastic', capName: 'White Pump',
  capMaterial: 'plastic', bottomColor: 'Clear', capColor: 'White', bottomWeight: '35g', capWeight: '12g',
  dispenserVolume: '100ml', minimumOrderQuantity: '2000', budget: 'low', comments: 'Economy lotion bottle',
  status: 'active', createdAt: '2024-01-20' },
];

const PackagingManagement = () => {
 const [activeTab, setActiveTab] = useState<TabType>('management');
 const [searchQuery, setSearchQuery] = useState('');
 const [entriesPerPage, setEntriesPerPage] = useState(10);
 const [currentPage, setCurrentPage] = useState(1);
 const [selectedItem, setSelectedItem] = useState<PackagingItem | null>(null);
 const [isViewModalOpen, setIsViewModalOpen] = useState(false);
 const [isEditMode, setIsEditMode] = useState(false);

 const [packagingItems, setPackagingItems] = useState<PackagingItem[]>(() => {
  try {
   const stored = localStorage.getItem(PACKAGING_STORAGE_KEY);
   if (stored) return JSON.parse(stored);
  } catch (_error) { /* parse error — fall back to defaults */ }
  return defaultPackagingItems;
 });

 useEffect(() => {
  localStorage.setItem(PACKAGING_STORAGE_KEY, JSON.stringify(packagingItems));
 }, [packagingItems]);

 const [packageImage, setPackageImage] = useState<File | null>(null);
 const [packageCapImage, setPackageCapImage] = useState<File | null>(null);
 const [packageBottleImage, setPackageBottleImage] = useState<File | null>(null);
 const [packageDispenserImage, setPackageDispenserImage] = useState<File | null>(null);

 const [formData, setFormData] = useState({
  packageCode: '',
  packageName: '',
  packageSKU: '',
  packageBottom: '',
  bottom: '',
  capType: '',
  bottomName: '',
  bottomMaterial: '',
  capName: '',
  capMaterial: '',
  bottomColor: '',
  capColor: '',
  bottomWeight: '',
  capWeight: '',
  dispenserVolume: '',
  minimumOrderQuantity: '',
  budget: '',
  comments: ''
 });

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({
   ...prev,
   [name]: value
  }));
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
  const file = e.target.files?.[0];
  if (file) {
   switch (type) {
    case 'package':
     setPackageImage(file);
     break;
    case 'cap':
     setPackageCapImage(file);
     break;
    case 'bottle':
     setPackageBottleImage(file);
     break;
    case 'dispenser':
     setPackageDispenserImage(file);
     break;
   }
  }
 };

 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const newItem: PackagingItem = {
   id: `PKG${String(packagingItems.length + 1).padStart(3, '0')}`,
   ...formData,
   status: 'active',
   createdAt: new Date().toISOString().split('T')[0]
  };
  setPackagingItems(prev => [...prev, newItem]);
  setFormData({ packageCode: '', packageName: '', packageSKU: '', packageBottom: '', bottom: '', capType: '',
   bottomName: '', bottomMaterial: '', capName: '', capMaterial: '', bottomColor: '', capColor: '',
   bottomWeight: '', capWeight: '', dispenserVolume: '', minimumOrderQuantity: '', budget: '', comments: '' });
  setActiveTab('list');
 };

 const handleViewItem = (item: PackagingItem) => { setSelectedItem(item); setIsViewModalOpen(true); setIsEditMode(false); };
 const handleEditItem = (item: PackagingItem) => { setSelectedItem(item); setIsViewModalOpen(true); setIsEditMode(true); };
 const handleUpdateItem = () => {
  if (!selectedItem) return;
  setPackagingItems(prev => prev.map(item => item.id === selectedItem.id ? selectedItem : item));
  setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false);
 };
 const handleDeleteItem = (id: string) => {
  if (window.confirm('Are you sure you want to delete this packaging item?')) {
   setPackagingItems(prev => prev.filter(item => item.id !== id));
  }
 };
 const handleToggleStatus = (id: string) => {
  setPackagingItems(prev => prev.map(item => item.id === id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item));
 };

 const filteredItems = packagingItems.filter(item =>
  item.packageCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
  item.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
  item.capType.toLowerCase().includes(searchQuery.toLowerCase())
 );
 const totalPages = Math.ceil(filteredItems.length / entriesPerPage);
 const paginatedItems = filteredItems.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

 const getBudgetBadgeColor = (budget: string) => {
  switch (budget.toLowerCase()) {
   case 'high': return 'bg-purple-100 text-purple-700';
   case 'medium': return 'bg-gray-100 text-slate-900';
   case 'low': return 'bg-green-100 text-green-700';
   default: return 'bg-gray-100 text-gray-700';
  }
 };

 return (
  <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
   {/* Header */}
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Packaging Management</h1>
    <div className="flex items-center gap-2 mt-2 text-sm bg-gray-100 px-4 py-2 rounded-lg">
     <Link to="/" className="text-slate-800 hover:text-amber-800 hover:underline">Dashboard</Link>
     <span className="text-gray-400">/</span>
     <span className="text-gray-600">Packaging Management</span>
    </div>
   </div>

   <div className="bg-white rounded-xl shadow-sm border border-gray-100">
    {/* Tab Headers */}
    <div className="border-b border-gray-200 flex overflow-x-auto">
     <button onClick={() => setActiveTab('management')}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'management' ? 'bg-slate-800 text-white rounded-tl-xl' : 'text-gray-600 hover:bg-gray-50'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      Packaging Management
     </button>
     <button onClick={() => setActiveTab('list')}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
      Packaging List
      <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">{packagingItems.length}</span>
     </button>
    </div>

    {/* Form Content */}
    {activeTab === 'management' && (
     <form onSubmit={handleSubmit} className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
       {/* Left Column */}
       <div className="space-y-4">
        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Package Code</label>
         <input
          type="text"
          name="packageCode"
          value={formData.packageCode}
          onChange={handleInputChange}
          placeholder="Enter Package Code"
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Package SKU</label>
         <select
          name="packageSKU"
          value={formData.packageSKU}
          onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         >
          <option value="">Select Package SKU</option>
          <option value="sku1">SKU 1</option>
          <option value="sku2">SKU 2</option>
         </select>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Bottom</label>
         <select
          name="bottom"
          value={formData.bottom}
          onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         >
          <option value="">Select Package Bottom</option>
          <option value="flat">Flat</option>
          <option value="round">Round</option>
         </select>
        </div>

        <div className="border border-gray-200 rounded p-4">
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Bottom Name</label>
           <input
            type="text"
            name="bottomName"
            value={formData.bottomName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Bottom Material</label>
           <select
            name="bottomMaterial"
            value={formData.bottomMaterial}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           >
            <option value="">Select Bottom Material</option>
            <option value="plastic">Plastic</option>
            <option value="glass">Glass</option>
           </select>
          </div>
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Cap Name</label>
           <input
            type="text"
            name="capName"
            value={formData.capName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Cap Material</label>
           <select
            name="capMaterial"
            value={formData.capMaterial}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           >
            <option value="">Select Cap Material</option>
            <option value="plastic">Plastic</option>
            <option value="metal">Metal</option>
           </select>
          </div>
         </div>
        </div>

        <div className="border border-gray-200 rounded p-4">
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Bottom Color</label>
           <input
            type="text"
            name="bottomColor"
            value={formData.bottomColor}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Cap Color</label>
           <input
            type="text"
            name="capColor"
            value={formData.capColor}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
          </div>
         </div>
        </div>

        <div className="border border-gray-200 rounded p-4">
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Bottom Weight</label>
           <input
            type="text"
            name="bottomWeight"
            value={formData.bottomWeight}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">Cap Weight</label>
           <input
            type="text"
            name="capWeight"
            value={formData.capWeight}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
          </div>
         </div>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Dispenser Volume</label>
         <select
          name="dispenserVolume"
          value={formData.dispenserVolume}
          onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         >
          <option value="">Select Dispenser Volume</option>
          <option value="50ml">50ml</option>
          <option value="100ml">100ml</option>
          <option value="250ml">250ml</option>
         </select>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Minimum Order Quantity</label>
         <input
          type="text"
          name="minimumOrderQuantity"
          value={formData.minimumOrderQuantity}
          onChange={handleInputChange}
          placeholder="Enter Minimum Order Quantity"
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
        </div>
       </div>

       {/* Right Column */}
       <div className="space-y-4">
        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Package Name</label>
         <input
          type="text"
          name="packageName"
          value={formData.packageName}
          onChange={handleInputChange}
          placeholder="Enter Package Name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Cap Type</label>
         <select
          name="capType"
          value={formData.capType}
          onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         >
          <option value="">Select Cap Type</option>
          <option value="screw">Screw Cap</option>
          <option value="flip">Flip Cap</option>
          <option value="pump">Pump</option>
         </select>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-gray-700">Budget</label>
         <select
          name="budget"
          value={formData.budget}
          onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         >
          <option value="">Select Budget</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
         </select>
        </div>

        <div className="border border-gray-200 rounded p-4 space-y-4">
         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-gray-700">Package Image</label>
          <div className="flex-1">
           <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'package')}
            className="hidden"
            id="package-image"
           />
           <label
            htmlFor="package-image"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-gray-500">
            {packageImage ? packageImage.name : 'No file chosen'}
           </span>
          </div>
         </div>

         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-gray-700">Package Cap Image</label>
          <div className="flex-1">
           <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'cap')}
            className="hidden"
            id="cap-image"
           />
           <label
            htmlFor="cap-image"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-gray-500">
            {packageCapImage ? packageCapImage.name : 'No file chosen'}
           </span>
          </div>
         </div>
        </div>

        <div className="border border-gray-200 rounded p-4 space-y-4">
         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-gray-700">Package Bottle Image</label>
          <div className="flex-1">
           <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'bottle')}
            className="hidden"
            id="bottle-image"
           />
           <label
            htmlFor="bottle-image"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-gray-500">
            {packageBottleImage ? packageBottleImage.name : 'No file chosen'}
           </span>
          </div>
         </div>

         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-gray-700">Package Dispenser Image</label>
          <div className="flex-1">
           <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'dispenser')}
            className="hidden"
            id="dispenser-image"
           />
           <label
            htmlFor="dispenser-image"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-gray-500">
            {packageDispenserImage ? packageDispenserImage.name : 'No file chosen'}
           </span>
          </div>
         </div>
        </div>

        <div className="flex items-start gap-4">
         <label className="w-48 text-sm font-medium text-gray-700 pt-2">Comments</label>
         <textarea
          name="comments"
          value={formData.comments}
          onChange={handleInputChange}
          rows={6}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
        </div>
       </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6 flex gap-4">
       <button type="submit" className="px-6 py-2.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Submit
       </button>
       <button type="button" onClick={() => setFormData({ packageCode: '', packageName: '', packageSKU: '', packageBottom: '', bottom: '', capType: '', bottomName: '', bottomMaterial: '', capName: '', capMaterial: '', bottomColor: '', capColor: '', bottomWeight: '', capWeight: '', dispenserVolume: '', minimumOrderQuantity: '', budget: '', comments: '' })}
        className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors">Reset Form</button>
      </div>
     </form>
    )}

    {activeTab === 'list' && (
     <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Show</span>
        <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value))}
         className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
         <option value="10">10</option><option value="25">25</option><option value="50">50</option>
        </select>
        <span className="text-sm text-gray-600">entries</span>
       </div>
       <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search packaging..."
       />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
       {paginatedItems.map((item) => (
        <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
         <div className="flex justify-between items-start mb-3">
          <div>
           <span className="text-xs text-gray-500">{item.packageCode}</span>
           <h3 className="font-semibold text-gray-800">{item.packageName}</h3>
           <p className="text-sm text-gray-600">{item.packageSKU}</p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span>
         </div>
         <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">{item.capType}</span>
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">{item.dispenserVolume}</span>
          <span className={`px-2 py-1 text-xs rounded-full ${getBudgetBadgeColor(item.budget)}`}>{item.budget}</span>
         </div>
         <div className="flex gap-2">
          <button onClick={() => handleViewItem(item)} className="flex-1 px-3 py-2 bg-gray-100 text-slate-900 rounded-lg text-sm font-medium hover:bg-gray-200">View</button>
          <button onClick={() => handleEditItem(item)} className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200">Edit</button>
          <button onClick={() => handleDeleteItem(item.id)} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
         </div>
        </div>
       ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
       <table className="w-full">
        <thead>
         <tr className="bg-gray-50 border-b border-gray-200">
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Package Code</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Package Name</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Cap Type</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Volume</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">MOQ</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Budget</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Status</th>
          <th className="px-4 py-3 text-center text-xs font-semibold text-amber-800 uppercase tracking-wider">Actions</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
         {paginatedItems.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
           <td className="px-4 py-4"><span className="font-mono text-sm text-gray-600">{item.packageCode}</span></td>
           <td className="px-4 py-4"><div><p className="font-medium text-gray-800">{item.packageName}</p><p className="text-sm text-gray-500">{item.packageSKU}</p></div></td>
           <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{item.capType}</span></td>
           <td className="px-4 py-4 text-sm text-gray-600">{item.dispenserVolume}</td>
           <td className="px-4 py-4 text-sm font-medium text-gray-800">{item.minimumOrderQuantity}</td>
           <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getBudgetBadgeColor(item.budget)}`}>{item.budget}</span></td>
           <td className="px-4 py-4">
            <button onClick={() => handleToggleStatus(item.id)} className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>{item.status}</button>
           </td>
           <td className="px-4 py-4">
            <div className="flex items-center justify-center gap-2">
             <button onClick={() => handleViewItem(item)} className="p-2 text-slate-800 hover:bg-gray-50 rounded-lg transition-colors" title="View">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
             </button>
             <button onClick={() => handleEditItem(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
             </button>
             <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
            </div>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Pagination */}
      <Pagination
       currentPage={currentPage}
       totalPages={totalPages}
       onPageChange={setCurrentPage}
       totalItems={filteredItems.length}
       itemsPerPage={entriesPerPage}
      />
     </div>
    )}
   </div>

   {/* View/Edit Modal */}
   {isViewModalOpen && selectedItem && (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
     <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
      <div className="sticky top-0 bg-slate-800 px-6 py-4 flex justify-between items-center">
       <div><h2 className="text-xl font-bold text-white">{isEditMode ? 'Edit Package' : 'Package Details'}</h2><p className="text-gray-100 text-sm">{selectedItem.packageCode}</p></div>
       <button onClick={() => { setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false); }} className="text-white/80 hover:text-white transition-colors">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
       </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
         <h3 className="font-semibold text-gray-800 border-b pb-2">Package Information</h3>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Package Name</label>
          {isEditMode ? <input type="text" value={selectedItem.packageName} onChange={(e) => setSelectedItem({...selectedItem, packageName: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" /> : <p className="text-gray-800 font-medium">{selectedItem.packageName}</p>}</div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">SKU</label><p className="text-gray-800 font-mono">{selectedItem.packageSKU}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Cap Type</label><p className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 inline-block">{selectedItem.capType}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Volume</label><p className="text-gray-800">{selectedItem.dispenserVolume}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">MOQ</label><p className="text-gray-800 font-semibold">{selectedItem.minimumOrderQuantity}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Budget</label><p className={`mt-1 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${getBudgetBadgeColor(selectedItem.budget)}`}>{selectedItem.budget}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Status</label><p className={`mt-1 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${selectedItem.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{selectedItem.status}</p></div>
         </div>
        </div>
        <div className="space-y-4">
         <h3 className="font-semibold text-gray-800 border-b pb-2">Materials & Specs</h3>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Bottom Material</label><p className="text-gray-800">{selectedItem.bottomMaterial}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Cap Material</label><p className="text-gray-800">{selectedItem.capMaterial}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Bottom Color</label><p className="text-gray-800">{selectedItem.bottomColor}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Cap Color</label><p className="text-gray-800">{selectedItem.capColor}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Bottom Weight</label><p className="text-gray-800">{selectedItem.bottomWeight}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Cap Weight</label><p className="text-gray-800">{selectedItem.capWeight}</p></div>
         </div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Comments</label><p className="text-gray-700 text-sm">{selectedItem.comments || 'N/A'}</p></div>
        </div>
       </div>
      </div>
      <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
       {isEditMode ? (
        <><button onClick={() => setIsEditMode(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleUpdateItem} className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors">Save Changes</button></>
       ) : (
        <><button onClick={() => { setIsViewModalOpen(false); setSelectedItem(null); }} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Close</button>
        <button onClick={() => setIsEditMode(true)} className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors">Edit Package</button></>
       )}
      </div>
     </div>
    </div>
   )}
  </div>
 );
};

export default PackagingManagement;
