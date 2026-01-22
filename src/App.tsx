import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ItemsProvider } from './context/ItemsContext'
import { ToastProvider } from './context/ToastContext'
import { VendorClientProvider } from './context/VendorClientContext'
import Dashboard from './pages/Dashboard'
import RoleManagement from './pages/RoleManagement'
import UserManagement from './pages/UserManagement'
import OrderManagement from './pages/OrderManagement'
import OrderList from './pages/OrderList'
import OrderHub from './pages/OrderHub'
import OrderHubPage from './pages/OrderHubPage'
import CouponManagement from './pages/CouponManagement'
import DiscountManagement from './pages/DiscountManagement'
import CatalogueManagement from './pages/CatalogueManagement'
import ActiveIngredients from './pages/ActiveIngredients'
import EnquiryManagement from './pages/EnquiryManagement'
import DoctorAppointments from './pages/DoctorAppointments'
import ContactEnquiry from './pages/ContactEnquiry'
import NewDevelopments from './pages/NewDevelopments'
import ProductSamples from './pages/ProductSamples'
// ...existing code...
import Treasury from './pages/Treasury'
import PackagingRefactored from './pages/PackagingRefactored'
import RawMaterialRefactored from './pages/RawMaterialRefactored'
import BOMRefactored from './pages/BOMRefactored'
import ItemsMaster from './pages/ItemsMaster'
import VendorClient from './pages/VendorClient'
import SalesAndPurchase from './pages/SalesAndPurchase'
import Sidebar from "./components/sidebar/sidebar"
import PIS from './pages/PIS'

// Layout component that conditionally renders the sidebar
const AppLayout = () => {
  const location = useLocation();
  const isPISRoute = location.pathname === '/pis' || location.pathname.startsWith('/pis/');
  const isTreasuryRoute = location.pathname === '/treasury' || location.pathname.startsWith('/treasury/');
  const isOrderHubRoute = location.pathname === '/order-hub' || location.pathname.startsWith('/order-hub/');

  // If it's a PIS route, render PIS standalone without admin sidebar
  if (isPISRoute) {
    return (
      <Routes>
        <Route path="/pis/*" element={<PIS />} />
      </Routes>
    );
  }

  // If it's an Order Hub route, render Order Hub standalone without admin sidebar
  if (isOrderHubRoute) {
    return (
      <Routes>
        <Route path="/order-hub/*" element={<OrderHubPage />} />
      </Routes>
    );
  }

  // If it's a Treasury route, render Treasury standalone without admin sidebar
  if (isTreasuryRoute) {
    return (
      <Routes>
        <Route path="/treasury/*" element={<Treasury />} />
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
          <Route path="/active-ingredients" element={<ActiveIngredients />} />
          <Route path="/enquiry-management" element={<EnquiryManagement />} />
          <Route path="/doctor-appointments" element={<DoctorAppointments />} />
          <Route path="/contact-enquiry" element={<ContactEnquiry />} />
          <Route path="/new-developments" element={<NewDevelopments />} />
          <Route path="/product-samples" element={<ProductSamples />} />
// ...existing code...
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/packaging" element={<PackagingRefactored />} />
          <Route path="/raw-material" element={<RawMaterialRefactored />} />
          <Route path="/bom" element={<BOMRefactored />} />
          <Route path="/items-master" element={<ItemsMaster />} />
          <Route path="/vendor-client" element={<VendorClient />} />
          <Route path="/sales-and-purchase" element={<SalesAndPurchase />} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <VendorClientProvider>
          <ItemsProvider>
            <AppLayout />
          </ItemsProvider>
        </VendorClientProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App

