/**
 * Route chunk preloaders for lazy-loaded pages.
 * Call the matching preload on nav link hover to start loading the chunk before click.
 */
export const preloadRoutes: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Dashboard'),
  '/login': () => import('../pages/Login'),
  '/role-management': () => import('../pages/RoleManagement'),
  '/user-management': () => import('../pages/UserManagement'),
  '/task-management': () => import('../pages/TaskManagement'),
  '/catalogue-management': () => import('../pages/CatalogueManagement'),
  '/packaging-management': () => import('../pages/PackagingManagement'),
  '/active-ingredients': () => import('../pages/ActiveIngredients'),
  '/raw-material': () => import('../pages/RawMaterialForm'),
  '/packaging': () => import('../pages/PackagingForm'),
  '/bom': () => import('../pages/BOMDashboard'),
  '/item-groups': () => import('../pages/ItemGroups'),
  '/universal-swap': () => import('../pages/UniversalSwap'),
  '/vendor-client': () => import('../pages/VendorClient'),
  '/items-list': () => import('../pages/ItemsList'),
  '/enquiry-management': () => import('../pages/EnquiryManagement'),
  '/doctor-appointments': () => import('../pages/DoctorAppointments'),
  '/contact-enquiry': () => import('../pages/ContactEnquiry'),
  '/new-developments': () => import('../pages/NewDevelopments'),
  '/product-samples': () => import('../pages/ProductSamples'),
  '/procurement': () => import('../pages/procurement/index'),
  '/warehouse': () => import('../pages/WarehousePage'),
  '/quality': () => import('../pages/QualityPage'),
  '/planning': () => import('../pages/Planning'),
  '/production': () => import('../pages/Production'),
  '/fulfillment': () => import('../pages/Fulfillment'),
  '/client-hub': () => import('../pages/ClientHub'),
  '/treasury': () => import('../pages/TreasuryApp'),
  '/pis': () => import('../pages/PIS'),
};

export function preloadRoute(path: string): void {
  const normalized = path.replace(/\/$/, '') || '/';
  const preload = preloadRoutes[normalized] ?? preloadRoutes[normalized + '/'];
  if (preload) preload().catch(() => {});
}
