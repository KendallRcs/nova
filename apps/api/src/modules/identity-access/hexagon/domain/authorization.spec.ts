import { describe, expect, it } from 'vitest';

import { hasPermission } from './authorization';

describe('hasPermission', () => {
  it('allows an actor that owns the required capability', () => {
    expect(
      hasPermission(
        { permissionCodes: ['catalog:read'], requiresPasswordChange: false },
        'catalog:read',
      ),
    ).toBe(true);
  });

  it('rejects missing permissions and temporary credentials', () => {
    expect(
      hasPermission({ permissionCodes: [], requiresPasswordChange: false }, 'catalog:read'),
    ).toBe(false);
    expect(
      hasPermission(
        { permissionCodes: ['catalog:read'], requiresPasswordChange: true },
        'catalog:read',
      ),
    ).toBe(false);
  });
});
