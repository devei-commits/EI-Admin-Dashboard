import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RoleManagement from './pages/RoleManagement'
import UserManagement from './pages/UserManagement'
import OrderManagement from './pages/OrderManagement'
import OrderList from './pages/OrderList'
import CouponManagement from './pages/CouponManagement'
import DiscountManagement from './pages/DiscountManagement'
import CatalogueManagement from './pages/CatalogueManagement'
import PackagingManagement from './pages/PackagingManagement'
import ActiveIngredients from './pages/ActiveIngredients'
import EnquiryManagement from './pages/EnquiryManagement'
import DoctorAppointments from './pages/DoctorAppointments'
import ContactEnquiry from './pages/ContactEnquiry'
import NewDevelopments from './pages/NewDevelopments'
import ProductSamples from './pages/ProductSamples'
import Sidebar from "./components/sidebar/sidebar"
import PIS from './pages/PIS'

// Layout component that conditionally renders the sidebar
const AppLayout = () => {
  const location = useLocation();
  const isPISRoute = location.pathname === '/pis' || location.pathname.startsWith('/pis/');

  // If it's a PIS route, render PIS standalone without admin sidebar
  if (isPISRoute) {
    return (
      <Routes>
        <Route path="/pis/*" element={<PIS />} />
      </Routes>
    );
  }

  // Otherwise render with admin sidebar
  return (
    <div className="flex flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 pt-14 md:pt-0 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/role-management" element={<RoleManagement />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/order-management" element={<OrderManagement />} />
          <Route path="/order-list" element={<OrderList />} />
          <Route path="/coupon-management" element={<CouponManagement />} />
          <Route path="/discount-management" element={<DiscountManagement />} />
          <Route path="/catalogue-management" element={<CatalogueManagement />} />
          <Route path="/packaging-management" element={<PackagingManagement />} />
          <Route path="/active-ingredients" element={<ActiveIngredients />} />
          <Route path="/enquiry-management" element={<EnquiryManagement />} />
          <Route path="/doctor-appointments" element={<DoctorAppointments />} />
          <Route path="/contact-enquiry" element={<ContactEnquiry />} />
          <Route path="/new-developments" element={<NewDevelopments />} />
          <Route path="/product-samples" element={<ProductSamples />} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App

