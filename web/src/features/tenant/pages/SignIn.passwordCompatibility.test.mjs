import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'SignIn.jsx'), 'utf8');

test('login passes the exact password string to Firebase', () => {
  assert.match(source, /signInWithEmailAndPassword\(\s*auth,\s*formData\.email,\s*formData\.password,\s*\)/);
  assert.doesNotMatch(source, /formData\.password\.(trim|replace)\(/);
  assert.doesNotMatch(source, /Password cannot contain spaces/);
  assert.doesNotMatch(source, /\/\\s\/\.test\(formData\.password\)/);
});

test('login only treats the truly empty password as missing', () => {
  assert.match(source, /if \(!formData\.password\) \{/);
  assert.doesNotMatch(source, /!formData\.password\.trim\(\)/);
});
