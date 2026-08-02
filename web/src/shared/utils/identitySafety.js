export const recoverFromAuthFailure = async (auth, _error = null) => {
  try {
    await auth.signOut();
  } catch (_) {
    // Local sign-out failure must not trigger identity deletion or mutation.
  }
};
