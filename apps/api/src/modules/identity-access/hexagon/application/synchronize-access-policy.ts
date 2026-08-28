import { ACCESS_PROFILES, PERMISSIONS } from '../domain/access-policy';
import type { AccessPolicyCatalog } from './access-policy-catalog';

export class SynchronizeAccessPolicy {
  constructor(private readonly catalog: AccessPolicyCatalog) {}

  async execute(): Promise<void> {
    await this.catalog.synchronize({ permissions: PERMISSIONS, profiles: ACCESS_PROFILES });
  }
}
