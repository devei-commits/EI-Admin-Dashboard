import { useState } from 'react';
import { Link } from 'react-router-dom';

type TabType = 'management' | 'list';

const PackagingManagement = () => {
  const [activeTab, setActiveTab] = useState<TabType>('management');
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
    // Form submission logic here
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Packaging Management</h1>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
          <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Packaging Management</span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('management')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'management'
                ? 'bg-blue-600 text-white rounded-tl-lg'
                : 'text-blue-600 hover:bg-gray-50'
            }`}
          >
            Packaging Management
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-blue-600 hover:bg-gray-50'
            }`}
          >
            Packaging List
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
            <div className="mt-6">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        )}

        {activeTab === 'list' && (
          <div className="p-6">
            <p className="text-gray-500">Packaging list will be displayed here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackagingManagement;
