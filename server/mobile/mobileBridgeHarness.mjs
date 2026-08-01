import express from 'express';
import http from 'http';
import mongoose from 'mongoose';

const state = { user: { user_id: 'u1', role: 'tenant', accountStatus: 'active', tenantStatus: 'active', securityVersion: 0 }, session: null };
const db = { collection(name) {
  if (name === 'user_sessions') return { async findOne(q) { return state.session && q.session_token === state.session.session_token && state.session.expires_at > new Date() ? { ...state.session } : null; }, async deleteMany() { state.session = null; } };
  if (name === 'users') return { async findOne(q) { return q.user_id === state.user.user_id ? { ...state.user } : null; } };
  if (name === 'login_attempts') return { async insertOne() {} };
  return {};
} };
Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
Object.defineProperty(mongoose.connection, 'db', { configurable: true, value: db });
const { default: mobileRoutes } = await import('./mobileRoutes.mjs');
const app = express(); app.use((req, _res, next) => { req.cookies = {}; const match = /session_token=([^;]+)/.exec(req.headers.cookie || ''); if (match) req.cookies.session_token = match[1]; next(); }); app.use('/api/m', mobileRoutes);
const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const call = async ({ token, cookie, query = '' } = {}) => {
  state.session = { user_id: 'u1', session_token: 'good', security_version: 0, expires_at: new Date(Date.now() + 60000) };
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/m/auth/me${query}`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie: `session_token=${cookie}` } : {}) } }); return response.status;
};
try { process.stdout.write(JSON.stringify({ bearer: await call({ token: 'good' }), cookie: await call({ cookie: 'good' }), query: await call({ query: '?token=good' }), missing: await call() })); }
finally { await new Promise((resolve) => server.close(resolve)); }
