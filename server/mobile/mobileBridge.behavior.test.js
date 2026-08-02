const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');

test('native Node production /api/m bridge executes shared bearer/cookie/query/missing behavior', async () => {
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [path.join(__dirname, 'mobileBridgeHarness.mjs')], {
    cwd: __dirname,
    timeout: 30000,
    env: {
      ...process.env,
      FIREBASE_PROJECT_ID: '',
      FIREBASE_PRIVATE_KEY_ID: '',
      FIREBASE_PRIVATE_KEY: '',
      FIREBASE_CLIENT_EMAIL: '',
      FIREBASE_CLIENT_ID: '',
      FIREBASE_CLIENT_CERT_URL: '',
    },
  });
  expect(stderr).toMatch(/Firebase Admin SDK initialization failed: Missing required env vars/);
  expect(stderr).toMatch(/FIREBASE_PROJECT_ID[\s\S]*FIREBASE_CLIENT_CERT_URL/);
  expect(stderr.trim().split(/\r?\n/)).toHaveLength(2);
  const payload = stdout.match(/\{"bearer":\d+,"cookie":\d+,"query":\d+,"missing":\d+\}/)?.[0];
  expect(JSON.parse(payload)).toEqual({ bearer: 200, cookie: 200, query: 401, missing: 401 });
}, 30000);
