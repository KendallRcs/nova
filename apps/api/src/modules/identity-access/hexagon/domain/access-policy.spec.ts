import { describe, expect, it } from 'vitest';

import { ACCESS_PROFILES, EMPLOYEE_PERMISSION_CODES, PERMISSIONS } from './access-policy';

describe('initial access policy', () => {
  it('grants every versioned capability to the administrator', () => {
    const administrator = ACCESS_PROFILES.find(
      ({ nameNormalized }) => nameNormalized === 'administrador',
    );

    expect(administrator?.permissionCodes).toEqual(PERMISSIONS.map(({ code }) => code));
  });

  it('limits the employee to confirmed operational capabilities', () => {
    expect(EMPLOYEE_PERMISSION_CODES).toContain('sales:create');
    expect(EMPLOYEE_PERMISSION_CODES).toContain('payments:create-own');
    expect(EMPLOYEE_PERMISSION_CODES).not.toContain('catalog:manage');
    expect(EMPLOYEE_PERMISSION_CODES).not.toContain('inventory:adjust');
    expect(EMPLOYEE_PERMISSION_CODES).not.toContain('dashboards:financial');
    expect(EMPLOYEE_PERMISSION_CODES).not.toContain('users:manage');
  });

  it('uses unique permission codes', () => {
    const codes = PERMISSIONS.map(({ code }) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
