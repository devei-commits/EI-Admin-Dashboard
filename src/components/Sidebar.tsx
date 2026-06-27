import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import eilogofull from "../assets/logo/eilogofull.svg";
import Logo from "../assets/logos/Logo";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { isSuperAdmin } from "./SuperAdminRoute";
import { useSidebarViewport } from "../hooks/useSidebarViewport";
import { preloadRoute } from "../lib/preloadRoutes";

/** NavLink that preloads the lazy route chunk on hover (no API prefetch). */
const PreloadNavLink = ({
  to,
  onMouseEnter,
  ...rest
}: React.ComponentProps<typeof NavLink>) => {
  const path = typeof to === "string" ? to : (to as { pathname?: string }).pathname ?? "";

  return (
    <NavLink
      to={to}
      onMouseEnter={(e) => {
        preloadRoute(path);
        onMouseEnter?.(e);
      }}
      {...rest}
    />
  );
};

type SidebarProps = {
  /** layout = main dashboard shell; drawer = overlay on standalone module pages */
  variant?: "layout" | "drawer";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Live drag offset in px for the drawer variant (e.g. while a swipe gesture is in
   * progress). When non-null the panel follows the finger and its transition is disabled.
   * The value is the panel's translateX (−width … 0). Ignored for the layout variant.
   */
  dragPx?: number | null;
};

const Sidebar = ({ variant = "layout", open: controlledOpen, onOpenChange, dragPx = null }: SidebarProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mediumExpanded, setMediumExpanded] = useState(false);
  const viewportMode = useSidebarViewport();
  const isDrawer = variant === "drawer";
  const isOpen = isDrawer ? (controlledOpen ?? false) : internalOpen;
  const setIsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(isOpen) : next;
    if (isDrawer) onOpenChange?.(value);
    else setInternalOpen(value);
  };
  const isIconOnly = !isDrawer && viewportMode === "medium" && !mediumExpanded;
  const isMediumExpanded = !isDrawer && viewportMode === "medium" && mediumExpanded;
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
  const showFacilityManagement = canAccess('order-management');
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
  const showVendorClient = canAccess('vendor-client');
  // Quotations: super_admin only (stricter than canAccess/isAdmin).
  const showQuotations = isSuperAdmin(user?.roleName);
  const showMastersSection = showInventory || showVendorClient || showQuotations;

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
    '/procurement',
    '/warehouse',
    '/planning',
    '/production',
    '/fulfillment',
    '/client-hub'
  ].includes(location.pathname);

  // Check if any product submenu item is active
  const isProductActive = [
    '/catalogue-management',
    '/packaging-management',
    '/customization-packaging-catalog',
    '/active-ingredients',
    '/customization-catalog',
  ].includes(location.pathname);

  // Check if any masters submenu item is active
  const isMastersActive = [
    '/packaging',
    '/raw-material',
    '/bom',
    '/vendor-client',
    '/universal-swap',
    '/item-groups',
    '/items-list'
  ].includes(location.pathname) || location.pathname.startsWith('/quotations');

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

  // Leaving medium viewport: drop temporary expand; entering medium: start collapsed
  useEffect(() => {
    if (viewportMode !== "medium") {
      setMediumExpanded(false);
    }
  }, [viewportMode]);

  // Collapse medium expanded rail on Escape
  useEffect(() => {
    if (!isMediumExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMediumExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMediumExpanded]);

  const collapseAfterNav = useCallback(() => {
    if (isDrawer) {
      onOpenChange?.(false);
    } else if (viewportMode === "mobile") {
      setInternalOpen(false);
    } else if (viewportMode === "medium") {
      setMediumExpanded(false);
    }
  }, [isDrawer, onOpenChange, viewportMode]);

  const handleLinkClick = () => {
    collapseAfterNav();
  };

  /** First click on medium collapsed rail expands; navigation collapses again. */
  const handleNavClick = (e: MouseEvent, onExpand?: () => void) => {
    if (isIconOnly) {
      e.preventDefault();
      setMediumExpanded(true);
      onExpand?.();
      return;
    }
    handleLinkClick();
  };

  const handleSubmenuToggle = (
    setter: (value: boolean | ((prev: boolean) => boolean)) => void,
    isSubmenuOpen: boolean
  ) => {
    if (isIconOnly) {
      setMediumExpanded(true);
      if (!isSubmenuOpen) setter(true);
      return;
    }
    setter((prev) => !prev);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-nav-link flex items-center px-5 py-3.5 rounded-xl transition-all duration-200 ${isActive
      ? "bg-linear-to-r from-gray-50 to-gray-100/50 text-slate-900 font-semibold border-l-4 border-slate-800 shadow-sm"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent hover:shadow-sm"
    }`;

  const submenuLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
      ? "text-slate-900 font-medium bg-slate-100/50"
      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
    }`;

  return (
    <>
      {/* Mobile Header Bar — main dashboard layout only */}
      {!isDrawer && (
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
      )}

      {/* Overlay — mobile drawer, drawer variant, or medium expanded rail */}
      {(isOpen || isMediumExpanded) && (
        <div
          className={
            isDrawer
              ? "fixed inset-0 bg-black/40 backdrop-blur-sm z-[85]"
              : isMediumExpanded
                ? "hidden md:block lg:hidden fixed inset-0 bg-black/20 z-30"
                : "md:hidden fixed inset-0 bg-white/60 backdrop-blur-md z-30 mt-14"
          }
          onClick={() => {
            if (isMediumExpanded) setMediumExpanded(false);
            else setIsOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        style={isDrawer && dragPx != null ? { transform: `translateX(${dragPx}px)` } : undefined}
        className={`fixed flex flex-col bg-background border-r border-gray-200 ${isDrawer && dragPx != null ? "transition-none" : "transition-all duration-300 ease-in-out"} shadow-sm
          ${isIconOnly ? "is-sidebar-icon-only md:w-16" : "w-64"}
          ${isDrawer
            ? `top-0 left-0 h-screen z-[90] w-64 ${dragPx != null ? "" : (isOpen ? "translate-x-0" : "-translate-x-full")}`
            : `md:sticky md:top-0 h-screen md:h-screen z-40 ${isMediumExpanded ? "md:z-50" : ""} ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} mt-14 md:mt-0 lg:w-64`
          }`}
      >
        {/* Logo Section — website EI mark when collapsed; full wordmark when expanded */}
        <div className={`sidebar-logo-section ${isDrawer ? "flex" : "hidden md:flex"} p-5 items-center justify-center border-b border-gray-100 bg-transparent shrink-0 overflow-hidden`}>
          {isIconOnly ? (
            <Logo
              className="sidebar-logo-collapsed shrink-0"
              heightPx={36}
              maxWidthPx={56}
              objectPosition="left"
            />
          ) : (
            <img
              src={eilogofull}
              alt="Esthetic Insights"
              className="sidebar-logo max-h-10 max-w-full object-contain"
            />
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-5 overflow-y-auto overflow-x-hidden">
          <p className="sidebar-section-label text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 mb-4">Menu</p>
          <ul className="space-y-2">
            {showDashboard && (
              <li>
                <PreloadNavLink to="/" className={linkClass} title="Dashboard" onClick={(e) => handleNavClick(e)}>
                  <svg className="w-5 h-5 mr-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="sidebar-label font-medium">Dashboard</span>
                </PreloadNavLink>
              </li>
            )}
            {/* PIS tab — hidden in sidebar for now
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
                  className="flex items-center px-5 py-3.5 rounded-xl transition-all duration-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent hover:shadow-sm w-full text-left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                  </svg>
                  <span className="font-medium">PIS</span>
                  <svg className="w-4 h-4 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </li>
            )}
            */}
            {showRoleManagement && (
              <li>
                <PreloadNavLink to="/role-management" className={linkClass} title="Role Management" onClick={(e) => handleNavClick(e)}>
                  <svg className="w-5 h-5 mr-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="sidebar-label font-medium">Role Management</span>
                </PreloadNavLink>
              </li>
            )}
            {showUserManagement && (
              <li>
                <PreloadNavLink to="/user-management" className={linkClass} title="User Management" onClick={(e) => handleNavClick(e)}>
                  <svg className="w-5 h-5 mr-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="sidebar-label font-medium">User Management</span>
                </PreloadNavLink>
              </li>
            )}
            {/* Task Management tab — hidden in sidebar for now
            {showTaskManagement && (
              <li>
                <PreloadNavLink to="/task-management" className={linkClass} onClick={(e) => handleNavClick(e)}>
                  <svg className="w-5 h-5 mr-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="font-medium">Task Management</span>
                </PreloadNavLink>
              </li>
            )}
            */}
            {showFacilityManagement && (
              <li>
                <NavLink to="/facility-management" className={linkClass} title="Facility Management" onClick={(e) => handleNavClick(e)}>
                  <svg className="w-5 h-5 mr-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="sidebar-label font-medium">Facility Management</span>
                </NavLink>
              </li>
            )}
            {showOrderSection && (
              <li>
                <div className={`rounded-xl transition-all duration-200 ${isOrderActive || orderOpen
                  ? "bg-linear-to-r from-gray-50 to-gray-100/50 text-slate-900 font-semibold border-l-4 border-slate-800 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent hover:shadow-sm"
                  }`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSubmenuToggle(setOrderOpen, orderOpen)}
                      className="sidebar-nav-link flex-1 flex items-center px-5 py-3.5 text-left cursor-pointer"
                      title="Order Management"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span className="sidebar-label font-medium">Order Management</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmenuToggle(setOrderOpen, orderOpen)}
                      className="sidebar-chevron p-2.5 mr-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                      aria-label={orderOpen ? "Collapse Order Management menu" : "Expand Order Management menu"}
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
                  className={`sidebar-submenu overflow-hidden transition-all duration-300 ease-in-out ${orderOpen ? "max-h-screen" : "max-h-0"
                    }`}
                >
                  <ul className="ml-7 border-l-2 border-slate-100 pl-4 py-2.5 my-2 space-y-2">
                    <li>
                      <PreloadNavLink to="/procurement" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
                        <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Procurement</span>
                      </PreloadNavLink>
                    </li>
                    <li>
                      <PreloadNavLink to="/warehouse" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
                        <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <span>Warehouse</span>
                      </PreloadNavLink>
                    </li>
                    <li>
                      <PreloadNavLink to="/planning" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
                        <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Planning</span>
                      </PreloadNavLink>
                    </li>
                    <li>
                      <PreloadNavLink to="/production" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
                        <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span>Production</span>
                      </PreloadNavLink>
                    </li>
                    <li>
                      <PreloadNavLink to="/fulfillment" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
                        <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Fulfillment</span>
                      </PreloadNavLink>
                    </li>
                    <li>
                      <PreloadNavLink to="/client-hub" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
                        <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM4.318 20H3v-2a6 6 0 018-5.656" />
                        </svg>
                        <span>Client Hub</span>
                      </PreloadNavLink>
                    </li>
                  </ul>
                </div>
              </li>
            )}
            {showProductSection && (
              <li>
                <div className={`rounded-xl transition-all duration-200 ${isProductActive || productOpen
                  ? "bg-linear-to-r from-gray-50 to-gray-100/50 text-slate-900 font-semibold border-l-4 border-slate-800 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent hover:shadow-sm"
                  }`}>
                  <div className="flex items-center">
                    <PreloadNavLink
                      to="/catalogue-management"
                      className="sidebar-nav-link flex-1 flex items-center px-5 py-3.5"
                      onClick={(e) => handleNavClick(e, () => setProductOpen(true))}
                      title="Product Management"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="sidebar-label font-medium">Product Management</span>
                    </PreloadNavLink>
                    <button
                      type="button"
                      onClick={() => handleSubmenuToggle(setProductOpen, productOpen)}
                      className="sidebar-chevron p-2.5 mr-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label={productOpen ? "Collapse Product Management menu" : "Expand Product Management menu"}
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
                  className={`sidebar-submenu overflow-hidden transition-all duration-300 ease-in-out ${productOpen ? "max-h-96" : "max-h-0"
                    }`}
                >
                  <ul className="ml-7 border-l-2 border-slate-100 pl-4 py-2.5 my-2 space-y-2">
                    {showCatalogueManagement && (
                      <li>
                        <PreloadNavLink
                          to="/catalogue-management"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span>Catalogue Management</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showPackagingManagement && (
                      <li>
                        <PreloadNavLink
                          to="/packaging-management"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Packaging Management</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showPackagingManagement && (
                      <li>
                        <PreloadNavLink
                          to="/customization-packaging-catalog"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                          <span>Customize packaging (website)</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showActiveIngredients && (
                      <li>
                        <PreloadNavLink
                          to="/active-ingredients"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                          <span>Active Ingredients</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showActiveIngredients && (
                      <li>
                        <PreloadNavLink
                          to="/customization-catalog"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                          <span>Customization Catalog</span>
                        </PreloadNavLink>
                      </li>
                    )}
                  </ul>
                </div>
              </li>
            )}
            {showMastersSection && (
              <li>
                <div className={`rounded-xl transition-all duration-200 ${isMastersActive || mastersOpen
                  ? "bg-linear-to-r from-gray-50 to-gray-100/50 text-slate-900 font-semibold border-l-4 border-slate-800 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent hover:shadow-sm"
                  }`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSubmenuToggle(setMastersOpen, mastersOpen)}
                      className="sidebar-nav-link flex-1 flex items-center px-5 py-3.5 text-left cursor-pointer"
                      title="Masters"
                    >
                      <svg className="w-5 h-5 mr-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                      </svg>
                      <span className="sidebar-label font-medium">Masters</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmenuToggle(setMastersOpen, mastersOpen)}
                      className="sidebar-chevron p-2.5 mr-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                      aria-label={mastersOpen ? "Collapse Masters menu" : "Expand Masters menu"}
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
                  className={`sidebar-submenu overflow-hidden transition-all duration-300 ease-in-out ${mastersOpen ? "max-h-screen" : "max-h-0"
                    }`}
                >
                  <ul className="ml-7 border-l-2 border-slate-100 pl-4 py-2.5 my-2 space-y-2">
                    {showInventory && (
                      <li>
                        <PreloadNavLink
                          to="/raw-material"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                          <span>Raw Materials</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <PreloadNavLink
                          to="/packaging"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Packaging</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <PreloadNavLink
                          to="/bom"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          <span>Products (PR)</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <PreloadNavLink
                          to="/item-groups"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span>Item Groups</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <PreloadNavLink
                          to="/universal-swap"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span>Universal Swap</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showVendorClient && (
                      <li>
                        <PreloadNavLink
                          to="/vendor-client"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.697M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Vendors and Client</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showInventory && (
                      <li>
                        <PreloadNavLink
                          to="/items-list"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Price List</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showQuotations && (
                      <li>
                        <PreloadNavLink
                          to="/quotations"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Quotations</span>
                        </PreloadNavLink>
                      </li>
                    )}
                  </ul>
                </div>
              </li>
            )}
            {/* Customisation link removed */}
            {showTreasury && (
              <li>
                <PreloadNavLink to="/treasury" className={linkClass} title="Treasury" onClick={(e) => handleNavClick(e)}>
                  <svg className="w-5 h-5 mr-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="sidebar-label font-medium">Treasury</span>
                </PreloadNavLink>
              </li>
            )}
            {showEnquirySection && (
              <li>
                <div className={`rounded-xl transition-all duration-200 ${isEnquiryActive || enquiryOpen
                  ? "bg-linear-to-r from-gray-50 to-gray-100/50 text-slate-900 font-semibold border-l-4 border-slate-800 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent hover:shadow-sm"
                  }`}>
                  <div className="flex items-center">
                    <PreloadNavLink
                      to="/enquiry-management"
                      className="sidebar-nav-link flex-1 flex items-center px-5 py-3.5"
                      onClick={(e) => handleNavClick(e, () => setEnquiryOpen(true))}
                      title="Enquiry Management"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span className="sidebar-label font-medium">Enquiry Management</span>
                    </PreloadNavLink>
                    <button
                      type="button"
                      onClick={() => handleSubmenuToggle(setEnquiryOpen, enquiryOpen)}
                      className="sidebar-chevron p-2.5 mr-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label={enquiryOpen ? "Collapse Enquiry Management menu" : "Expand Enquiry Management menu"}
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
                  className={`sidebar-submenu overflow-hidden transition-all duration-300 ease-in-out ${enquiryOpen ? "max-h-96" : "max-h-0"
                    }`}
                >
                  <ul className="ml-7 border-l-2 border-slate-100 pl-4 py-2.5 my-2 space-y-2">
                    {showDoctorAppointments && (
                      <li>
                        <PreloadNavLink
                          to="/doctor-appointments"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Doctor Appointments</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showContactEnquiry && (
                      <li>
                        <PreloadNavLink
                          to="/contact-enquiry"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>Contact Enquiry</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showNewDevelopments && (
                      <li>
                        <PreloadNavLink
                          to="/new-developments"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>New Developments</span>
                        </PreloadNavLink>
                      </li>
                    )}
                    {showProductSamples && (
                      <li>
                        <PreloadNavLink
                          to="/product-samples"
                          className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${isActive
                            ? "text-slate-900 font-medium bg-slate-100/50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                            }`}
                          onClick={(e) => handleNavClick(e)}
                        >
                          <svg className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span>Product Samples</span>
                        </PreloadNavLink>
                      </li>
                    )}
                  </ul>
                </div>
              </li>
            )}
          </ul>
        </nav>

        {/* Footer Section with User Info */}
        <div className="sidebar-footer p-5 border-t border-gray-100 bg-gray-50/50 space-y-3 shrink-0">
          {/* User Info */}
          {user && (
            <div className="sidebar-user-row flex items-center gap-3 px-2">
              <div className="w-11 h-11 bg-slate-800 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md shrink-0">
                {(user.name ?? user.email ?? 'U').split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2) || 'U'}
              </div>
              <div className="sidebar-user-text flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name ?? user.email ?? 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.roleName ?? '—'}</p>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => {
              if (isIconOnly) {
                setMediumExpanded(true);
                return;
              }
              handleLogout();
            }}
            title="Logout"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-xl transition-all duration-200 text-sm font-medium group shadow-sm hover:shadow"
          >
            <svg className="w-4 h-4 group-hover:text-red-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="sidebar-logout-text">Logout</span>
          </button>

          {/* Copyright */}
          <p className="sidebar-copyright text-xs text-gray-400 text-center pt-2">© 2025 Esthetic Insights</p>
        </div>
      </div>
    </>
  )
}

export default Sidebar
