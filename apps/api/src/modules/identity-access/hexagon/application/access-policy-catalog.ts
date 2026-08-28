import type { AccessProfileDefinition, PermissionDefinition } from '../domain/access-policy';

export interface AccessPolicyCatalog {
  synchronize(input: {
    permissions: readonly PermissionDefinition[];
    profiles: readonly AccessProfileDefinition[];
  }): Promise<void>;
}
