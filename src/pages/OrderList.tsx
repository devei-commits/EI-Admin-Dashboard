import { Link } from 'react-router-dom';
import { OrderTable } from '../components/ordermanagementcomp';
import { UnifiedButton } from '../components/ui';

const OrderList = () => {
 return (
  <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
   <div className="mb-6">
    <div className="flex justify-between items-start">
     <div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Order Management</h1>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mt-2 text-sm bg-gray-100 px-4 py-2 rounded-lg">
       <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
        Dashboard
       </Link>
       <span className="text-gray-400">/</span>
       <span className="text-gray-600">Order Management</span>
      </div>
     </div>
     <UnifiedButton
      variant="primary"
      onClick={(e) => {
       e.preventDefault();
       const userRole = localStorage.getItem('adminUserRole') || 'SUPER_ADMIN';
       window.open(`/order-hub?role=${userRole}`, '_blank', 'noopener,noreferrer');
      }}
     >
      Open Tracker
     </UnifiedButton>
    </div>
   </div>
   <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
    <OrderTable />
   </div>
  </div>
 );
};

export default OrderList;
