import { useState } from 'react';
import { Link } from 'react-router-dom';

const CatalogueManagement = () => {
  const [formData, setFormData] = useState({
    productCode: '',
    brandName: '',
    productCategory: '',
    subCategoryCharacteristic: '',
    skinType: '',
    labelClaims: '',
    productDescription: '',
    productUsage: '',
    productIngredients: '',
    productMinPh: '',
    productFragrance: '',
    productTechnologyUsed: '',
    productSpecializations: '',
    customization: '',
    batchNo: '',
    genericName: '',
    subCategory: '',
    productFormType: '',
    productSKU: '',
    productDescriptionCustomer: '',
    productCautions: '',
    productPrice: '',
    productExcepients: '',
    productIndications: '',
    productApplicationArea: '',
    productColor: '',
    productMaxPh: '',
    productViscosity: '',
    productOtherSpecs: '',
    gridSubCategory: '',
    sale: ''
  });

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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Catalogue Management</h1>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
          <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Catalogue Management</span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Code</label>
                <input
                  type="text"
                  name="productCode"
                  value={formData.productCode}
                  onChange={handleInputChange}
                  placeholder="Enter Product Code"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Brand Name</label>
                <input
                  type="text"
                  name="brandName"
                  value={formData.brandName}
                  onChange={handleInputChange}
                  placeholder="Enter Batch Number"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Category</label>
                <select
                  name="productCategory"
                  value={formData.productCategory}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Product Category</option>
                  <option value="skincare">Skincare</option>
                  <option value="haircare">Haircare</option>
                  <option value="bodycare">Bodycare</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Sub Category Characteristic</label>
                <input
                  type="text"
                  name="subCategoryCharacteristic"
                  value={formData.subCategoryCharacteristic}
                  onChange={handleInputChange}
                  placeholder="Enter Product Sub Category"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Skin Type</label>
                <input
                  type="text"
                  name="skinType"
                  value={formData.skinType}
                  onChange={handleInputChange}
                  placeholder="Enter Product Skin Type"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-4">
                <label className="w-48 text-sm font-medium text-gray-700 pt-2">Label Claims</label>
                <textarea
                  name="labelClaims"
                  value={formData.labelClaims}
                  onChange={handleInputChange}
                  placeholder="Enter Product Label Claims"
                  rows={4}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-4">
                <label className="w-48 text-sm font-medium text-gray-700 pt-2">Product Description</label>
                <textarea
                  name="productDescription"
                  value={formData.productDescription}
                  onChange={handleInputChange}
                  placeholder="Product Description"
                  rows={5}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-4">
                <label className="w-48 text-sm font-medium text-gray-700 pt-2">Product Usage</label>
                <textarea
                  name="productUsage"
                  value={formData.productUsage}
                  onChange={handleInputChange}
                  placeholder="Product Usage"
                  rows={5}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Ingredients</label>
                <select
                  name="productIngredients"
                  value={formData.productIngredients}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None selected</option>
                  <option value="ingredient1">Ingredient 1</option>
                  <option value="ingredient2">Ingredient 2</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Min pH</label>
                <input
                  type="text"
                  name="productMinPh"
                  value={formData.productMinPh}
                  onChange={handleInputChange}
                  placeholder="Enter Product Min PH"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Fragrance</label>
                <input
                  type="text"
                  name="productFragrance"
                  value={formData.productFragrance}
                  onChange={handleInputChange}
                  placeholder="Enter Product Fragrance"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Technology Used</label>
                <input
                  type="text"
                  name="productTechnologyUsed"
                  value={formData.productTechnologyUsed}
                  onChange={handleInputChange}
                  placeholder="Enter Product Technology Used"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Specializations</label>
                <select
                  name="productSpecializations"
                  value={formData.productSpecializations}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None selected</option>
                  <option value="spec1">Specialization 1</option>
                  <option value="spec2">Specialization 2</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Customization</label>
                <select
                  name="customization"
                  value={formData.customization}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Customization Type</option>
                  <option value="custom1">Custom 1</option>
                  <option value="custom2">Custom 2</option>
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Batch No</label>
                <input
                  type="text"
                  name="batchNo"
                  value={formData.batchNo}
                  onChange={handleInputChange}
                  placeholder="Enter Batch Number"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Generic Name</label>
                <input
                  type="text"
                  name="genericName"
                  value={formData.genericName}
                  onChange={handleInputChange}
                  placeholder="Enter Batch Number"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Sub Category</label>
                <input
                  type="text"
                  name="subCategory"
                  value={formData.subCategory}
                  onChange={handleInputChange}
                  placeholder="Enter Product Sub Category"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Form Type</label>
                <input
                  type="text"
                  name="productFormType"
                  value={formData.productFormType}
                  onChange={handleInputChange}
                  placeholder="Enter Product Form Type"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product SKU</label>
                <input
                  type="text"
                  name="productSKU"
                  value={formData.productSKU}
                  onChange={handleInputChange}
                  placeholder="Enter Product SKU"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-4">
                <label className="w-48 text-sm font-medium text-gray-700 pt-2">Product Description Customer</label>
                <textarea
                  name="productDescriptionCustomer"
                  value={formData.productDescriptionCustomer}
                  onChange={handleInputChange}
                  placeholder="Product Description Customer"
                  rows={4}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-4">
                <label className="w-48 text-sm font-medium text-gray-700 pt-2">Product Cautions</label>
                <textarea
                  name="productCautions"
                  value={formData.productCautions}
                  onChange={handleInputChange}
                  placeholder="Product Cautions"
                  rows={5}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Price</label>
                <input
                  type="text"
                  name="productPrice"
                  value={formData.productPrice}
                  onChange={handleInputChange}
                  placeholder="Enter Product Price"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Excepients</label>
                <input
                  type="text"
                  name="productExcepients"
                  value={formData.productExcepients}
                  onChange={handleInputChange}
                  placeholder="Enter Product Excepients"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Indications</label>
                <input
                  type="text"
                  name="productIndications"
                  value={formData.productIndications}
                  onChange={handleInputChange}
                  placeholder="Enter Product Indications"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Application Area</label>
                <input
                  type="text"
                  name="productApplicationArea"
                  value={formData.productApplicationArea}
                  onChange={handleInputChange}
                  placeholder="Enter Product Application Area"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Color</label>
                <input
                  type="text"
                  name="productColor"
                  value={formData.productColor}
                  onChange={handleInputChange}
                  placeholder="Enter Product Color"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Max pH</label>
                <input
                  type="text"
                  name="productMaxPh"
                  value={formData.productMaxPh}
                  onChange={handleInputChange}
                  placeholder="Enter Product Max PH"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Viscosity</label>
                <input
                  type="text"
                  name="productViscosity"
                  value={formData.productViscosity}
                  onChange={handleInputChange}
                  placeholder="Enter Product Viscosity"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Product Other Specs</label>
                <input
                  type="text"
                  name="productOtherSpecs"
                  value={formData.productOtherSpecs}
                  onChange={handleInputChange}
                  placeholder="Enter Product Other Specifications"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Grid Sub Category</label>
                <input
                  type="text"
                  name="gridSubCategory"
                  value={formData.gridSubCategory}
                  onChange={handleInputChange}
                  placeholder="Grid Sub Category"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700">Sale</label>
                <select
                  name="sale"
                  value={formData.sale}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Sale Type</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Create New Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CatalogueManagement;
