// FirebaseAuthContext.js
// Provides current Firebase user and always-fresh ID token for secure API calls
// Usage: Wrap your app with <FirebaseAuthProvider> and use useFirebaseAuth() in components/services

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { auth } from "../../firebase/config";
import { onIdTokenChanged } from "firebase/auth";

const FirebaseAuthContext = createContext({
  user: null,
  idToken: null,
  loading: true,
});

export function FirebaseAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen for token changes and update state
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Helper to always get a fresh token (force refresh if needed)
  const getFreshIdToken = useCallback(async () => {
    if (user) {
      return user.getIdToken(true);
    }
    return null;
  }, [user]);

  return (
    <FirebaseAuthContext.Provider
      value={{ user, idToken, getFreshIdToken, loading }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  return useContext(FirebaseAuthContext);
}
