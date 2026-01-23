import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

type TabType = 'create' | 'list';

interface Ingredient {
  id: number;
  name: string;
  description: string;
  category: string;
  percentage: string;
  status: string;
}

const INGREDIENTS_STORAGE_KEY = 'eisthetic_ingredients_items';

const defaultIngredients: Ingredient[] = [
  { id: 1, name: '3-METHOXY-4-HYDROXYCINNAMIC ACID', description: 'REDUCE OXIDATIVE STRESS AND FORMATION OF THYMINE DIMERS IN SKIN', category: 'SKIN CARE', percentage: '0.5', status: 'Active' },
  { id: 2, name: '3-O-ETHYL ASCORBIC ACID', description: 'TYROSINE INHIBITOR', category: 'SKIN CARE', percentage: '0.1', status: 'Active' },
  { id: 3, name: '3-O-ETHYL ASCORBIC ACID', description: 'TYROSINE INHIBITOR', category: 'SKIN CARE', percentage: '2', status: 'Active' },
  { id: 4, name: '3-O-ETHYL ASCORBIC ACID', description: 'SKIN LIGHTENER', category: 'SKIN CARE', percentage: '5', status: 'Active' },
  { id: 5, name: 'AC HAIR & SCALP COMPLEX', description: 'CELL RENEWAL, COLLAGEN PRODUCTION IN HUMAN DERMAL FIBROBLASTS', category: 'HAIR CARE', percentage: '0.1-1', status: 'Active' },
  { id: 6, name: 'ACB FRUIT MIX', description: 'WEAKENS THE CORNEOCYTE ADHESION ALONG THE STRATUM CORNEUM TO IMPROVE EXFOLIATION', category: 'SKIN CARE', percentage: '1', status: 'Active' },
  { id: 7, name: 'ADIPOLESS', description: 'PROTECTS FROM DEGRADATION ENZYMES (ANTI-ELASTASE ACTION)', category: 'SKIN CARE', percentage: '0.5', status: 'Active' },
  { id: 8, name: 'VITAMIN E ACETATE', description: 'ANTIOXIDANT PROTECTION AND SKIN CONDITIONING', category: 'SKIN CARE', percentage: '0.5-2', status: 'Active' },
  { id: 9, name: 'NIACINAMIDE', description: 'IMPROVES SKIN BARRIER AND REDUCES HYPERPIGMENTATION', category: 'SKIN CARE', percentage: '2-5', status: 'Active' },
  { id: 10, name: 'HYALURONIC ACID', description: 'INTENSE HYDRATION AND MOISTURE RETENTION', category: 'SKIN CARE', percentage: '0.1-2', status: 'Active' },
];

const ActiveIngredients = () => {
  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    try {
      const stored = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (error) { console.error('Error loading ingredients:', error); }
    return defaultIngredients;
  });

  useEffect(() => {
    localStorage.setItem(INGREDIENTS_STORAGE_KEY, JSON.stringify(ingredients));
  }, [ingredients]);

  const [formData, setFormData] = useState({
    ingredientName: '',
    description: '',
    percentage: '',
    category: ''
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const handleViewClick = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedIngredient(null);
  };

  const handleUpdateIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIngredient) {
      setIngredients(prev => prev.map(item => item.id === selectedIngredient.id ? selectedIngredient : item));
    }
    handleCloseModal();
  };

  const handleDeleteIngredient = (id: number) => {
    if (window.confirm('Are you sure you want to delete this ingredient?')) {
      setIngredients(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newIngredient: Ingredient = {
      id: Math.max(...ingredients.map(i => i.id)) + 1,
      name: formData.ingredientName.toUpperCase(),
      description: formData.description.toUpperCase(),
      category: formData.category,
      percentage: formData.percentage,
      status: 'Active'
    };
    setIngredients(prev => [...prev, newIngredient]);
    setFormData({ ingredientName: '', description: '', percentage: '', category: '' });
    setActiveTab('list');
  };

  const filteredItems = ingredients.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filteredItems.length / entriesPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const getCategoryBadgeColor = (category: string) => {
    switch (category.toUpperCase()) {
      case 'SKIN CARE': return 'bg-pink-100 text-pink-700';
      case 'HAIR CARE': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Active Ingredients</h1>
        <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
          <Link to="/" className="text-amber-600 hover:text-amber-800 hover:underline">Dashboard</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Active Ingredients</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 flex overflow-x-auto">
          <button onClick={() => setActiveTab('create')}
            className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'create' ? 'bg-amber-500 text-white rounded-tl-xl' : 'text-gray-600 hover:bg-gray-50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Create Active Ingredients
          </button>
          <button onClick={() => setActiveTab('list')}
            className={`px-6 py-4 font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            Active Ingredients List
            <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">{ingredients.length}</span>
          </button>
        </div>

        {activeTab === 'create' && (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="sm:w-48 text-sm font-medium text-gray-700">Active Ingredients Name *</label>
                <input type="text" name="ingredientName" value={formData.ingredientName} onChange={handleInputChange} required placeholder="Enter Active Ingredients Name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                <label className="sm:w-48 text-sm font-medium text-gray-700 pt-2">Description *</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} required placeholder="Enter Active Ingredients Description" rows={3}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="sm:w-48 text-sm font-medium text-gray-700">Percentage *</label>
                <input type="text" name="percentage" value={formData.percentage} onChange={handleInputChange} required placeholder="Enter Active Ingredients Percentage"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="sm:w-48 text-sm font-medium text-gray-700">Category *</label>
                <select name="category" value={formData.category} onChange={handleInputChange} required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Select Product Category</option>
                  <option value="SKIN CARE">Skin Care</option>
                  <option value="HAIR CARE">Hair Care</option>
                  <option value="antioxidant">Antioxidant</option>
                  <option value="vitamin">Vitamin</option>
                  <option value="peptide">Peptide</option>
                  <option value="acid">Acid</option>
                  <option value="botanical">Botanical Extract</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <button type="submit" className="px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Create Active Ingredients
              </button>
              <button type="button" onClick={() => setFormData({ ingredientName: '', description: '', percentage: '', category: '' })}
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
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option>
                </select>
                <span className="text-sm text-gray-600">entries</span>
              </div>
              <div className="relative w-full sm:w-auto">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search ingredients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {paginatedItems.map((item) => (
                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm truncate">{item.name}</h3>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">{item.description}</p>
                    </div>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getCategoryBadgeColor(item.category)}`}>{item.category}</span>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">{item.percentage}%</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleViewClick(item)} className="flex-1 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200">Edit</button>
                    <button onClick={() => handleDeleteIngredient(item.id)} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200">
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
                  <tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Ingredient Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Percentage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-amber-800 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4"><p className="font-medium text-gray-800 text-sm">{item.name}</p></td>
                      <td className="px-4 py-4"><p className="text-sm text-gray-600 max-w-xs truncate">{item.description}</p></td>
                      <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(item.category)}`}>{item.category}</span></td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-800">{item.percentage}%</td>
                      <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleViewClick(item)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteIngredient(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
              <p className="text-sm text-gray-600">Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, filteredItems.length)} of {filteredItems.length} entries</p>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 text-sm rounded-lg ${currentPage === page ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
                ))}
                {totalPages > 5 && <span className="px-2 py-1.5 text-gray-400">...</span>}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedIngredient && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                  <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Edit Active Ingredient</h2>
                    <button onClick={handleCloseModal} className="text-white/80 hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <form onSubmit={handleUpdateIngredient} className="p-6">
                    <div className="space-y-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Active Ingredients Name:</label>
                        <input type="text" value={selectedIngredient.name} onChange={(e) => setSelectedIngredient({...selectedIngredient, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Description:</label>
                        <textarea value={selectedIngredient.description} onChange={(e) => setSelectedIngredient({...selectedIngredient, description: e.target.value})} rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Percentage:</label>
                        <input type="text" value={selectedIngredient.percentage} onChange={(e) => setSelectedIngredient({...selectedIngredient, percentage: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Category:</label>
                        <select value={selectedIngredient.category} onChange={(e) => setSelectedIngredient({...selectedIngredient, category: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                          <option value="SKIN CARE">SKIN CARE</option><option value="HAIR CARE">HAIR CARE</option>
                          <option value="antioxidant">Antioxidant</option><option value="vitamin">Vitamin</option>
                          <option value="peptide">Peptide</option><option value="acid">Acid</option>
                          <option value="botanical">Botanical Extract</option>
                        </select></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Status:</label>
                        <select value={selectedIngredient.status} onChange={(e) => setSelectedIngredient({...selectedIngredient, status: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                          <option value="Active">Active</option><option value="Inactive">Inactive</option>
                        </select></div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                      <button type="submit" className="px-6 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors">Update Ingredient</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveIngredients;
