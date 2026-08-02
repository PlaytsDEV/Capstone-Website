import { jest } from '@jest/globals';
import express from 'express';
import http from 'http';

const downloadBackup = jest.fn((_req, res) => res.json({ downloaded: true }));
const verifyToken = jest.fn((req, res, next) => req.headers.authorization === 'Bearer valid-owner-token' ? next() : res.status(401).json({ code: 'AUTHENTICATION_FAILED' }));
const verifyOwner = jest.fn((_req, _res, next) => next());
const noop = (_req, res) => res.json({});
await jest.unstable_mockModule('../middleware/auth.js', () => ({ verifyToken, verifyOwner }));
await jest.unstable_mockModule('../controllers/backupController.js', () => ({ getBackupConfig: noop, updateBackupConfig: noop, triggerManualBackup: noop, getBackupHistory: noop, downloadBackup, deleteBackup: noop, restoreBackup: noop, uploadAndRestore: noop }));
const { default: routes } = await import('./backupRoutes.js');

async function get(path, authorization) {
  const app = express(); app.use('/api/backups', routes); const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: authorization ? { authorization } : {} }); return { status: response.status, body: await response.json() }; }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

describe('backup download credential transport', () => {
  beforeEach(() => jest.clearAllMocks());
  test('reusable bearer token in query string is rejected and download is not executed', async () => {
    const result = await get('/api/backups/backup-1/download?token=valid-owner-token');
    expect(result.status).toBe(401); expect(downloadBackup).not.toHaveBeenCalled();
  });
  test('owner Authorization header reaches the scoped download controller', async () => {
    const result = await get('/api/backups/backup-1/download', 'Bearer valid-owner-token');
    expect(result).toEqual({ status: 200, body: { downloaded: true } }); expect(verifyOwner).toHaveBeenCalled(); expect(downloadBackup).toHaveBeenCalled();
  });
});
