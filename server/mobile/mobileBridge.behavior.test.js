const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');

test('native Node production /api/m bridge executes shared bearer/cookie/query/missing behavior', async () => {
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [path.join(__dirname, 'mobileBridgeHarness.mjs')], { cwd: path.join(__dirname, '..'), timeout: 30000 });
  expect(stderr).toBe('');
  const payload = stdout.match(/\{"bearer":\d+,"cookie":\d+,"query":\d+,"missing":\d+\}/)?.[0];
  expect(JSON.parse(payload)).toEqual({ bearer: 200, cookie: 200, query: 401, missing: 401 });
});
