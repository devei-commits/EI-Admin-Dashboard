import { useState } from 'react';
import { Link } from 'react-router-dom';

type TabType = 'category' | 'products';

const DiscountManagement = () => {
  const [activeTab, setActiveTab] = useState<TabType>('category');
  const [categoryFormData, setCategoryFormData] = useState({
    productCategory: '',
    subProductCategory: '',
    discountType: '',
    discountValue: ''
  });
  const [productFormData, setProductFormData] = useState({
    product: '',
    discountType: '',
    discountValue: ''
  });

  const handleCategoryInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCategoryFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProductInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Category form submitted:', categoryFormData);
    // Add your submit logic here
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Product form submitted:', productFormData);
    // Add your submit logic here
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Discount Management</h1>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
          <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Discount Management</span>
        </div>
      </div>

      {/* Discount Management Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('category')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'category'
                ? 'bg-blue-600 text-white rounded-tl-lg'
                : 'text-blue-600 hover:bg-gray-50'
            }`}
          >
            Discounts by Category
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white'
                : 'text-blue-600 hover:bg-gray-50'
            }`}
          >
            Discounts by Products
          </button>
        </div>

        {/* Form Content */}
        {activeTab === 'category' ? (
          <form onSubmit={handleCategorySubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Product Category */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Product Category
                  </label>
                  <select
                    name="productCategory"
                    value={categoryFormData.productCategory}
                    onChange={handleCategoryInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Product Category</option>
                    <option value="skincare">Skincare</option>
                    <option value="haircare">Haircare</option>
                    <option value="bodycare">Bodycare</option>
                  </select>
                </div>

                {/* Discount Type */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Discount Type
                  </label>
                  <select
                    name="discountType"
                    value={categoryFormData.discountType}
                    onChange={handleCategoryInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Discount Type</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Sub Product Category */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Sub Product Category
                  </label>
                  <select
                    name="subProductCategory"
                    value={categoryFormData.subProductCategory}
                    onChange={handleCategoryInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sub Product Category</option>
                    <option value="moisturizers">Moisturizers</option>
                    <option value="serums">Serums</option>
                    <option value="cleansers">Cleansers</option>
                  </select>
                </div>

                {/* Discount Value */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Discount Value
                  </label>
                  <input
                    type="text"
                    name="discountValue"
                    value={categoryFormData.discountValue}
                    onChange={handleCategoryInputChange}
                    placeholder="Enter Discount Value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-center">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleProductSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Product */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Product
                  </label>
                  <select
                    name="product"
                    value={productFormData.product}
                    onChange={handleProductInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Product</option>
                    <option value="product1">Product 1</option>
                    <option value="product2">Product 2</option>
                    <option value="product3">Product 3</option>
                  </select>
                </div>

                {/* Discount Type */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Discount Type
                  </label>
                  <select
                    name="discountType"
                    value={productFormData.discountType}
                    onChange={handleProductInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Discount Type</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Discount Value */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 text-right">
                    Discount Value
                  </label>
                  <input
                    type="text"
                    name="discountValue"
                    value={productFormData.discountValue}
                    onChange={handleProductInputChange}
                    placeholder="Enter Discount Value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-center">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default DiscountManagement;
