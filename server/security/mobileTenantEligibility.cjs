'use strict';

const ACTIVE_ACCOUNT_STATUS = new Set(['active', '']);
const ACTIVE_TENANT_STATUS = new Set(['active']);

function evaluateAccount(user) {
  if (!user?.user_id) return { allowed: false, code: 'ACCOUNT_ACCESS_RESTRICTED' };
  if (user.isActive === false || user.is_active === false || user.isArchived === true || user.is_archived === true) {
    return { allowed: false, code: 'ACCOUNT_ACCESS_RESTRICTED' };
  }
  const status = String(user.accountStatus || user.account_status || '').toLowerCase();
  if (!ACTIVE_ACCOUNT_STATUS.has(status)) return { allowed: false, code: 'ACCOUNT_ACCESS_RESTRICTED' };
  return { allowed: true };
}

function evaluateTenant(user) {
  const account = evaluateAccount(user);
  if (!account.allowed) return account;
  if (String(user.role || '').trim().toLowerCase() !== 'tenant') {
    return { allowed: false, code: 'TENANT_ACCESS_REQUIRED' };
  }
  if (!ACTIVE_TENANT_STATUS.has(String(user.tenantStatus || user.tenant_status || '').toLowerCase())) {
    return { allowed: false, code: 'TENANT_NOT_ACTIVE' };
  }
  return { allowed: true };
}

module.exports = { evaluateAccount, evaluateTenant };
