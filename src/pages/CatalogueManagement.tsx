import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput, Pagination } from '../components/ui';
import { ModalOverlay } from '../components/ui/ModalOverlay';

type TabType = 'create' | 'list';

interface CatalogueItem {
 id: string;
 productCode: string;
 brandName: string;
 genericName: string;
 productCategory: string;
 subCategory: string;
 skinType: string;
 productFormType: string;
 productSKU: string;
 productPrice: string;
 productColor: string;
 status: 'active' | 'inactive';
 createdAt: string;
 subCategoryCharacteristic: string;
 labelClaims: string;
 productDescription: string;
 productUsage: string;
 productIngredients: string;
 productMinPh: string;
 productFragrance: string;
 productTechnologyUsed: string;
 productSpecializations: string;
 customization: string;
 batchNo: string;
 productDescriptionCustomer: string;
 productCautions: string;
 productExcepients: string;
 productIndications: string;
 productApplicationArea: string;
 productMaxPh: string;
 productViscosity: string;
 productOtherSpecs: string;
 gridSubCategory: string;
 sale: string;
}

const CATALOGUE_STORAGE_KEY = 'eisthetic_catalogue_items';

const defaultCatalogueItems: CatalogueItem[] = [
 {
  id: 'CAT001', productCode: 'EI-SKC-001', brandName: 'Eisthetic Glow', genericName: 'Vitamin C Serum',
  productCategory: 'skincare', subCategory: 'Serums', skinType: 'All Skin Types', productFormType: 'Liquid',
  productSKU: 'SKU-001-30ML', productPrice: '2500', productColor: 'Clear Yellow', status: 'active',
  createdAt: '2024-01-15', subCategoryCharacteristic: 'Brightening', labelClaims: 'Vitamin C 15%, Anti-aging',
  productDescription: 'Advanced vitamin C serum', productUsage: 'Apply 2-3 drops morning and evening',
  productIngredients: 'Vitamin C, Hyaluronic Acid', productMinPh: '3.0', productFragrance: 'Citrus',
  productTechnologyUsed: 'Nano-encapsulation', productSpecializations: 'Anti-aging', customization: 'Standard',
  batchNo: 'B2024-001', productDescriptionCustomer: 'Brightening serum', productCautions: 'Avoid sunlight',
  productExcepients: 'Water, Glycerin', productIndications: 'Dark spots', productApplicationArea: 'Face',
  productMaxPh: '3.5', productViscosity: '100 cP', productOtherSpecs: 'Paraben-free', gridSubCategory: 'Premium', sale: 'retail'
 },
 {
  id: 'CAT002', productCode: 'EI-SKC-002', brandName: 'Eisthetic Hydra', genericName: 'Hyaluronic Moisturizer',
  productCategory: 'skincare', subCategory: 'Moisturizers', skinType: 'Dry Skin', productFormType: 'Cream',
  productSKU: 'SKU-002-50ML', productPrice: '1800', productColor: 'White', status: 'active',
  createdAt: '2024-01-20', subCategoryCharacteristic: 'Hydrating', labelClaims: 'Hyaluronic Acid 2%',
  productDescription: 'Intensive hydrating moisturizer', productUsage: 'Apply after serum',
  productIngredients: 'Hyaluronic Acid, Ceramides', productMinPh: '5.5', productFragrance: 'Unscented',
  productTechnologyUsed: 'Liposomal', productSpecializations: 'Hydration', customization: 'Standard',
  batchNo: 'B2024-002', productDescriptionCustomer: 'Deep hydrating', productCautions: 'External use only',
  productExcepients: 'Shea Butter', productIndications: 'Dry skin', productApplicationArea: 'Face & Neck',
  productMaxPh: '6.0', productViscosity: '5000 cP', productOtherSpecs: 'Fragrance-free', gridSubCategory: 'Standard', sale: 'wholesale'
 },
 {
  id: 'CAT003', productCode: 'EI-HRC-001', brandName: 'Eisthetic Silk', genericName: 'Keratin Hair Serum',
  productCategory: 'haircare', subCategory: 'Hair Serums', skinType: 'All Hair Types', productFormType: 'Liquid',
  productSKU: 'SKU-003-100ML', productPrice: '1200', productColor: 'Transparent', status: 'active',
  createdAt: '2024-02-01', subCategoryCharacteristic: 'Smoothening', labelClaims: 'Keratin enriched',
  productDescription: 'Professional keratin hair serum', productUsage: 'Apply on damp hair',
  productIngredients: 'Keratin, Argan Oil', productMinPh: '5.0', productFragrance: 'Floral',
  productTechnologyUsed: 'Micro-bonding', productSpecializations: 'Hair Repair', customization: 'Custom',
  batchNo: 'B2024-003', productDescriptionCustomer: 'Silky smooth hair', productCautions: 'Avoid eyes',
  productExcepients: 'Silicones', productIndications: 'Frizzy hair', productApplicationArea: 'Hair',
  productMaxPh: '5.5', productViscosity: '200 cP', productOtherSpecs: 'Heat protection', gridSubCategory: 'Professional', sale: 'retail'
 }
];

const CatalogueManagement = () => {
 const [activeTab, setActiveTab] = useState<TabType>('create');
 const [searchQuery, setSearchQuery] = useState('');
 const [entriesPerPage, setEntriesPerPage] = useState(10);
 const [currentPage, setCurrentPage] = useState(1);
 const [selectedItem, setSelectedItem] = useState<CatalogueItem | null>(null);
 const [isViewModalOpen, setIsViewModalOpen] = useState(false);
 const [isEditMode, setIsEditMode] = useState(false);

 const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>(() => {
  try {
   const stored = localStorage.getItem(CATALOGUE_STORAGE_KEY);
   if (stored) return JSON.parse(stored);
  } catch (_error) { /* parse error — fall back to defaults */ }
  return defaultCatalogueItems;
 });

 useEffect(() => {
  localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(catalogueItems));
 }, [catalogueItems]);

 const [formData, setFormData] = useState({
  productCode: '', brandName: '', productCategory: '', subCategoryCharacteristic: '', skinType: '',
  labelClaims: '', productDescription: '', productUsage: '', productIngredients: '', productMinPh: '',
  productFragrance: '', productTechnologyUsed: '', productSpecializations: '', customization: '',
  batchNo: '', genericName: '', subCategory: '', productFormType: '', productSKU: '',
  productDescriptionCustomer: '', productCautions: '', productPrice: '', productExcepients: '',
  productIndications: '', productApplicationArea: '', productColor: '', productMaxPh: '',
  productViscosity: '', productOtherSpecs: '', gridSubCategory: '', sale: ''
 });

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const newItem: CatalogueItem = {
   id: `CAT${String(catalogueItems.length + 1).padStart(3, '0')}`,
   ...formData,
   status: 'active',
   createdAt: new Date().toISOString().split('T')[0]
  };
  setCatalogueItems(prev => [...prev, newItem]);
  setFormData({
   productCode: '', brandName: '', productCategory: '', subCategoryCharacteristic: '', skinType: '',
   labelClaims: '', productDescription: '', productUsage: '', productIngredients: '', productMinPh: '',
   productFragrance: '', productTechnologyUsed: '', productSpecializations: '', customization: '',
   batchNo: '', genericName: '', subCategory: '', productFormType: '', productSKU: '',
   productDescriptionCustomer: '', productCautions: '', productPrice: '', productExcepients: '',
   productIndications: '', productApplicationArea: '', productColor: '', productMaxPh: '',
   productViscosity: '', productOtherSpecs: '', gridSubCategory: '', sale: ''
  });
  setActiveTab('list');
 };

 const handleViewItem = (item: CatalogueItem) => { setSelectedItem(item); setIsViewModalOpen(true); setIsEditMode(false); };
 const handleEditItem = (item: CatalogueItem) => { setSelectedItem(item); setIsViewModalOpen(true); setIsEditMode(true); };
 const handleUpdateItem = () => {
  if (!selectedItem) return;
  setCatalogueItems(prev => prev.map(item => item.id === selectedItem.id ? selectedItem : item));
  setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false);
 };
 const handleDeleteItem = (id: string) => {
  if (window.confirm('Are you sure you want to delete this catalogue item?')) {
   setCatalogueItems(prev => prev.filter(item => item.id !== id));
  }
 };
 const handleToggleStatus = (id: string) => {
  setCatalogueItems(prev => prev.map(item => item.id === id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item));
 };

 const filteredItems = catalogueItems.filter(item =>
  item.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
  item.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
  item.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
  item.productCategory.toLowerCase().includes(searchQuery.toLowerCase())
 );
 const totalPages = Math.ceil(filteredItems.length / entriesPerPage);
 const paginatedItems = filteredItems.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

 const getCategoryBadgeColor = (category: string) => {
  switch (category.toLowerCase()) {
   case 'skincare': return 'bg-pink-100 text-pink-700';
   case 'haircare': return 'bg-purple-100 text-purple-700';
   case 'bodycare': return 'bg-blue-100 text-blue-700';
   default: return 'bg-gray-100 text-gray-700';
  }
 };

 return (
  <div className="p-4 md:p-6 bg-gray-50/50 min-h-screen">
   {/* Header */}
   <div className="mb-4">
    <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">Catalogue Management</h1>
    <div className="flex items-center gap-2 mt-2 text-sm bg-gray-100 px-4 py-2 rounded-lg">
     <Link to="/" className="text-slate-800 hover:text-amber-800 hover:underline">Dashboard</Link>
     <span className="text-gray-400">/</span>
     <span className="text-gray-600">Catalogue Management</span>
    </div>
   </div>

   <div className="bg-white rounded-xl shadow-sm border border-gray-100">
    {/* Tab Headers */}
    <div className="border-b border-gray-200 flex overflow-x-auto">
     <button onClick={() => setActiveTab('create')}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'create' ? 'bg-slate-800 text-white rounded-tl-xl' : 'text-gray-600 hover:bg-gray-50'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      Create Catalogue
     </button>
     <button onClick={() => setActiveTab('list')}
      className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
      Catalogue List
      <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">{catalogueItems.length}</span>
     </button>
    </div>

    {activeTab === 'create' && (
     <form onSubmit={handleSubmit} className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
       <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Code *</label>
         <input type="text" name="productCode" value={formData.productCode} onChange={handleInputChange} required placeholder="Enter Product Code"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Brand Name *</label>
         <input type="text" name="brandName" value={formData.brandName} onChange={handleInputChange} required placeholder="Enter Brand Name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Category *</label>
         <select name="productCategory" value={formData.productCategory} onChange={handleInputChange} required
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">Select Product Category</option>
          <option value="skincare">Skincare</option>
          <option value="haircare">Haircare</option>
          <option value="bodycare">Bodycare</option>
         </select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Sub Category Characteristic</label>
         <input type="text" name="subCategoryCharacteristic" value={formData.subCategoryCharacteristic} onChange={handleInputChange} placeholder="Enter Sub Category"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Skin Type</label>
         <input type="text" name="skinType" value={formData.skinType} onChange={handleInputChange} placeholder="Enter Skin Type"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700 pt-2">Label Claims</label>
         <textarea name="labelClaims" value={formData.labelClaims} onChange={handleInputChange} placeholder="Enter Label Claims" rows={3}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700 pt-2">Product Description</label>
         <textarea name="productDescription" value={formData.productDescription} onChange={handleInputChange} placeholder="Product Description" rows={4}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700 pt-2">Product Usage</label>
         <textarea name="productUsage" value={formData.productUsage} onChange={handleInputChange} placeholder="Product Usage" rows={3}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Ingredients</label>
         <select name="productIngredients" value={formData.productIngredients} onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">None selected</option>
          <option value="Vitamin C, Hyaluronic Acid">Vitamin C, Hyaluronic Acid</option>
          <option value="Retinol, Peptides">Retinol, Peptides</option>
          <option value="Niacinamide, Ceramides">Niacinamide, Ceramides</option>
         </select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Min pH</label>
         <input type="text" name="productMinPh" value={formData.productMinPh} onChange={handleInputChange} placeholder="Enter Min pH"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Fragrance</label>
         <input type="text" name="productFragrance" value={formData.productFragrance} onChange={handleInputChange} placeholder="Enter Fragrance"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Technology Used</label>
         <input type="text" name="productTechnologyUsed" value={formData.productTechnologyUsed} onChange={handleInputChange} placeholder="Enter Technology"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Specializations</label>
         <select name="productSpecializations" value={formData.productSpecializations} onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">None selected</option>
          <option value="Anti-aging">Anti-aging</option>
          <option value="Brightening">Brightening</option>
          <option value="Hydration">Hydration</option>
         </select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Customization</label>
         <select name="customization" value={formData.customization} onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">Select Type</option>
          <option value="Standard">Standard</option>
          <option value="Custom">Custom</option>
         </select>
        </div>
       </div>
       <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Batch No</label>
         <input type="text" name="batchNo" value={formData.batchNo} onChange={handleInputChange} placeholder="Enter Batch Number"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Generic Name *</label>
         <input type="text" name="genericName" value={formData.genericName} onChange={handleInputChange} required placeholder="Enter Generic Name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Sub Category</label>
         <input type="text" name="subCategory" value={formData.subCategory} onChange={handleInputChange} placeholder="Enter Sub Category"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Form Type</label>
         <input type="text" name="productFormType" value={formData.productFormType} onChange={handleInputChange} placeholder="Enter Form Type"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product SKU</label>
         <input type="text" name="productSKU" value={formData.productSKU} onChange={handleInputChange} placeholder="Enter SKU"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700 pt-2">Customer Description</label>
         <textarea name="productDescriptionCustomer" value={formData.productDescriptionCustomer} onChange={handleInputChange} placeholder="Customer Description" rows={3}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700 pt-2">Cautions</label>
         <textarea name="productCautions" value={formData.productCautions} onChange={handleInputChange} placeholder="Product Cautions" rows={3}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Price</label>
         <input type="text" name="productPrice" value={formData.productPrice} onChange={handleInputChange} placeholder="Enter Price"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Excipients</label>
         <input type="text" name="productExcepients" value={formData.productExcepients} onChange={handleInputChange} placeholder="Enter Excipients"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Indications</label>
         <input type="text" name="productIndications" value={formData.productIndications} onChange={handleInputChange} placeholder="Enter Indications"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Application Area</label>
         <input type="text" name="productApplicationArea" value={formData.productApplicationArea} onChange={handleInputChange} placeholder="Enter Application Area"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Product Color</label>
         <input type="text" name="productColor" value={formData.productColor} onChange={handleInputChange} placeholder="Enter Color"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="grid grid-cols-2 gap-4">
         <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Max pH</label>
          <input type="text" name="productMaxPh" value={formData.productMaxPh} onChange={handleInputChange} placeholder="Max pH"
           className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
         </div>
         <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Viscosity</label>
          <input type="text" name="productViscosity" value={formData.productViscosity} onChange={handleInputChange} placeholder="Viscosity"
           className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" />
         </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
         <label className="sm:w-48 text-sm font-medium text-gray-700">Sale Type</label>
         <select name="sale" value={formData.sale} onChange={handleInputChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">Select Sale Type</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
         </select>
        </div>
       </div>
      </div>
      <div className="mt-8 flex gap-4">
       <button type="submit" className="px-6 py-2.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Create Product
       </button>
       <button type="button" onClick={() => setFormData({productCode: '', brandName: '', productCategory: '', subCategoryCharacteristic: '', skinType: '', labelClaims: '', productDescription: '', productUsage: '', productIngredients: '', productMinPh: '', productFragrance: '', productTechnologyUsed: '', productSpecializations: '', customization: '', batchNo: '', genericName: '', subCategory: '', productFormType: '', productSKU: '', productDescriptionCustomer: '', productCautions: '', productPrice: '', productExcepients: '', productIndications: '', productApplicationArea: '', productColor: '', productMaxPh: '', productViscosity: '', productOtherSpecs: '', gridSubCategory: '', sale: ''})}
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
        placeholder="Search catalogue..."
       />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
       {paginatedItems.map((item) => (
        <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
         <div className="flex justify-between items-start mb-3">
          <div>
           <span className="text-xs text-gray-500">{item.productCode}</span>
           <h3 className="font-semibold text-gray-800">{item.brandName}</h3>
           <p className="text-sm text-gray-600">{item.genericName}</p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span>
         </div>
         <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-2 py-1 text-xs rounded-full ${getCategoryBadgeColor(item.productCategory)}`}>{item.productCategory}</span>
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">₹{item.productPrice}</span>
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
      <div className="hidden md:block overflow-auto max-h-[70vh]">
       <table className="w-full">
        <thead className="sticky top-0 z-20">
         <tr className="bg-gray-50 border-b border-gray-200 [&_th]:bg-gray-50">
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Product Code</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Brand / Name</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Category</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">SKU</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Price</th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Status</th>
          <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-amber-800 uppercase tracking-wider">Actions</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
         {paginatedItems.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
           <td className="px-4 py-4"><span className="font-mono text-sm text-gray-600">{item.productCode}</span></td>
           <td className="px-4 py-4"><div><p className="font-medium text-gray-800">{item.brandName}</p><p className="text-sm text-gray-500">{item.genericName}</p></div></td>
           <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(item.productCategory)}`}>{item.productCategory}</span></td>
           <td className="px-4 py-4 text-sm text-gray-600">{item.productSKU}</td>
           <td className="px-4 py-4 text-sm font-medium text-gray-800">₹{item.productPrice}</td>
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
    <ModalOverlay onClose={() => { setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false); }} z="z-50" dismissable={false} backdrop="light">
     <div role="dialog" aria-modal="true" aria-label={isEditMode ? 'Edit Product' : 'Product Details'} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
      <div className="sticky top-0 bg-slate-800 px-6 py-4 flex justify-between items-center">
       <div><h2 className="text-xl font-bold text-white">{isEditMode ? 'Edit Product' : 'Product Details'}</h2><p className="text-gray-100 text-sm">{selectedItem.productCode}</p></div>
       <button onClick={() => { setIsViewModalOpen(false); setSelectedItem(null); setIsEditMode(false); }} className="text-white/80 hover:text-white transition-colors">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
       </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
         <h3 className="font-semibold text-gray-800 border-b pb-2">Basic Information</h3>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Brand Name</label>
          {isEditMode ? <input type="text" value={selectedItem.brandName} onChange={(e) => setSelectedItem({...selectedItem, brandName: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" /> : <p className="text-gray-800 font-medium">{selectedItem.brandName}</p>}</div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Generic Name</label>
          {isEditMode ? <input type="text" value={selectedItem.genericName} onChange={(e) => setSelectedItem({...selectedItem, genericName: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" /> : <p className="text-gray-800">{selectedItem.genericName}</p>}</div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Category</label><p className={`mt-1 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(selectedItem.productCategory)}`}>{selectedItem.productCategory}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Status</label><p className={`mt-1 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${selectedItem.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{selectedItem.status}</p></div>
         </div>
         <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">SKU</label><p className="text-gray-800 font-mono">{selectedItem.productSKU}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Price</label>
           {isEditMode ? <input type="text" value={selectedItem.productPrice} onChange={(e) => setSelectedItem({...selectedItem, productPrice: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800" /> : <p className="text-gray-800 font-semibold">₹{selectedItem.productPrice}</p>}</div>
         </div>
        </div>
        <div className="space-y-4">
         <h3 className="font-semibold text-gray-800 border-b pb-2">Product Details</h3>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Description</label><p className="text-gray-700 text-sm">{selectedItem.productDescription || 'N/A'}</p></div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Usage</label><p className="text-gray-700 text-sm">{selectedItem.productUsage || 'N/A'}</p></div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Ingredients</label><p className="text-gray-700 text-sm">{selectedItem.productIngredients || 'N/A'}</p></div>
         <div className="grid grid-cols-3 gap-4">
          <div><label className="text-xs font-medium text-gray-500 uppercase">Min pH</label><p className="text-gray-800">{selectedItem.productMinPh || 'N/A'}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Max pH</label><p className="text-gray-800">{selectedItem.productMaxPh || 'N/A'}</p></div>
          <div><label className="text-xs font-medium text-gray-500 uppercase">Color</label><p className="text-gray-800">{selectedItem.productColor || 'N/A'}</p></div>
         </div>
        </div>
       </div>
       <div className="mt-6 pt-6 border-t">
        <h3 className="font-semibold text-gray-800 mb-4">Additional Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
         <div><label className="text-xs font-medium text-gray-500 uppercase">Fragrance</label><p className="text-gray-800">{selectedItem.productFragrance || 'N/A'}</p></div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Technology</label><p className="text-gray-800">{selectedItem.productTechnologyUsed || 'N/A'}</p></div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Batch No</label><p className="text-gray-800 font-mono">{selectedItem.batchNo || 'N/A'}</p></div>
         <div><label className="text-xs font-medium text-gray-500 uppercase">Created</label><p className="text-gray-800">{selectedItem.createdAt}</p></div>
        </div>
       </div>
      </div>
      <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
       {isEditMode ? (
        <><button onClick={() => setIsEditMode(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleUpdateItem} className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors">Save Changes</button></>
       ) : (
        <><button onClick={() => { setIsViewModalOpen(false); setSelectedItem(null); }} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Close</button>
        <button onClick={() => setIsEditMode(true)} className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors">Edit Product</button></>
       )}
      </div>
     </div>
    </ModalOverlay>
   )}
  </div>
 );
};

export default CatalogueManagement;
