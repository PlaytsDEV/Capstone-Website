import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'publicRoutes.jsx'), 'utf8');

const resetRoute = source.match(
  /<Route\s+path="\/reset-password"[\s\S]*?<\/RouteShell>\s*}/,
)?.[0] || '';

test('password-reset action processing is never bypassed by the authenticated-user guard', () => {
  assert.ok(resetRoute, 'expected the /reset-password route');
  assert.match(resetRoute, /<ResetPassword\s*\/>/);
  assert.doesNotMatch(resetRoute, /<RequireNonAdmin>/);
});

test('ordinary guest-only authentication routes remain guarded', () => {
  for (const route of ['/signin', '/signup', '/forgot-password', '/verify-otp']) {
    const routeBlock = source.slice(source.indexOf(`path="${route}"`), source.indexOf('/>', source.indexOf(`path="${route}"`)) + 2);
    assert.match(routeBlock, /<RequireNonAdmin>/, `${route} must remain guest-only`);
  }
});
