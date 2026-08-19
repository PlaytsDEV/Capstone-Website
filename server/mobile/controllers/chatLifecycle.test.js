const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const adapter = fs.readFileSync(path.join(SERVER_ROOT, 'routes/mobileChatRoutes.js'), 'utf8');
const canonical = fs.readFileSync(path.join(SERVER_ROOT, 'controllers/chatController.js'), 'utf8');
const vendoredIndex = fs.readFileSync(path.join(SERVER_ROOT, 'mobile/routes/index.js'), 'utf8');

describe('mobile support lifecycle delegates to canonical chat authority', () => {
  test.each([
    ['post', '/chat/start', 'startConversation'],
    ['get', '/chat/me', 'getMyConversations'],
    ['get', '/chat/:conversationId/messages', 'getConversationMessages'],
    ['post', '/chat/:conversationId/messages', 'sendTenantMessage'],
    ['patch', '/chat/:conversationId/resolution', 'confirmTenantResolution'],
    ['patch', '/chat/:conversationId/reopen', 'reopenTenantConversation'],
    ['patch', '/chat/:conversationId/close', 'closeTenantConversation'],
  ])('%s %s maps to %s', (method, route, operation) => {
    expect(adapter).toContain(`router.${method}("${route}"`);
    expect(adapter).toContain(`chatController.${operation}`);
  });

  test('attachment upload/download use canonical endpoints and controller operations', () => {
    expect(adapter).toContain('/chat/:conversationId/attachments');
    expect(adapter).toContain('chatController.uploadChatAttachment');
    expect(adapter).toContain('/chat/:conversationId/attachments/:attachmentId');
    expect(adapter).toContain('chatController.downloadChatAttachment');
    expect(adapter).toContain('fileSize: 5 * 1024 * 1024');
  });

  test('adapter contains transport binding only, with no duplicate persistence or lifecycle rules', () => {
    expect(adapter).toContain('req.authUser = req.mobileTenant');
    expect(adapter).not.toMatch(/ChatConversation|ChatMessage|\.collection\(|generateChatTicketId|statusHistory\.push/);
    expect(vendoredIndex).not.toMatch(/chat\.routes|\/chat"/);
  });

  test('canonical controller owns initial-message persistence, close, resolution, and satisfaction', () => {
    expect(canonical).toContain('appendInitialTenantMessage');
    expect(canonical).toContain('export async function closeTenantConversation');
    expect(canonical).toContain('export async function confirmTenantResolution');
    expect(canonical).toContain('satisfactionRating');
    expect(canonical).toContain('satisfactionFeedback');
  });
});
