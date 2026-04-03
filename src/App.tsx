import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ItemsProvider } from './context/ItemsContext'
import { ToastProvider } from './context/ToastContext'
import { VendorClientProvider } from './context/VendorClientContext'
import { GlobalStateProvider } from './context/GlobalStateContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import { ProtectedModuleRoute } from './components/ProtectedModuleRoute'
import Sidebar from "./components/Sidebar"
import { monitorConnection } from './lib/performanceOptimization'

// Lazy loaded pages for better performance
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const RoleManagement = lazy(() => import('./pages/RoleManagement'))
const UserManagement = lazy(() => import('./pages/UserManagement'))

const CatalogueManagement = lazy(() => import('./pages/CatalogueManagement'))
const ActiveIngredients = lazy(() => import('./pages/ActiveIngredients'))
const EnquiryManagement = lazy(() => import('./pages/EnquiryManagement'))
const DoctorAppointments = lazy(() => import('./pages/DoctorAppointments'))
const ContactEnquiry = lazy(() => import('./pages/ContactEnquiry'))
const NewDevelopments = lazy(() => import('./pages/NewDevelopments'))
const ProductSamples = lazy(() => import('./pages/ProductSamples'))
const TreasuryApp = lazy(() => import('./pages/TreasuryApp'))
const PackagingRefactored = lazy(() => import('./pages/PackagingForm'))
const PackagingManagement = lazy(() => import('./pages/PackagingManagement'))
const RawMaterialRefactored = lazy(() => import('./pages/RawMaterialForm'))
const BOMDashboard = lazy(() => import('./pages/BOMDashboard'))
const BOMRefactored = lazy(() => import('./pages/BOMForm'))
const VendorClient = lazy(() => import('./pages/VendorClient'))
const UniversalSwap = lazy(() => import('./pages/UniversalSwap'))
const UniversalSwapPage = lazy(() => import('./pages/UniversalSwapPage'))
const ItemGroups = lazy(() => import('./pages/ItemGroups'))
const ItemsList = lazy(() => import('./pages/ItemsList'))
const TaskManagement = lazy(() => import('./pages/TaskManagement'))
const PIS = lazy(() => import('./pages/PIS'))
const Procurement = lazy(() => import('./pages/procurement/index'))
const WarehousePage = lazy(() => import('./pages/WarehousePage'))
const Planning = lazy(() => import('./pages/Planning'))
const Production = lazy(() => import('./pages/Production'))
const Fulfillment = lazy(() => import('./pages/Fulfillment'))
const ClientHub = lazy(() => import('./pages/ClientHub'))
const FacilityManagement = lazy(() => import('./pages/FacilityManagement'))

// Loading spinner component
const PageLoader = () => (
       <div className="flex items-center justify-center min-h-screen bg-background">
              <div className="flex flex-col items-center gap-4">
                     <div className="w-12 h-12 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin"></div>
                     <p className="text-gray-500 font-medium">Loading...</p>
              </div>
       </div>
)

// Network status indicator
const NetworkStatus = ({ isOnline }: { isOnline: boolean }) => {
       if (isOnline) return null;
       return (
              <div className="fixed top-0 left-0 right-0 bg-red-500 text-white px-4 py-2 text-center text-sm font-medium z-9999">
                     You are offline. Some features may be limited.
              </div>
       );
}

// Layout component that conditionally renders the sidebar
const AppLayout = () => {
       const location = useLocation();
       const { isAuthenticated, isLoading } = useAuth();
       const [, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

       useEffect(() => {
              const cleanup = monitorConnection(setIsOnline);
              return cleanup;
       }, []);

       // Dynamic document title based on primary dashboard function
       useEffect(() => {
              const base = 'eiadmin';
              let suffix = '';

              const path = location.pathname || '';

              if (path === '/fulfillment' || path.startsWith('/fulfillment/')) suffix = 'Fulfillment';
              else if (path === '/planning' || path.startsWith('/planning/')) suffix = 'Planning';
              else if (path === '/production' || path.startsWith('/production/')) suffix = 'Production';
              else if (path === '/warehouse' || path.startsWith('/warehouse/')) suffix = 'Warehouse';
              else if (path === '/procurement' || path.startsWith('/procurement/')) suffix = 'Procurement';
              else if (path === '/pis' || path.startsWith('/pis/')) suffix = 'PIS';
              else if (path === '/treasury' || path.startsWith('/treasury/')) suffix = 'Treasury';
              else if (path === '/client-hub' || path.startsWith('/client-hub/')) suffix = 'Client Hub';
              else if (path.startsWith('/user-management')) suffix = 'User Management';
              else if (path.startsWith('/role-management')) suffix = 'Role Management';
              else if (path.startsWith('/catalogue-management')) suffix = 'Catalogue Management';
              else if (path.startsWith('/packaging')) suffix = 'Packaging';
              else if (path.startsWith('/raw-material')) suffix = 'Raw Materials';
              else if (path.startsWith('/bom')) suffix = 'BOM';
              else if (path.startsWith('/vendor-client')) suffix = 'Vendor & Client';
              else if (path.startsWith('/items-list')) suffix = 'Items List';
              else if (path.startsWith('/item-groups')) suffix = 'Item Groups';
              else if (path.startsWith('/universal-swap')) suffix = 'Universal Swap';
              else if (path.startsWith('/task-management')) suffix = 'Task Management';
              else if (path === '/' || path === '') suffix = 'Dashboard';

              document.title = suffix ? `${base} - ${suffix}` : base;
       }, [location.pathname]);

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
       const isProcurementRoute = location.pathname === '/procurement' || location.pathname.startsWith('/procurement/');
       const isWarehouseRoute = location.pathname === '/warehouse' || location.pathname.startsWith('/warehouse/');
       const isPlanningRoute = location.pathname === '/planning' || location.pathname.startsWith('/planning/');
       const isProductionRoute = location.pathname === '/production' || location.pathname.startsWith('/production/');
       const isFulfillmentRoute = location.pathname === '/fulfillment' || location.pathname.startsWith('/fulfillment/');
       const isClientHubRoute = location.pathname === '/client-hub' || location.pathname.startsWith('/client-hub/');

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

       if (isProcurementRoute) {
              return (
                     <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary>
                                   <Routes>
                                          <Route path="/procurement" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <Procurement />
                                                 </ProtectedModuleRoute>
                                          } />
                                   </Routes>
                            </ErrorBoundary>
                     </Suspense>
              );
       }

       if (isWarehouseRoute) {
              return (
                     <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary>
                                   <Routes>
                                          <Route path="/warehouse/*" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <WarehousePage />
                                                 </ProtectedModuleRoute>
                                          } />
                                   </Routes>
                            </ErrorBoundary>
                     </Suspense>
              );
       }

       if (isPlanningRoute) {
              return (
                     <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary>
                                   <Routes>
                                          <Route path="/planning" element={<Navigate to="/planning/pis-extracted" replace />} />
                                          <Route path="/planning/pis-extracted" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <Planning />
                                                 </ProtectedModuleRoute>
                                          } />
                                          <Route path="/planning/items-involved" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <Planning />
                                                 </ProtectedModuleRoute>
                                          } />
                                          <Route path="/planning/availability-summary" element={<Navigate to="/planning/pis-extracted" replace />} />
                                          <Route path="/planning/batches" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <Planning />
                                                 </ProtectedModuleRoute>
                                          } />
                                   </Routes>
                            </ErrorBoundary>
                     </Suspense>
              );
       }

       if (isProductionRoute) {
              return (
                     <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary>
                                   <Routes>
                                          <Route path="/production" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <Production />
                                                 </ProtectedModuleRoute>
                                          } />
                                   </Routes>
                            </ErrorBoundary>
                     </Suspense>
              );
       }

       if (isFulfillmentRoute) {
              return (
                     <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary>
                                   <Routes>
                                          <Route path="/fulfillment" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <Fulfillment />
                                                 </ProtectedModuleRoute>
                                          } />
                                   </Routes>
                            </ErrorBoundary>
                     </Suspense>
              );
       }

       if (isClientHubRoute) {
              return (
                     <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary>
                                   <Routes>
                                          <Route path="/client-hub" element={
                                                 <ProtectedModuleRoute moduleId="order-management">
                                                        <ClientHub />
                                                 </ProtectedModuleRoute>
                                          } />
                                   </Routes>
                            </ErrorBoundary>
                     </Suspense>
              );
       }

       // Otherwise render with admin sidebar
       return (
              <div className="flex flex-row min-h-screen bg-background">
                     <Sidebar />
                     <div className="flex-1 pt-14 md:pt-0 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
                            <Suspense fallback={<PageLoader />}>
                                   <ErrorBoundary>
                                          <Routes>
                                                 <Route path="/" element={<Dashboard />} />
                                                 <Route path="/role-management" element={
                                                        <ProtectedModuleRoute moduleId="role-management">
                                                               <RoleManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/user-management" element={
                                                        <ProtectedModuleRoute moduleId="user-management">
                                                               <UserManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/catalogue-management" element={
                                                        <ProtectedModuleRoute moduleId="catalogue-management">
                                                               <CatalogueManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/active-ingredients" element={
                                                        <ProtectedModuleRoute moduleId="active-ingredients">
                                                               <ActiveIngredients />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/enquiry-management" element={
                                                        <ProtectedModuleRoute moduleId="enquiry-management">
                                                               <EnquiryManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/doctor-appointments" element={
                                                        <ProtectedModuleRoute moduleId="doctor-appointments">
                                                               <DoctorAppointments />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/contact-enquiry" element={
                                                        <ProtectedModuleRoute moduleId="contact-enquiry">
                                                               <ContactEnquiry />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/new-developments" element={
                                                        <ProtectedModuleRoute moduleId="new-developments">
                                                               <NewDevelopments />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/product-samples" element={
                                                        <ProtectedModuleRoute moduleId="product-samples">
                                                               <ProductSamples />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/treasury" element={
                                                        <ProtectedModuleRoute moduleId="treasury">
                                                               <TreasuryApp />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/packaging-management" element={
                                                        <ProtectedModuleRoute moduleId="packaging-management">
                                                               <PackagingManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/packaging" element={
                                                        <ProtectedModuleRoute moduleId="inventory" subModuleId="packaging">
                                                               <PackagingRefactored />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/raw-material" element={
                                                        <ProtectedModuleRoute moduleId="inventory" subModuleId="raw-materials">
                                                               <RawMaterialRefactored />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/bom" element={
                                                        <ProtectedModuleRoute moduleId="inventory" subModuleId="bom">
                                                               <BOMDashboard />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/bom/new" element={
                                                        <ProtectedModuleRoute moduleId="inventory" subModuleId="bom">
                                                               <BOMRefactored />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/bom/:id" element={
                                                    <ProtectedModuleRoute moduleId="inventory" subModuleId="bom">
                                                        <BOMRefactored />
                                                    </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/universal-swap" element={
                                                        <ProtectedModuleRoute moduleId="inventory">
                                                               <UniversalSwap />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/universal-swap-page" element={
                                                        <ProtectedModuleRoute moduleId="inventory">
                                                               <UniversalSwapPage />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/item-groups" element={
                                                        <ProtectedModuleRoute moduleId="inventory">
                                                               <ItemGroups />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/items-list" element={
                                                        <ProtectedModuleRoute moduleId="inventory">
                                                               <ItemsList />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/vendor-client" element={
                                                        <ProtectedModuleRoute moduleId="vendor-client">
                                                               <VendorClient />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/task-management" element={
                                                        <ProtectedModuleRoute moduleId="task-management">
                                                               <TaskManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
                                                 <Route path="/facility-management" element={
                                                        <ProtectedModuleRoute moduleId="order-management">
                                                               <FacilityManagement />
                                                        </ProtectedModuleRoute>
                                                 } />
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
                                                        <GlobalStateProvider>
                                                               <ErrorBoundary>
                                                                      <AppLayout />
                                                               </ErrorBoundary>
                                                        </GlobalStateProvider>
                                                 </ItemsProvider>
                                          </VendorClientProvider>
                                   </ToastProvider>
                            </AuthProvider>
                     </BrowserRouter>
              </QueryClientProvider>
       )
}

export default App
