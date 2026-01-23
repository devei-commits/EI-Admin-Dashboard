import { useState } from 'react';
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

const ActiveIngredients = () => {
  const [activeTab, setActiveTab] = useState<TabType>('create');
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
    // Update ingredient logic here
    handleCloseModal();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic here
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Active Ingredients</h1>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
          <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Active Ingredients</span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white rounded-tl-lg'
                : 'text-blue-600 hover:bg-gray-50'
            }`}
          >
            Create Active Ingredients
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-blue-600 hover:bg-gray-50'
            }`}
          >
            Active Ingredients List
          </button>
        </div>

        {/* Form Content */}
        {activeTab === 'create' && (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="max-w-2xl space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Active Ingredients Name:
                </label>
                <input
                  type="text"
                  name="ingredientName"
                  value={formData.ingredientName}
                  onChange={handleInputChange}
                  placeholder="Enter Active Ingredients Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description:
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter Active Ingredients Description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage:
                </label>
                <input
                  type="text"
                  name="percentage"
                  value={formData.percentage}
                  onChange={handleInputChange}
                  placeholder="Enter Active Ingredients Percentage"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category:
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Product Category</option>
                  <option value="antioxidant">Antioxidant</option>
                  <option value="vitamin">Vitamin</option>
                  <option value="peptide">Peptide</option>
                  <option value="acid">Acid</option>
                  <option value="botanical">Botanical Extract</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="submit"
                className="px-6 py-2 bg-teal-600 text-white font-medium rounded hover:bg-teal-700 transition-colors"
              >
                Create Active Ingredients
              </button>
            </div>
          </form>
        )}

        {activeTab === 'list' && (
          <>
            <div className="p-6">
              {/* Table Controls */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show</span>
                <select className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span className="text-sm text-gray-600">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Search:</span>
                <input
                  type="text"
                  className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                      Active Ingredients Name
                      <svg className="inline w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                      Active Description
                      <svg className="inline w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                      Active Category
                      <svg className="inline w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                      Active Percentage
                      <svg className="inline w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                      Active Ingredients Status
                      <svg className="inline w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">view</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">3-METHOXY-4-HYDROXYCINNAMIC ACID</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">REDUCE OXIDATIVE STRESS AND FORMATION OF THYMINE DIMERS IN SKIN</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">0.5</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 1,
                          name: '3-METHOXY-4-HYDROXYCINNAMIC ACID',
                          description: 'REDUCE OXIDATIVE STRESS AND FORMATION OF THYMINE DIMERS IN SKIN',
                          category: 'SKIN CARE',
                          percentage: '0.5',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">3-O-ETHYL ASCORBIC ACID</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">TYROSINE INHIBITOR</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">0.1</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 3,
                          name: '3-O-ETHYL ASCORBIC ACID',
                          description: 'TYROSINE INHIBITOR',
                          category: 'SKIN CARE',
                          percentage: '0.2',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">3-O-ETHYL ASCORBIC ACID</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">TYROSINE INHIBITOR</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">2</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 4,
                          name: '3-O-ETHYL ASCORBIC ACID',
                          description: 'TYROSINE INHIBITOR',
                          category: 'SKIN CARE',
                          percentage: '2',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">3-O-ETHYL ASCORBIC ACID</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">TYROSINE INHIBITOR</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">5</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 5,
                          name: '3-O-ETHYL ASCORBIC ACID',
                          description: 'TYROSINE INHIBITOR',
                          category: 'SKIN CARE',
                          percentage: '5',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">3-O-ETHYL ASCORBIC ACID</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN LIGHTENER</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">10</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 6,
                          name: '3-O-ETHYL ASCORBIC ACID',
                          description: 'SKIN LIGHTENER',
                          category: 'SKIN CARE',
                          percentage: '10',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">3-O-ETHYL ASCORBIC ACID</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">TYROSINE INHIBITOR</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">0.5</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 7,
                          name: '3-O-ETHYL ASCORBIC ACID',
                          description: 'TYROSINE INHIBITOR',
                          category: 'SKIN CARE',
                          percentage: '0.5',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">AC HAIR & SCALP COMPLEX</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">CELL RENEWAL, COLLAGEN PRODUCTION IN HUMAN DERMAL FIBROBLASTS, REGULATE KEY GENES RESPONSIBLE FOR COLLAGEN PRODUCTION AND THE FRUIT EXTRACTS IN IT OFFER NATURAL EXFOLIATING ACTION THROUGH THE ACTION OF A-HYDROXY-ACIDS PROMOTING CELL RENEWAL ON THE SCALP</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">HAIR CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">0.1-1</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 8,
                          name: 'AC HAIR & SCALP COMPLEX',
                          description: 'CELL RENEWAL, COLLAGEN PRODUCTION IN HUMAN DERMAL FIBROBLASTS, REGULATE KEY GENES RESPONSIBLE FOR COLLAGEN PRODUCTION AND THE FRUIT EXTRACTS IN IT OFFER NATURAL EXFOLIATING ACTION THROUGH THE ACTION OF A-HYDROXY-ACIDS PROMOTING CELL RENEWAL ON THE SCALP',
                          category: 'HAIR CARE',
                          percentage: '0.1-1',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">ACB FRUIT MIX</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">WEAKENS THE CORNEOCYTE ADHESION ALONG THE STRATUM CORNEUM TO IMPROVE EXFOLIATION AND ENHANCE CELLULAR PROLIFERATION</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">1</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 9,
                          name: 'ACB FRUIT MIX',
                          description: 'WEAKENS THE CORNEOCYTE ADHESION ALONG THE STRATUM CORNEUM TO IMPROVE EXFOLIATION AND ENHANCE CELLULAR PROLIFERATION',
                          category: 'SKIN CARE',
                          percentage: '1',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">ADIPOLESS</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">PROTECTS FROM DEGRADATION ENZYMES (ANTI-ELASTASE ACTION)</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">SKIN CARE</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">0.5</td>
                    <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">Active</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button 
                        onClick={() => handleViewClick({
                          id: 10,
                          name: 'ADIPOLESS',
                          description: 'PROTECTS FROM DEGRADATION ENZYMES (ANTI-ELASTASE ACTION)',
                          category: 'SKIN CARE',
                          percentage: '0.5',
                          status: 'Active'
                        })}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600">Showing 1 to 10 of 444 entries</p>
              <div className="flex gap-1">
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Previous</button>
                <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">1</button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">2</button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">3</button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">4</button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">5</button>
                <span className="px-3 py-1 text-sm text-gray-600">...</span>
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">45</button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Next</button>
              </div>
            </div>
          </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedIngredient && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Edit Active Ingredient</h2>
                    <button
                      onClick={handleCloseModal}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <form onSubmit={handleUpdateIngredient} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Active Ingredients Name:
                        </label>
                        <input
                          type="text"
                          value={selectedIngredient.name}
                          onChange={(e) => setSelectedIngredient({...selectedIngredient, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description:
                        </label>
                        <textarea
                          value={selectedIngredient.description}
                          onChange={(e) => setSelectedIngredient({...selectedIngredient, description: e.target.value})}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Percentage:
                        </label>
                        <input
                          type="text"
                          value={selectedIngredient.percentage}
                          onChange={(e) => setSelectedIngredient({...selectedIngredient, percentage: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category:
                        </label>
                        <select
                          value={selectedIngredient.category}
                          onChange={(e) => setSelectedIngredient({...selectedIngredient, category: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="SKIN CARE">SKIN CARE</option>
                          <option value="HAIR CARE">HAIR CARE</option>
                          <option value="antioxidant">Antioxidant</option>
                          <option value="vitamin">Vitamin</option>
                          <option value="peptide">Peptide</option>
                          <option value="acid">Acid</option>
                          <option value="botanical">Botanical Extract</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status:
                        </label>
                        <select
                          value={selectedIngredient.status}
                          onChange={(e) => setSelectedIngredient({...selectedIngredient, status: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-teal-600 text-white font-medium rounded hover:bg-teal-700 transition-colors"
                      >
                        Update Ingredient
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActiveIngredients;
