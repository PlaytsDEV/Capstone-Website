const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const adapter = fs.readFileSync(path.join(SERVER_ROOT, 'routes/mobileChatRoutes.js'), 'utf8');
const canonical = fs.readFileSync(path.join(SERVER_ROOT, 'controllers/chatController.js'), 'utf8');

describe('mobile chat context and branch authority remain canonical', () => {
  test('adapter accepts no client branch and delegates authenticated database identity', () => {
    expect(adapter).toContain('mobileTenantAuth');
    expect(adapter).toContain('req.authUser = req.mobileTenant');
    expect(adapter).not.toMatch(/req\.body\??\.branch|req\.query\??\.branch|resolveRequesterBranch/);
  });

  test('canonical start validates contract ownership and isolates context reuse', () => {
    expect(canonical).toContain('resolveConversationContext');
    expect(canonical).toContain('entityType === "contract"');
    expect(canonical).toContain('Contract.exists({ _id: entityId, tenantId: tenantUser._id })');
    expect(canonical).toContain('"context.entityType": context.entityType');
    expect(canonical).toContain('"context.entityId": context.entityId');
    expect(canonical).toContain('{ "context.entityType": { $exists: false } }');
  });

  test('canonical tenant lookup and admin room emissions retain branch authority', () => {
    expect(canonical).toContain('resolveTenantContext');
    expect(canonical).toContain('emitToChatAdmins');
    expect(canonical).toContain('conversation.branch');
  });
});
