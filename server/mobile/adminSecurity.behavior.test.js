const mockGetDb = jest.fn(); const mockSeedData = jest.fn((_q, r) => r.json({ seeded: true })); const mockGetLiveChats = jest.fn((_q, r) => r.json({ reached: true }));
jest.mock('./config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('./config/firebase.js', () => ({ verifyFirebaseIdToken: jest.fn(), verifyTenantInFirebase: jest.fn(), admin: { auth: () => ({}) } }));
jest.mock('./controllers/seed.controller.js', () => ({ seedData: mockSeedData }));
jest.mock('./controllers/chatbot.controller.js', () => ({ sendMessage: jest.fn(), requestAdmin: jest.fn(), resetSession: jest.fn(), getLiveStatus: jest.fn(), closeLiveChat: jest.fn(), getChatHistory: jest.fn(), getLiveChats: mockGetLiveChats, acceptLiveChat: jest.fn(), sendAdminMessage: jest.fn() }));
const express = require('express'); const http = require('http'); const seedRoutes = require('./routes/seed.routes.js'); const chatbotRoutes = require('./routes/chatbot.routes.js');
const state = { user: null, session: null };
const db = { collection(name) {
  if (name === 'user_sessions') return { async findOne(q) { return state.session?.session_token === q.session_token ? { ...state.session } : null; }, async deleteMany() {} };
  if (name === 'users') return { async findOne() { return state.user ? { ...state.user } : null; } };
  if (name === 'login_attempts') return { async insertOne() {} };
  throw new Error(name);
} };
async function call(path, method = 'POST') {
  const app = express(); app.use(express.json()); app.use('/api/m/seed', seedRoutes); app.use('/api/m/chatbot', chatbotRoutes); const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) }); return { status: response.status, body: await response.json() }; }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
function identity(role, permissions = [], branch = 'gil-puyat') { state.user = { user_id: 'u1', role, permissions, branch, accountStatus: 'active', securityVersion: 0 }; state.session = { user_id: 'u1', session_token: 'token', security_version: 0, expires_at: new Date(Date.now() + 10000) }; }
describe('mobile destructive/admin route policy', () => {
  const originalNodeEnv = process.env.NODE_ENV; const originalSeedFlag = process.env.ENABLE_MOBILE_SEED;
  beforeEach(() => { jest.clearAllMocks(); mockGetDb.mockReturnValue(db); delete process.env.ENABLE_MOBILE_SEED; process.env.NODE_ENV = 'test'; });
  afterAll(() => { process.env.NODE_ENV = originalNodeEnv; if (originalSeedFlag === undefined) delete process.env.ENABLE_MOBILE_SEED; else process.env.ENABLE_MOBILE_SEED = originalSeedFlag; });

  test.each([['production', 'production', 'true'], ['development without flag', 'development', undefined]])('%s hides seed and never executes controller', async (_label, env, flag) => {
    process.env.NODE_ENV = env; if (flag) process.env.ENABLE_MOBILE_SEED = flag; identity('owner'); const result = await call('/api/m/seed');
    expect(result.status).toBe(404); expect(mockSeedData).not.toHaveBeenCalled();
  });
  test.each([['owner', 'owner', 200], ['branch admin', 'branch_admin', 403], ['tenant', 'tenant', 403]])('development seed policy: %s', async (_label, role, status) => {
    process.env.NODE_ENV = 'development'; process.env.ENABLE_MOBILE_SEED = 'true'; identity(role, ['manageUsers']); const result = await call('/api/m/seed');
    expect(result.status).toBe(status); expect(mockSeedData).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
  test.each([['permitted branch admin', 'branch_admin', ['manageUsers'], 200], ['missing permission', 'branch_admin', [], 403], ['tenant', 'tenant', [], 403], ['owner', 'owner', [], 200]])('chat administration: %s', async (_label, role, permissions, status) => {
    identity(role, permissions); const result = await call('/api/m/chatbot/admin/live-chats', 'GET'); expect(result.status).toBe(status); expect(mockGetLiveChats).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
});
