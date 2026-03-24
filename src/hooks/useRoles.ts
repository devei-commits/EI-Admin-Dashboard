/**
 * TanStack Query hooks for roles — list, by id, module definitions, and mutations.
 * Uses queryHooksFactory for modular, reusable pattern.
 */
import { queryKeys } from '../lib/queryClient';
import { createListQuery, useDetailQuery, createMutation } from '../lib/queryHooksFactory';
import * as roleService from '../services/role.service';

export const useRolesList = createListQuery(
  queryKeys.roles,
  () => roleService.listRoles(),
  { staleTime: 2 * 60 * 1000 },
);

export function useRole(id: string | null) {
  return useDetailQuery(
    (rid) => queryKeys.role(rid),
    id,
    () => (id ? roleService.getRoleById(id) : Promise.resolve(null)),
    { enabled: !!id },
  );
}

export const useModuleDefinitions = createListQuery(
  queryKeys.moduleDefinitions,
  () => roleService.getModuleDefinitions(),
  { staleTime: 5 * 60 * 1000 },
);

export const useCreateRole = createMutation(roleService.createRole, [queryKeys.roles]);
export const useUpdateRole = createMutation(
  ({ roleId, payload }: { roleId: string | number; payload: roleService.CreateRolePayload }) =>
    roleService.updateRole(roleId, payload),
  (_, { roleId }) => [queryKeys.roles, queryKeys.role(String(roleId))],
);
export const useDeleteRole = createMutation(roleService.deleteRole, [queryKeys.roles]);
