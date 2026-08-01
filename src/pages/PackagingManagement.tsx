import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput, Pagination } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';
import { fetchPackagingList, createPackaging, updatePackaging, deletePackaging, type PackagingItem } from '../services/packaging.service';

type TabType = 'management' | 'list';

const PackagingManagement = () => {
 const [activeTab, setActiveTab] = useState<TabType>('management');
 const [searchQuery, setSearchQuery] = useState('');
 const debouncedSearch = useDebounce(searchQuery, 300);
 const [entriesPerPage, setEntriesPerPage] = useState(10);
 const [currentPage, setCurrentPage] = useState(1);
 const [selectedItem, setSelectedItem] = useState<PackagingItem | null>(null);
 const [isViewModalOpen, setIsViewModalOpen] = useState(false);
 const [isEditMode, setIsEditMode] = useState(false);

 const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);

 const loadPackaging = useCallback(async () => {
  setLoading(true);
  setLoadError(null);
  try {
   const list = await fetchPackagingList(debouncedSearch);
   setPackagingItems(list);
  } catch (e) {
   setLoadError(e instanceof Error ? e.message : 'Failed to load packaging');
   setPackagingItems([]);
  } finally {
   setLoading(false);
  }
 }, [debouncedSearch]);

 useEffect(() => {
  loadPackaging();
 }, [loadPackaging]);

 useEffect(() => {
  setCurrentPage(1);
 }, [debouncedSearch]);

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

 const emptyForm = () => ({
  packageCode: '', packageName: '', packageSKU: '', packageBottom: '', bottom: '', capType: '',
  bottomName: '', bottomMaterial: '', capName: '', capMaterial: '', bottomColor: '', capColor: '',
  bottomWeight: '', capWeight: '', dispenserVolume: '', minimumOrderQuantity: '', budget: '', comments: ''
 });

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
   await createPackaging({
    packageCode: formData.packageCode,
    packageName: formData.packageName,
    packageSKU: formData.packageSKU,
    bottom: formData.bottom,
    capType: formData.capType,
    bottomName: formData.bottomName,
    bottomMaterial: formData.bottomMaterial,
    capName: formData.capName,
    capMaterial: formData.capMaterial,
    bottomColor: formData.bottomColor,
    capColor: formData.capColor,
    bottomWeight: formData.bottomWeight,
    capWeight: formData.capWeight,
    dispenserVolume: formData.dispenserVolume,
    minimumOrderQuantity: formData.minimumOrderQuantity,
    budget: formData.budget,
    comments: formData.comments,
    status: 'active'
   });
   setFormData(emptyForm());
   await loadPackaging();
   setActiveTab('list');
  } catch (err) {
   console.error(err);
   setLoadError(err instanceof Error ? err.message : 'Failed to create packaging');
  }
 };

 const handleViewItem = (item: PackagingItem) => { setSelectedItem(item); setIsViewModalOpen(true); setIsEditMode(false); };
 const handleEditItem = (item: PackagingItem) => { setSelectedItem(item); setIsViewModalOpen(true); setIsEditMode(true); };
 const handleUpdateItem = async () => {
  if (!selectedItem) return;
  try {
   await updatePackaging(selectedItem.id, {
    packageCode: selectedItem.packageCode,
    packageName: selectedItem.packageName,
    packageSKU: selectedItem.packageSKU,
    bottom: selectedItem.bottom,
    capType: selectedItem.capType,
    bottomName: selectedItem.bottomName,
    bottomMaterial: selectedItem.bottomMaterial,
    capName: selectedItem.capName,
    capMaterial: selectedItem.capMaterial,
    bottomColor: selectedItem.bottomColor,
    capColor: selectedItem.capColor,
    bottomWeight: selectedItem.bottomWeight,
    capWeight: selectedItem.capWeight,
    dispenserVolume: selectedItem.dispenserVolume,
    minimumOrderQuantity: selectedItem.minimumOrderQuantity,
    budget: selectedItem.budget,
    comments: selectedItem.comments,
    status: selectedItem.status
   });
   setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false);
   loadPackaging();
  } catch (err) {
   console.error(err);
  }
 };
 const handleDeleteItem = async (id: string) => {
  if (!window.confirm('Are you sure you want to delete this packaging item?')) return;
  try {
   await deletePackaging(id);
   loadPackaging();
  } catch (err) {
   console.error(err);
  }
 };
 const handleToggleStatus = (id: string) => {
  setPackagingItems(prev => prev.map(item => item.id === id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item));
 };

 // List is already filtered by API when search is sent (real-time dynamic search)
 const totalPages = Math.ceil(packagingItems.length / entriesPerPage);
 const paginatedItems = packagingItems.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

 const getBudgetBadgeColor = (budget: string) => {
  switch (budget.toLowerCase()) {
   case 'high': return 'bg-purple-100 text-purple-700';
   case 'medium': return 'bg-surface-3 text-ink';
   case 'low': return 'bg-green-100 text-green-700';
   default: return 'bg-surface-3 text-ink-2';
  }
 };

 return (
  <div className="p-4 md:p-8 bg-surface-2 min-h-screen">
   {/* Header */}
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-ink">Packaging Management</h1>
    <div className="flex items-center gap-2 mt-2 text-sm bg-surface-3 px-4 py-2 rounded-lg">
     <Link to="/" className="text-ink hover:text-amber-800 hover:underline">Dashboard</Link>
     <span className="text-ink-4">/</span>
     <span className="text-ink-3">Packaging Management</span>
    </div>
   </div>

   <div className="bg-surface rounded-xl shadow-sm border border-hairline">
    {/* Tab Headers */}
    <div className="border-b border-border flex overflow-x-auto">
     <button onClick={() => setActiveTab('management')}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'management' ? 'bg-brand text-white rounded-tl-xl' : 'text-ink-3 hover:bg-surface-3'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      Packaging Management
     </button>
     <button onClick={() => setActiveTab('list')}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-brand text-white' : 'text-ink-3 hover:bg-surface-3'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
      Packaging List
      <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">{packagingItems.length}</span>
     </button>
    </div>

    {/* Form Content */}
    {activeTab === 'management' && (
     <>
     {/* Top-level actions (like Raw Materials) */}
     <div className="px-6 py-4 border-b border-hairline bg-surface-3 flex flex-wrap items-center gap-3">
      <button
       type="button"
       onClick={() => setFormData(emptyForm())}
       className="px-4 py-2 bg-surface-3 text-ink-2 font-medium rounded-lg hover:bg-surface-3 transition-colors text-sm"
      >
       Reset Form
      </button>
     </div>
     <form onSubmit={handleSubmit} className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
       {/* Left Column */}
       <div className="space-y-4">
        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Package Code</label>
         <input
          type="text"
          name="packageCode"
          value={formData.packageCode}
          onChange={handleInputChange}
          placeholder="Enter Package Code"
          aria-label="Package Code"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         />
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Package SKU</label>
         <select
          name="packageSKU"
          value={formData.packageSKU}
          onChange={handleInputChange}
          aria-label="Package SKU"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         >
          <option value="">Select Package SKU</option>
          <option value="sku1">SKU 1</option>
          <option value="sku2">SKU 2</option>
         </select>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Bottom</label>
         <select
          name="bottom"
          value={formData.bottom}
          onChange={handleInputChange}
          aria-label="Bottom"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         >
          <option value="">Select Package Bottom</option>
          <option value="flat">Flat</option>
          <option value="round">Round</option>
         </select>
        </div>

        <div className="border border-border rounded p-4">
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Bottom Name</label>
           <input
            type="text"
            name="bottomName"
            value={formData.bottomName}
            onChange={handleInputChange}
            aria-label="Bottom Name"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Bottom Material</label>
           <select
            name="bottomMaterial"
            value={formData.bottomMaterial}
            onChange={handleInputChange}
            aria-label="Bottom Material"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           >
            <option value="">Select Bottom Material</option>
            <option value="plastic">Plastic</option>
            <option value="glass">Glass</option>
           </select>
          </div>
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Cap Name</label>
           <input
            type="text"
            name="capName"
            value={formData.capName}
            onChange={handleInputChange}
            aria-label="Cap Name"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Cap Material</label>
           <select
            name="capMaterial"
            value={formData.capMaterial}
            onChange={handleInputChange}
            aria-label="Cap Material"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           >
            <option value="">Select Cap Material</option>
            <option value="plastic">Plastic</option>
            <option value="metal">Metal</option>
           </select>
          </div>
         </div>
        </div>

        <div className="border border-border rounded p-4">
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Bottom Color</label>
           <input
            type="text"
            name="bottomColor"
            value={formData.bottomColor}
            onChange={handleInputChange}
            aria-label="Bottom Color"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Cap Color</label>
           <input
            type="text"
            name="capColor"
            value={formData.capColor}
            onChange={handleInputChange}
            aria-label="Cap Color"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           />
          </div>
         </div>
        </div>

        <div className="border border-border rounded p-4">
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Bottom Weight</label>
           <input
            type="text"
            name="bottomWeight"
            value={formData.bottomWeight}
            onChange={handleInputChange}
            aria-label="Bottom Weight"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           />
          </div>
          <div>
           <label className="block text-sm font-medium text-ink-2 mb-2">Cap Weight</label>
           <input
            type="text"
            name="capWeight"
            value={formData.capWeight}
            onChange={handleInputChange}
            aria-label="Cap Weight"
            className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
           />
          </div>
         </div>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Dispenser Volume</label>
         <select
          name="dispenserVolume"
          value={formData.dispenserVolume}
          onChange={handleInputChange}
          aria-label="Dispenser Volume"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         >
          <option value="">Select Dispenser Volume</option>
          <option value="50ml">50ml</option>
          <option value="100ml">100ml</option>
          <option value="250ml">250ml</option>
         </select>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Minimum Order Quantity</label>
         <input
          type="text"
          name="minimumOrderQuantity"
          value={formData.minimumOrderQuantity}
          onChange={handleInputChange}
          placeholder="Enter Minimum Order Quantity"
          aria-label="Minimum Order Quantity"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         />
        </div>
       </div>

       {/* Right Column */}
       <div className="space-y-4">
        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Package Name</label>
         <input
          type="text"
          name="packageName"
          value={formData.packageName}
          onChange={handleInputChange}
          placeholder="Enter Package Name"
          aria-label="Package Name"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         />
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Cap Type</label>
         <select
          name="capType"
          value={formData.capType}
          onChange={handleInputChange}
          aria-label="Cap Type"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         >
          <option value="">Select Cap Type</option>
          <option value="screw">Screw Cap</option>
          <option value="flip">Flip Cap</option>
          <option value="pump">Pump</option>
         </select>
        </div>

        <div className="flex items-center gap-4">
         <label className="w-48 text-sm font-medium text-ink-2">Budget</label>
         <select
          name="budget"
          value={formData.budget}
          onChange={handleInputChange}
          aria-label="Budget"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         >
          <option value="">Select Budget</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
         </select>
        </div>

        <div className="border border-border rounded p-4 space-y-4">
         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-ink-2">Package Image</label>
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
            className="inline-block px-4 py-2 bg-surface-3 text-ink-2 rounded cursor-pointer hover:bg-surface-3 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-ink-3">
            {packageImage ? packageImage.name : 'No file chosen'}
           </span>
          </div>
         </div>

         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-ink-2">Package Cap Image</label>
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
            className="inline-block px-4 py-2 bg-surface-3 text-ink-2 rounded cursor-pointer hover:bg-surface-3 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-ink-3">
            {packageCapImage ? packageCapImage.name : 'No file chosen'}
           </span>
          </div>
         </div>
        </div>

        <div className="border border-border rounded p-4 space-y-4">
         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-ink-2">Package Bottle Image</label>
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
            className="inline-block px-4 py-2 bg-surface-3 text-ink-2 rounded cursor-pointer hover:bg-surface-3 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-ink-3">
            {packageBottleImage ? packageBottleImage.name : 'No file chosen'}
           </span>
          </div>
         </div>

         <div className="flex items-center gap-4">
          <label className="w-48 text-sm font-medium text-ink-2">Package Dispenser Image</label>
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
            className="inline-block px-4 py-2 bg-surface-3 text-ink-2 rounded cursor-pointer hover:bg-surface-3 transition-colors"
           >
            Choose file
           </label>
           <span className="ml-3 text-sm text-ink-3">
            {packageDispenserImage ? packageDispenserImage.name : 'No file chosen'}
           </span>
          </div>
         </div>
        </div>

        <div className="flex items-start gap-4">
         <label className="w-48 text-sm font-medium text-ink-2 pt-2">Comments</label>
         <textarea
          name="comments"
          value={formData.comments}
          onChange={handleInputChange}
          rows={6}
          aria-label="Comments"
          className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
         />
        </div>
       </div>
      </div>

      {/* Submit */}
      <div className="mt-6 flex flex-wrap gap-4">
       <button type="submit" className="px-6 py-2.5 bg-brand text-white font-medium rounded-lg hover:bg-brand-press transition-colors flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Submit
       </button>
      </div>
     </form>
     </>
    )}

    {activeTab === 'list' && (
     <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-sm text-ink-3">Show</span>
        <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value))}
         aria-label="Entries per page"
         className="px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]">
         <option value="10">10</option><option value="25">25</option><option value="50">50</option>
        </select>
        <span className="text-sm text-ink-3">entries</span>
       </div>
       <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by code, name, SKU, cap type..."
       />
      </div>

      {loading && (
       <div className="flex items-center justify-center py-12 text-ink-3">
        <span className="animate-pulse">Loading packaging...</span>
       </div>
      )}
      {!loading && loadError && (
       <div className="py-8 text-center">
        <p className="text-err mb-2">{loadError}</p>
        <button type="button" onClick={loadPackaging} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-press">Retry</button>
       </div>
      )}
      {!loading && !loadError && packagingItems.length === 0 && (
       <div className="py-12 text-center text-ink-3">No packaging entries found.</div>
      )}

      {!loading && !loadError && packagingItems.length > 0 && (
       <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
       {paginatedItems.map((item) => (
        <div key={item.id} className="bg-surface-3 border border-border rounded-xl p-4">
         <div className="flex justify-between items-start mb-3">
          <div>
           <span className="text-xs text-ink-3">{item.packageCode}</span>
           <h3 className="font-semibold text-ink">{item.packageName}</h3>
           <p className="text-sm text-ink-3">{item.packageSKU}</p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.status === 'active' ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'}`}>{item.status}</span>
         </div>
         <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2 py-1 text-xs bg-brand-soft text-brand rounded-full">{item.capType}</span>
          <span className="px-2 py-1 text-xs bg-surface-3 text-ink-3 rounded-full">{item.dispenserVolume}</span>
          <span className={`px-2 py-1 text-xs rounded-full ${getBudgetBadgeColor(item.budget)}`}>{item.budget}</span>
         </div>
         <div className="flex gap-2">
          <button onClick={() => handleViewItem(item)} className="flex-1 px-3 py-2 bg-surface-3 text-ink rounded-lg text-sm font-medium hover:bg-surface-3">View</button>
          <button onClick={() => handleEditItem(item)} className="flex-1 px-3 py-2 bg-brand-soft text-brand rounded-lg text-sm font-medium hover:bg-brand-press">Edit</button>
          <button onClick={() => handleDeleteItem(item.id)} aria-label="Delete" className="px-3 py-2 bg-err-soft text-err rounded-lg text-sm font-medium hover:bg-err-soft">
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
         <tr className="bg-surface-3 border-b border-border">
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Package Code</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Package Name</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Cap Type</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Volume</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">MOQ</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Budget</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Status</th>
          <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-ink-3 uppercase tracking-wider">Actions</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
         {paginatedItems.map((item) => (
          <tr key={item.id} className="hover:bg-surface-2 transition-colors">
           <td className="px-4 py-4"><span className="font-mono text-sm text-ink-3">{item.packageCode}</span></td>
           <td className="px-4 py-4"><div><p className="font-medium text-ink">{item.packageName}</p><p className="text-sm text-ink-3">{item.packageSKU}</p></div></td>
           <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium rounded-full bg-brand-soft text-brand">{item.capType}</span></td>
           <td className="px-4 py-4 text-sm text-ink-3">{item.dispenserVolume}</td>
           <td className="px-4 py-4 text-sm font-medium text-ink">{item.minimumOrderQuantity}</td>
           <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getBudgetBadgeColor(item.budget)}`}>{item.budget}</span></td>
           <td className="px-4 py-4">
            <button onClick={() => handleToggleStatus(item.id)} className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${item.status === 'active' ? 'bg-ok-soft text-ok hover:bg-ok-soft' : 'bg-err-soft text-err hover:bg-err-soft'}`}>{item.status}</button>
           </td>
           <td className="px-4 py-4">
            <div className="flex items-center justify-center gap-2">
             <button onClick={() => handleViewItem(item)} className="p-2 text-ink hover:bg-surface-3 rounded-lg transition-colors" title="View" aria-label="View">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
             </button>
             <button onClick={() => handleEditItem(item)} className="p-2 text-brand hover:bg-brand-soft rounded-lg transition-colors" title="Edit" aria-label="Edit">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
             </button>
             <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-err hover:bg-err-soft rounded-lg transition-colors" title="Delete" aria-label="Delete">
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
       totalItems={packagingItems.length}
       itemsPerPage={entriesPerPage}
      />
       </>
      )}
     </div>
    )}
   </div>

   {/* View/Edit Modal */}
   {isViewModalOpen && selectedItem && (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
     <div className="bg-surface rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="packaging-view-modal-title">
      <div className="sticky top-0 bg-brand px-6 py-4 flex justify-between items-center">
       <div><h2 id="packaging-view-modal-title" className="text-xl font-bold text-white">{isEditMode ? 'Edit Package' : 'Package Details'}</h2><p className="text-gray-100 text-sm">{selectedItem.packageCode}</p></div>
       <button onClick={() => { setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false); }} aria-label="Close" className="text-white/80 hover:text-white transition-colors">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
       </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
         <h3 className="font-semibold text-ink border-b pb-2">Package Information</h3>
         <div><label className="text-xs font-medium text-ink-3 uppercase">Package Name</label>
          {isEditMode ? <input type="text" value={selectedItem.packageName} onChange={(e) => setSelectedItem({...selectedItem, packageName: e.target.value})} aria-label="Package Name" className="w-full mt-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]" /> : <p className="text-ink font-medium">{selectedItem.packageName}</p>}</div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-ink-3 uppercase">SKU</label><p className="text-ink font-mono">{selectedItem.packageSKU}</p></div>
          <div><label className="text-xs font-medium text-ink-3 uppercase">Cap Type</label><p className="px-2.5 py-1 text-xs font-medium rounded-full bg-brand-soft text-brand inline-block">{selectedItem.capType}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-ink-3 uppercase">Volume</label><p className="text-ink">{selectedItem.dispenserVolume}</p></div>
          <div><label className="text-xs font-medium text-ink-3 uppercase">MOQ</label><p className="text-ink font-semibold">{selectedItem.minimumOrderQuantity}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-ink-3 uppercase">Budget</label><p className={`mt-1 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${getBudgetBadgeColor(selectedItem.budget)}`}>{selectedItem.budget}</p></div>
          <div><label className="text-xs font-medium text-ink-3 uppercase">Status</label><p className={`mt-1 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${selectedItem.status === 'active' ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'}`}>{selectedItem.status}</p></div>
         </div>
        </div>
        <div className="space-y-4">
         <h3 className="font-semibold text-ink border-b pb-2">Materials & Specs</h3>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-ink-3 uppercase">Bottom Material</label><p className="text-ink">{selectedItem.bottomMaterial}</p></div>
          <div><label className="text-xs font-medium text-ink-3 uppercase">Cap Material</label><p className="text-ink">{selectedItem.capMaterial}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-ink-3 uppercase">Bottom Color</label><p className="text-ink">{selectedItem.bottomColor}</p></div>
          <div><label className="text-xs font-medium text-ink-3 uppercase">Cap Color</label><p className="text-ink">{selectedItem.capColor}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-ink-3 uppercase">Bottom Weight</label><p className="text-ink">{selectedItem.bottomWeight}</p></div>
          <div><label className="text-xs font-medium text-ink-3 uppercase">Cap Weight</label><p className="text-ink">{selectedItem.capWeight}</p></div>
         </div>
         <div><label className="text-xs font-medium text-ink-3 uppercase">Comments</label><p className="text-ink-2 text-sm">{selectedItem.comments || 'N/A'}</p></div>
        </div>
       </div>
      </div>
      <div className="sticky bottom-0 bg-surface-3 px-6 py-4 border-t flex justify-end gap-3">
       {isEditMode ? (
        <><button onClick={() => setIsEditMode(false)} className="px-4 py-2 text-ink-2 hover:bg-surface-3 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleUpdateItem} className="px-6 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand-press transition-colors">Save Changes</button></>
       ) : (
        <><button onClick={() => { setIsViewModalOpen(false); setSelectedItem(null); }} className="px-4 py-2 text-ink-2 hover:bg-surface-3 rounded-lg transition-colors">Close</button>
        <button onClick={() => setIsEditMode(true)} className="px-6 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand-press transition-colors">Edit Package</button></>
       )}
      </div>
     </div>
    </div>
   )}
  </div>
 );
};

export default PackagingManagement;
