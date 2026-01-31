// Authentication API
const API_BASE = "/api/auth";

export const authApi = {
  login: async (credentials) => {
    // TODO: Implement login API call
    return {
      user: {},
      token: "",
    };
  },

  logout: async () => {
    // TODO: Implement logout
  },

  getCurrentUser: async () => {
    // TODO: Implement get current user
    return {};
  },

  refreshToken: async () => {
    // TODO: Implement token refresh
    return "";
  },
};
