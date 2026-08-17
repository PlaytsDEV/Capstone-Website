import { describe, expect, test } from '@jest/globals';
import eligibility from './mobileTenantEligibility.cjs';

const { evaluateAccount, evaluateTenant } = eligibility;

const activeTenant = {
  user_id: 'tenant-1',
  role: 'tenant',
  accountStatus: 'active',
  tenantStatus: 'active',
};

describe('mobile tenant password-operation eligibility', () => {
  test('an authoritative active tenant is eligible', () => {
    expect(evaluateTenant(activeTenant)).toEqual({ allowed: true });
  });

  test.each(['applicant', 'admin', 'branch_admin', 'owner', 'staff'])('%s is not eligible', (role) => {
    expect(evaluateTenant({ ...activeTenant, role })).toEqual({
      allowed: false,
      code: 'TENANT_ACCESS_REQUIRED',
    });
  });

  test.each(['applicant', 'inactive', 'moved_out', 'evicted', 'blacklisted'])('tenant lifecycle %s is not eligible', (tenantStatus) => {
    expect(evaluateTenant({ ...activeTenant, tenantStatus })).toEqual({
      allowed: false,
      code: 'TENANT_NOT_ACTIVE',
    });
  });

  test('unknown and restricted accounts fail closed', () => {
    expect(evaluateTenant(null).allowed).toBe(false);
    expect(evaluateAccount({ ...activeTenant, isArchived: true }).allowed).toBe(false);
    expect(evaluateTenant({ ...activeTenant, accountStatus: 'suspended' }).allowed).toBe(false);
  });
});
