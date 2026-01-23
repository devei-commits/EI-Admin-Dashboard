import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ItemsProvider } from './context/ItemsContext'
import { ToastProvider } from './context/ToastContext'
import { VendorClientProvider } from './context/VendorClientContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from "./components/sidebar/sidebar"
import { monitorConnection } from './lib/performanceOptimization'

// Lazy loaded pages for better performance
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const RoleManagement = lazy(() => import('./pages/RoleManagement'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const OrderManagement = lazy(() => import('./pages/OrderManagement'))
const GoodReceivingPage = lazy(() => import('./pages/GoodReceivingPage'))
const OrderList = lazy(() => import('./pages/OrderList'))
const OrderHubPage = lazy(() => import('./pages/OrderHubPage'))
const CouponManagement = lazy(() => import('./pages/CouponManagement'))
const DiscountManagement = lazy(() => import('./pages/DiscountManagement'))
const CatalogueManagement = lazy(() => import('./pages/CatalogueManagement'))
const ActiveIngredients = lazy(() => import('./pages/ActiveIngredients'))
const EnquiryManagement = lazy(() => import('./pages/EnquiryManagement'))
const DoctorAppointments = lazy(() => import('./pages/DoctorAppointments'))
const ContactEnquiry = lazy(() => import('./pages/ContactEnquiry'))
const NewDevelopments = lazy(() => import('./pages/NewDevelopments'))
const ProductSamples = lazy(() => import('./pages/ProductSamples'))
const TreasuryApp = lazy(() => import('./pages/TreasuryApp'))
const PackagingRefactored = lazy(() => import('./pages/PackagingRefactored'))
const PackagingManagement = lazy(() => import('./pages/PackagingManagement'))
const RawMaterialRefactored = lazy(() => import('./pages/RawMaterialRefactored'))
const BOMRefactored = lazy(() => import('./pages/BOMRefactored'))
const ItemsMaster = lazy(() => import('./pages/ItemsMaster'))
const VendorClient = lazy(() => import('./pages/VendorClient'))
const SalesAndPurchase = lazy(() => import('./pages/SalesAndPurchase'))
const TaskManagement = lazy(() => import('./pages/TaskManagement'))
const PIS = lazy(() => import('./pages/PIS'))

// Loading spinner component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
      <p className="text-gray-500 font-medium">Loading...</p>
    </div>
  </div>
)

// Network status indicator
const NetworkStatus = ({ isOnline }: { isOnline: boolean }) => {
  if (isOnline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 bg-red-500 text-white px-4 py-2 text-center text-sm font-medium z-[9999]">
      ⚠️ You are offline. Some features may be limited.
    </div>
  );
}

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Layout component that conditionally renders the sidebar
const AppLayout = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const cleanup = monitorConnection(setIsOnline);
    return cleanup;
  }, []);

  // Handle login route
  if (location.pathname === '/login') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" replace />;
  }

  // Show loader while checking auth
  if (isLoading) {
    return <PageLoader />;
  }

  const isPISRoute = location.pathname === '/pis' || location.pathname.startsWith('/pis/');
  const isTreasuryRoute = location.pathname === '/treasury' || location.pathname.startsWith('/treasury/');
  const isOrderHubRoute = location.pathname === '/order-hub' || location.pathname.startsWith('/order-hub/');

  // If it's a PIS route, render PIS standalone without admin sidebar
  if (isPISRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/pis/*" element={<PIS />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    );
  }

  // If it's an Order Hub route, render Order Hub standalone without admin sidebar
  if (isOrderHubRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/order-hub/*" element={<OrderHubPage />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    );
  }

  // If it's a Treasury route, render Treasury standalone without admin sidebar
  if (isTreasuryRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/treasury/*" element={<TreasuryApp />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    );
  }

  // Otherwise render with admin sidebar
  return (
    <div className="flex flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 pt-14 md:pt-0 overflow-auto">
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/role-management" element={<RoleManagement />} />
              <Route path="/user-management" element={<UserManagement />} />
              <Route path="/order-management" element={<OrderManagement />} />
              <Route path="/good-receiving" element={<GoodReceivingPage />} />
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
              <Route path="/treasury" element={<TreasuryApp />} />
              <Route path="/packaging-management" element={<PackagingManagement />} />
              <Route path="/packaging" element={<PackagingRefactored />} />
              <Route path="/raw-material" element={<RawMaterialRefactored />} />
              <Route path="/bom" element={<BOMRefactored />} />
              <Route path="/items-master" element={<ItemsMaster />} />
              <Route path="/vendor-client" element={<VendorClient />} />
              <Route path="/sales-and-purchase" element={<SalesAndPurchase />} />
              <Route path="/task-management" element={<TaskManagement />} />
              {/* Catch-all route */}
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
};

const App = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const cleanup = monitorConnection(setIsOnline);
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NetworkStatus isOnline={isOnline} />
          <ToastProvider>
            <VendorClientProvider>
              <ItemsProvider>
                <ErrorBoundary>
                  <AppLayout />
                </ErrorBoundary>
              </ItemsProvider>
            </VendorClientProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

