export interface PermissionDefinition {
  code: string;
  module: string;
  action: string;
}

export interface AccessProfileDefinition {
  id: string;
  name: string;
  nameNormalized: string;
  permissionCodes: readonly string[];
}

export const ADMINISTRATOR_PROFILE_ID = '0198f9c2-7e00-7000-8000-000000000010';
export const EMPLOYEE_PROFILE_ID = '0198f9c2-7e00-7000-8000-000000000020';

export const PERMISSIONS = [
  permission('catalog:read', 'catalog', 'read'),
  permission('catalog:manage', 'catalog', 'manage'),
  permission('catalog:approve-price-exception', 'catalog', 'approve-price-exception'),
  permission('customers:read', 'customers', 'read'),
  permission('customers:write-basic', 'customers', 'write-basic'),
  permission('customers:merge', 'customers', 'merge'),
  permission('inventory:read', 'inventory', 'read'),
  permission('inventory:transfer', 'inventory', 'transfer'),
  permission('inventory:write-off', 'inventory', 'write-off'),
  permission('inventory:adjust', 'inventory', 'adjust'),
  permission('inventory:release-reservation', 'inventory', 'release-reservation'),
  permission('inventory:inspect-return', 'inventory', 'inspect-return'),
  permission('sales:create', 'sales', 'create'),
  permission('sales:read-own', 'sales', 'read-own'),
  permission('sales:read-any', 'sales', 'read-any'),
  permission('sales:update-own-draft', 'sales', 'update-own-draft'),
  permission('sales:adjust-confirmed', 'sales', 'adjust-confirmed'),
  permission('sales:finalize-with-balance', 'sales', 'finalize-with-balance'),
  permission('sales:cancel', 'sales', 'cancel'),
  permission('payments:create-own', 'payments', 'create-own'),
  permission('payments:create-any', 'payments', 'create-any'),
  permission('payments:correct', 'payments', 'correct'),
  permission('purchases:manage', 'purchases', 'manage'),
  permission('expenses:manage', 'expenses', 'manage'),
  permission('returns:approve', 'returns', 'approve'),
  permission('dashboards:financial', 'dashboards', 'financial'),
  permission('imports:initial-products', 'imports', 'initial-products'),
  permission('users:manage', 'users', 'manage'),
] as const satisfies readonly PermissionDefinition[];

export const EMPLOYEE_PERMISSION_CODES = [
  'catalog:read',
  'customers:read',
  'customers:write-basic',
  'inventory:read',
  'sales:create',
  'sales:read-own',
  'sales:update-own-draft',
  'payments:create-own',
] as const;

export const ACCESS_PROFILES = [
  {
    id: ADMINISTRATOR_PROFILE_ID,
    name: 'Administrador',
    nameNormalized: 'administrador',
    permissionCodes: PERMISSIONS.map(({ code }) => code),
  },
  {
    id: EMPLOYEE_PROFILE_ID,
    name: 'Empleado',
    nameNormalized: 'empleado',
    permissionCodes: EMPLOYEE_PERMISSION_CODES,
  },
] as const satisfies readonly AccessProfileDefinition[];

function permission(code: string, module: string, action: string): PermissionDefinition {
  return { code, module, action };
}
