/**
 * =============================================================================
 * USE AUTH HOOK
 * =============================================================================
 *
 * Custom hook for managing authentication state and operations.
 * Works with both Firebase Auth and the backend user database.
 *
 * SEPARATION OF CONCERNS:
 * - Admin login: /admin/login → requires admin/superAdmin role
 * - Tenant login: /tenant/signin → for regular users/tenants
 *
 * The system starts with NO authenticated user. Users must explicitly
 * login through the appropriate login page.
 *
 * Usage:
 *   function MyComponent() {
 *     const { user, isAuthenticated, loading, login, logout, isAdmin } = useAuth();
 *     ...
 *   }
 *
 * Note: This hook must be used within an AuthProvider component.
 * For Firebase-specific auth state, use useFirebaseAuth from FirebaseAuthContext.
 * =============================================================================
 */

import { useState, useEffect, createContext, useContext } from "react";
import { authApi } from "../api/authApi";
import { useFirebaseAuth } from "./FirebaseAuthContext";

const AuthContext = createContext(null);

/**
 * Auth Provider Component
 * Wraps the application to provide authentication context.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user: firebaseUser, loading: firebaseLoading } = useFirebaseAuth();

  // Sync with Firebase auth state
  useEffect(() => {
    if (firebaseLoading) return;

    if (firebaseUser) {
      // Firebase user exists, try to get backend user data
      checkAuth();
    } else {
      // No Firebase user, clear state
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      // Clear local storage
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }
  }, [firebaseUser, firebaseLoading]);

  /**
   * Check if user is authenticated by fetching profile from backend
   * @private
   */
  const checkAuth = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      // User not authenticated in backend - clear state
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login user after Firebase authentication
   * @returns {Promise<Object>} User data from backend
   */
  const login = async () => {
    const userData = await authApi.login();
    setUser(userData.user || userData);
    setIsAuthenticated(true);
    return userData;
  };

  /**
   * Logout user from Firebase and clear state
   */
  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setIsAuthenticated(false);
    // Clear local storage
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
  };

  /**
   * Refresh user data from backend
   */
  const refreshUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  /**
   * Check if current user is an admin or super admin
   * @returns {boolean} True if user has admin privileges
   */
  const isAdmin = () => {
    return user?.role === "admin" || user?.role === "superAdmin";
  };

  /**
   * Check if current user is a super admin
   * @returns {boolean} True if user is super admin
   */
  const isSuperAdmin = () => {
    return user?.role === "superAdmin";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        refreshUser,
        isAdmin,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access authentication context
 * @returns {Object} Auth context value
 * @throws {Error} If used outside AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
