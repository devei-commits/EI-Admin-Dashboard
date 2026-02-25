import { useState } from 'react';
import { Link } from 'react-router-dom';

const CouponManagement = () => {
 const [formData, setFormData] = useState({
  couponCode: '',
  promotionName: '',
  discountType: '',
  discountValue: ''
 });

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({
   ...prev,
   [name]: value
  }));
 };

 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // Add your submit logic here
 };

 return (
  <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
   {/* Header */}
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Coupon Management</h1>
    {/* Breadcrumb */}
    <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
     <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
      Dashboard
     </Link>
     <span className="text-gray-400">/</span>
     <span className="text-gray-600">Coupon Management</span>
    </div>
   </div>

   {/* Coupon Management Form */}
   <div className="bg-white rounded-xl shadow-sm border border-gray-100">
    {/* Tab Header */}
    <div className="border-b border-gray-200">
     <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-t-lg">
      Coupon Management
     </button>
    </div>

    {/* Form Content */}
    <form onSubmit={handleSubmit} className="p-6">
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-4">
       {/* Coupon Code */}
       <div className="flex items-center gap-4">
        <label className="w-32 text-sm font-medium text-gray-700 text-right">
         Coupon Code
        </label>
        <input
         type="text"
         name="couponCode"
         value={formData.couponCode}
         onChange={handleInputChange}
         placeholder="Enter Coupon Code"
         className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
       </div>

       {/* Discount Type */}
       <div className="flex items-center gap-4">
        <label className="w-32 text-sm font-medium text-gray-700 text-right">
         Discount Type
        </label>
        <select
         name="discountType"
         value={formData.discountType}
         onChange={handleInputChange}
         className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
         <option value="">Discount Type</option>
         <option value="percentage">Percentage</option>
         <option value="fixed">Fixed Amount</option>
        </select>
       </div>
      </div>

      {/* Right Column */}
      <div className="space-y-4">
       {/* Promotion Name */}
       <div className="flex items-center gap-4">
        <label className="w-32 text-sm font-medium text-gray-700 text-right">
         Promotion Name
        </label>
        <input
         type="text"
         name="promotionName"
         value={formData.promotionName}
         onChange={handleInputChange}
         placeholder="Enter Promotion Name"
         className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
       </div>

       {/* Discount Value */}
       <div className="flex items-center gap-4">
        <label className="w-32 text-sm font-medium text-gray-700 text-right">
         Discount Value
        </label>
        <input
         type="text"
         name="discountValue"
         value={formData.discountValue}
         onChange={handleInputChange}
         placeholder="Enter Discount Value"
         className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
       </div>
      </div>
     </div>

     {/* Submit Button */}
     <div className="mt-6">
      <button
       type="submit"
       className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
      >
       Submit
      </button>
     </div>
    </form>
   </div>
  </div>
 );
};

export default CouponManagement;
