import { describe, expect, it } from 'vitest';

import type { AccessPolicyCatalog } from './access-policy-catalog';
import { SynchronizeAccessPolicy } from './synchronize-access-policy';

describe('SynchronizeAccessPolicy', () => {
  it('sends the complete versioned policy to persistence', async () => {
    const catalog = new FakeAccessPolicyCatalog();

    await new SynchronizeAccessPolicy(catalog).execute();

    expect(catalog.synchronized?.profiles.map(({ nameNormalized }) => nameNormalized)).toEqual([
      'administrador',
      'empleado',
    ]);
    expect(catalog.synchronized?.permissions.length).toBe(28);
  });
});

class FakeAccessPolicyCatalog implements AccessPolicyCatalog {
  synchronized: Parameters<AccessPolicyCatalog['synchronize']>[0] | null = null;

  synchronize(input: Parameters<AccessPolicyCatalog['synchronize']>[0]): Promise<void> {
    this.synchronized = input;
    return Promise.resolve();
  }
}
