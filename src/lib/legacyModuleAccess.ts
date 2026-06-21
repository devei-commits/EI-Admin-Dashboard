/**
 * Maps backend USERTYPE_ALLOWED_MODULES (legacy module ids) to the granular RBAC tree.
 * Used when role permissions are partial or the roles API has not loaded yet.
 */

/** Legacy ids that imply full inventory / masters sidebar access */
const INVENTORY_LEGACY_MODULE_IDS = new Set([
  'inventory',
  'raw-materials-management',
  'packaging-management',
  'items-master',
  'universal-swap',
  'item-groups',
]);

/** Legacy module id → inventory subModuleId for route guards */
const INVENTORY_SUBMODULE_LEGACY: Record<string, string> = {
  'raw-materials-management': 'raw-materials',
  'packaging-management': 'packaging',
  'items-master': 'bom',
  'item-groups': 'item-groups',
  'universal-swap': 'universal-swap',
};

export function allowedModulesList(allowedModules?: string[]): string[] {
  return Array.isArray(allowedModules) ? allowedModules : [];
}

export function legacyModuleAllowsView(allowedModules: string[] | undefined, moduleId: string): boolean {
  const allowed = allowedModulesList(allowedModules);
  if (allowed.length === 0) return false;
  if (allowed.includes('*')) return true;
  if (allowed.includes(moduleId)) return true;
  if (moduleId === 'inventory' && allowed.some((id) => INVENTORY_LEGACY_MODULE_IDS.has(id))) {
    return true;
  }
  return false;
}

export function legacyInventorySubModuleAllows(
  allowedModules: string[] | undefined,
  subModuleId: string,
  action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canApprove' | 'canExport'
): boolean {
  const allowed = allowedModulesList(allowedModules);
  if (allowed.length === 0) return false;
  if (allowed.includes('*')) return true;

  const hasInventory = allowed.includes('inventory')
    || allowed.some((id) => INVENTORY_LEGACY_MODULE_IDS.has(id));

  if (!hasInventory) {
    const legacyForSub = Object.entries(INVENTORY_SUBMODULE_LEGACY).find(([, sub]) => sub === subModuleId);
    if (legacyForSub && allowed.includes(legacyForSub[0])) {
      return action === 'canView' || action === 'canCreate' || action === 'canEdit' || action === 'canApprove';
    }
    return false;
  }

  switch (action) {
    case 'canView':
      return true;
    case 'canCreate':
    case 'canEdit':
    case 'canApprove':
    case 'canExport':
      return allowed.includes('inventory') || allowed.includes('raw-materials-management');
    case 'canDelete':
      return allowed.includes('inventory');
    default:
      return false;
  }
}
