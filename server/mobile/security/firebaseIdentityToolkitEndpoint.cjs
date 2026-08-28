function firebaseIdentityToolkitBaseUrl(env = process.env) {
  const emulatorHost = String(env.FIREBASE_AUTH_EMULATOR_HOST || '').trim();
  if (!emulatorHost) return 'https://identitytoolkit.googleapis.com';

  const qaEnabled = /^(1|true|yes|on)$/i.test(String(env.ALLOW_QA_FIXTURES || '').trim());
  const isolatedMode = String(env.QA_FIXTURE_MODE || '').trim() === 'isolated-local';
  const demoProject = String(env.FIREBASE_PROJECT_ID || '').trim().startsWith('demo-');
  const loopbackHost = /^(127\.0\.0\.1|localhost|\[?::1\]?):\d+$/.test(emulatorHost);
  if (env.NODE_ENV === 'production' || !qaEnabled || !isolatedMode || !demoProject || !loopbackHost) {
    throw new Error('Refusing unsafe Firebase Auth Emulator configuration.');
  }
  return `http://${emulatorHost}/identitytoolkit.googleapis.com`;
}

function signInWithPasswordUrl(apiKey, env = process.env) {
  return `${firebaseIdentityToolkitBaseUrl(env)}/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
}

module.exports = { firebaseIdentityToolkitBaseUrl, signInWithPasswordUrl };
