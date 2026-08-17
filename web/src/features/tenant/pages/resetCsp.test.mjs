import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.resolve(here, '../../../../vercel.json'), 'utf8'));
const documentShell = fs.readFileSync(path.resolve(here, '../../../../index.html'), 'utf8');

const headerFor = (route) => config.headers.find((entry) => entry.source === route)
  ?.headers.find((header) => header.key === 'Content-Security-Policy')?.value;

for (const route of ['/auth-action', '/reset-password']) {
  test(`${route} permits the external application bundle without inline script execution`, () => {
    const policy = headerFor(route);
    assert.ok(policy, `missing CSP for ${route}`);
    assert.match(policy, /script-src 'self'/);
    assert.match(policy, /script-src-attr 'none'/);
    const scriptDirective = policy.split(';').find((directive) => directive.trim().startsWith('script-src '));
    assert.doesNotMatch(scriptDirective, /'unsafe-inline'/);
    assert.match(policy, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    assert.match(policy, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  });
}

test('the shared document shell contains no inline executable handlers', () => {
  assert.doesNotMatch(documentShell, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(documentShell, /<script(?![^>]+src=)[^>]*>/i);
  assert.match(documentShell, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\//);
});
