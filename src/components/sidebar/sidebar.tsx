import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import eilogofull from "../../assets/logo/eilogofull.svg";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasModuleAccess, isAdmin } = usePermissions();

  // Permission check helpers
  const canAccess = (moduleId: string) => isAdmin || hasModuleAccess(moduleId);

  // Check which menu sections should be visible based on permissions
  const showDashboard = canAccess('dashboard');
  const showPIS = canAccess('pis');
  const showRoleManagement = canAccess('role-management');
  const showUserManagement = canAccess('user-management');
  const showTaskManagement = canAccess('task-management');
  const showTreasury = canAccess('treasury');

  // Order Management section
  const showOrderManagement = canAccess('order-management');
  const showOrderSection = showOrderManagement;

  // Enquiry section
  const showEnquiryManagement = canAccess('enquiry-management');
  const showDoctorAppointments = canAccess('doctor-appointments');
  const showContactEnquiry = canAccess('contact-enquiry');
  const showNewDevelopments = canAccess('new-developments');
  const showProductSamples = canAccess('product-samples');
  const showEnquirySection = showEnquiryManagement || showDoctorAppointments || showContactEnquiry || showNewDevelopments || showProductSamples;

  // Product Management section
  const showCatalogueManagement = canAccess('catalogue-management');
  const showPackagingManagement = canAccess('packaging-management');
  const showActiveIngredients = canAccess('active-ingredients');
  const showProductSection = showCatalogueManagement || showPackagingManagement || showActiveIngredients;

  // Masters section
  const showInventory = canAccess('inventory');
  const showItemsMaster = canAccess('items-master');
  const showVendorClient = canAccess('vendor-client');
  const showSalesPurchase = canAccess('sales-purchase');
  const showMastersSection = showInventory || showItemsMaster || showVendorClient || showSalesPurchase;

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Check if any enquiry submenu item is active
  const isEnquiryActive = [
    '/enquiry-management',
    '/doctor-appointments',
    '/contact-enquiry',
    '/new-developments',
    '/product-samples'
  ].includes(location.pathname);

  // Check if any order submenu item is active
  const isOrderActive = [
    '/good-receiving',
    '/order-management',
    '/ordered-products',
    '/procurement',
    '/po',
    '/bmr-bpr'
  ].includes(location.pathname);

  // Check if any product submenu item is active
  const isProductActive = [
    '/catalogue-management',
    '/packaging-management',
    '/active-ingredients'
  ].includes(location.pathname);

  // Check if any masters submenu item is active
  const isMastersActive = [
    '/packaging',
    '/raw-material',
    '/bom',
    '/items-master',
    '/vendor-client',
    '/sales-and-purchase',
    '/universal-swap',
    '/item-groups',
    '/items-list'
  ].includes(location.pathname);

  // Auto-open dropdown when navigating to enquiry pages, close when navigating away
  useEffect(() => {
    if (isEnquiryActive && !enquiryOpen) {
      setEnquiryOpen(true);
    } else if (!isEnquiryActive && enquiryOpen) {
      setEnquiryOpen(false);
    }
  }, [isEnquiryActive]);

  // Auto-open dropdown when navigating to order pages, close when navigating away
  useEffect(() => {
    if (isOrderActive && !orderOpen) {
      setOrderOpen(true);
    } else if (!isOrderActive && orderOpen) {
      setOrderOpen(false);
    }
  }, [isOrderActive]);

  // Auto-open dropdown when navigating to product pages, close when navigating away
  useEffect(() => {
    if (isProductActive && !productOpen) {
      setProductOpen(true);
    } else if (!isProductActive && productOpen) {
      setProductOpen(false);
    }
  }, [isProductActive]);

  // Auto-open Masters when navigating to a Masters page, close when navigating away
  useEffect(() => {
    if (isMastersActive && !mastersOpen) {
      setMastersOpen(true);
    } else if (!isMastersActive && mastersOpen) {
      setMastersOpen(false);
    }
  }, [isMastersActive]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${isActive
      ? "bg-gray-50 text-slate-900 font-semibold border-l-4 border-slate-800"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
    }`;

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-gray-200 z-50 flex items-center px-4 shadow-sm">
        <button
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
        <img src={eilogofull} alt="Logo" className="h-8 ml-3 object-contain" />
      </div>

      {/* Overlay - Mobile Only */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-white/60 backdrop-blur-md z-30 mt-14"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:sticky md:top-0 h-screen md:h-screen flex flex-col bg-background border-r border-gray-200 z-40 transition-transform duration-300 ease-in-out w-64 shadow-sm
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          mt-14 md:mt-0`}
      >
        {/* Logo Section - Hidden on mobile since it's in the header */}
        <div className="hidden md:flex p-5 items-center justify-center border-b border-gray-100 bg-transparent">
          <img src={eilogofull} alt="Logo" className="max-h-10 max-w-full object-contain" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-3">Menu</p>
          <ul className="space-y-1">
            {showDashboard && (
              <li>
                <NavLink to="/" className={linkClass} onClick={handleLinkClick}>
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="font-medium">Dashboard</span>
                </NavLink>
              </li>
            )}
            {showPIS && (
              <li>
                <button
                  onClick={() => {
                    handleLinkClick();
                    // Get current user role from admin panel and pass to PIS
                    // For now, default to SUPER_ADMIN - this should be updated when admin auth is implemented
                    const userRole = localStorage.getItem('adminUserRole') || 'SUPER_ADMIN';
                    window.open(`/pis?role=${userRole}`, '_blank');
                  }}
                  className="flex items-center px-4 py-3 rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent w-full text-left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                  </svg>
                  <span className="font-medium">PIS</span>
                  <svg className="w-4 h-4 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </li>
            )}
            {showRoleManagement && (
              <li>
                <NavLink to="/role-management" className={linkClass} onClick={handleLinkClick}>
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="font-medium">Role Management</span>
                </NavLink>
              </li>
            )}
            {showUserManagement && (
              <li>
                <NavLink to="/user-management" className={linkClass} onClick={handleLinkClick}>
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="font-medium">User Management</span>
                </NavLink>
              </li>
            )}
            {showTaskManagement && (
              <li>
                <NavLink to="/task-management" className={linkClass} onClick={handleLinkClick}>
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="font-medium">Task Management</span>
                </NavLink>
              </li>
            )}
            {showOrderSection && (
              <li>
                <div className={`rounded-lg transition-all duration-200 ${isOrderActive || orderOpen
                  ? "bg-gray-50 text-slate-900 font-semibold border-l-4 border-slate-800"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
                  }`}>
                  <div className="flex items-center">
                    <NavLink
                      to="/order-management"
                      onClick={() => { setOrderOpen(true); handleLinkClick(); }}
                      className="flex-1 flex items-center px-4 py-3 text-left w-full"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span className="font-medium">Order Management</span>
                    </NavLink>
                    <button
                      onClick={() => setOrderOpen(!orderOpen)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-300 ease-in-out ${orderOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Submenu with smooth animation */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${orderOpen ? "max-h-96" : "max-h-0"
                    }`}
                >
                  <ul className="ml-6 border-l-2 border-slate-100 pl-3 py-2 my-1 space-y-1.5">
                    <li>
                      <NavLink
                        to="/order-management"
                        className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                          ? "text-slate-900 font-medium bg-slate-100/50"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        onClick={handleLinkClick}
                      >
                        <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>CPO/SO</span>
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/ordered-products"
                        className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                          ? "text-slate-900 font-medium bg-slate-100/50"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        onClick={handleLinkClick}
                      >
                        <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>Ordered Products</span>
                      </NavLink>
                    </li>
                    <li>
                      <a
                        href="/procurement"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                        onClick={handleLinkClick}
                      >
                        <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Procurement</span>
                        <svg className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                        </svg>
                      </a>
                    </li>
                    <li>
                      <NavLink
                        to="/po"
                        className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                          ? "text-slate-900 font-medium bg-slate-100/50"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        onClick={handleLinkClick}
                      >
                        <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>PO</span>
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/bmr-bpr"
                        className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                          ? "text-slate-900 font-medium bg-slate-100/50"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        onClick={handleLinkClick}
                      >
                        <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>BMR/BPR</span>
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
            )}
            {showProductSection && (
              <li>
                <div className={`rounded-lg transition-all duration-200 ${isProductActive || productOpen
                  ? "bg-gray-50 text-slate-900 font-semibold border-l-4 border-slate-800"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
                  }`}>
                  <div className="flex items-center">
                    <NavLink
                      to="/catalogue-management"
                      className="flex-1 flex items-center px-4 py-3"
                      onClick={handleLinkClick}
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="font-medium">Product Management</span>
                    </NavLink>
                    <button
                      onClick={() => setProductOpen(!productOpen)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-300 ease-in-out ${productOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Submenu with smooth animation */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${productOpen ? "max-h-96" : "max-h-0"
                    }`}
                >
                  <ul className="ml-6 border-l-2 border-slate-100 pl-3 py-2 my-1 space-y-1.5">
                    {showCatalogueManagement && (
                      <li>
                        <NavLink
                          to="/catalogue-management"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span>Catalogue Management</span>
                        </NavLink>
                      </li>
                    )}
                    {showPackagingManagement && (
                      <li>
                        <NavLink
                          to="/packaging-management"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Packaging Management</span>
                        </NavLink>
                      </li>
                    )}
                    {showActiveIngredients && (
                      <li>
                        <NavLink
                          to="/active-ingredients"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                          <span>Active Ingredients</span>
                        </NavLink>
                      </li>
                    )}
                  </ul>
                </div>
              </li>
            )}
            {showMastersSection && (
              <li>
                <div className={`rounded-lg transition-all duration-200 ${isMastersActive || mastersOpen
                  ? "bg-gray-50 text-slate-900 font-semibold border-l-4 border-slate-800"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
                  }`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setMastersOpen(!mastersOpen)}
                      className="flex-1 flex items-center px-4 py-3 text-left cursor-pointer"
                    >
                      <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                      </svg>
                      <span className="font-medium">Masters</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMastersOpen(!mastersOpen)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors shrink-0"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-300 ease-in-out ${mastersOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Submenu with smooth animation */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${mastersOpen ? "max-h-screen" : "max-h-0"
                    }`}
                >
                  <ul className="ml-6 border-l-2 border-slate-100 pl-3 py-2 my-1 space-y-1.5">
                    {showInventory && (
                      <li>
                        <NavLink
                          to="/packaging"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Packaging</span>
                        </NavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <NavLink
                          to="/raw-material"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                          <span>Raw Material</span>
                        </NavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <NavLink
                          to="/bom"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          <span>BOM</span>
                        </NavLink>
                      </li>
                    )}
                    {showItemsMaster && (
                      <li>
                        <NavLink
                          to="/items-master"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Items Master</span>
                        </NavLink>
                      </li>
                    )}
                    {showVendorClient && (
                      <li>
                        <NavLink
                          to="/vendor-client"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.697M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Vendor & Client</span>
                        </NavLink>
                      </li>
                    )}
                    {showSalesPurchase && (
                      <li>
                        <NavLink
                          to="/sales-and-purchase"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Sales & Purchase</span>
                        </NavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <NavLink
                          to="/universal-swap"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span>Universal Swap</span>
                        </NavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <NavLink
                          to="/item-groups"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span>Item Groups</span>
                        </NavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <NavLink
                          to="/items-list"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Items List</span>
                        </NavLink>
                      </li>
                    )}
                  </ul>
                </div>
              </li>
            )}
            {/* Customisation link removed */}
            {showTreasury && (
              <li>
                <button
                  onClick={() => {
                    handleLinkClick();
                    window.open('/treasury', '_blank');
                  }}
                  className="flex items-center px-4 py-3 rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent w-full text-left"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Treasury</span>
                  <svg className="w-4 h-4 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </li>
            )}
            {showEnquirySection && (
              <li>
                <div className={`rounded-lg transition-all duration-200 ${isEnquiryActive || enquiryOpen
                  ? "bg-gray-50 text-slate-900 font-semibold border-l-4 border-slate-800"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
                  }`}>
                  <div className="flex items-center">
                    <NavLink
                      to="/enquiry-management"
                      className="flex-1 flex items-center px-4 py-3"
                      onClick={handleLinkClick}
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span className="font-medium">Enquiry Management</span>
                    </NavLink>
                    <button
                      onClick={() => setEnquiryOpen(!enquiryOpen)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-300 ease-in-out ${enquiryOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Submenu with smooth animation */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${enquiryOpen ? "max-h-96" : "max-h-0"
                    }`}
                >
                  <ul className="ml-6 border-l-2 border-slate-100 pl-3 py-2 my-1 space-y-1.5">
                    {showDoctorAppointments && (
                      <li>
                        <NavLink
                          to="/doctor-appointments"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Doctor Appointments</span>
                        </NavLink>
                      </li>
                    )}
                    {showContactEnquiry && (
                      <li>
                        <NavLink
                          to="/contact-enquiry"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>Contact Enquiry</span>
                        </NavLink>
                      </li>
                    )}
                    {showNewDevelopments && (
                      <li>
                        <NavLink
                          to="/new-developments"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>New Developments</span>
                        </NavLink>
                      </li>
                    )}
                    {showProductSamples && (
                      <li>
                        <NavLink
                          to="/product-samples"
                          className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          onClick={handleLinkClick}
                        >
                          <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Product Samples</span>
                        </NavLink>
                      </li>
                    )}
                  </ul>
                </div>
              </li>
            )}
          </ul>
        </nav>

        {/* Footer Section with User Info */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md">
                {(user.name ?? user.email ?? 'U').split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name ?? user.email ?? 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.roleName ?? '—'}</p>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg transition-all duration-200 text-sm font-medium group"
          >
            <svg className="w-4 h-4 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>

          {/* Copyright */}
          <p className="text-xs text-gray-400 text-center pt-2">© 2025 Esthetic Insights</p>
        </div>
      </div>
    </>
  )
}

export default Sidebar
