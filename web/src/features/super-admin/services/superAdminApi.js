// Super Admin API service
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const superAdminApi = {
  // Users
  getUsers: async () => {
    const response = await axios.get(`${API_BASE_URL}/super-admin/users`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await axios.post(
      `${API_BASE_URL}/super-admin/users`,
      userData,
    );
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await axios.put(
      `${API_BASE_URL}/super-admin/users/${userId}`,
      userData,
    );
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await axios.delete(
      `${API_BASE_URL}/super-admin/users/${userId}`,
    );
    return response.data;
  },

  // Roles & Permissions
  getRoles: async () => {
    const response = await axios.get(`${API_BASE_URL}/super-admin/roles`);
    return response.data;
  },

  // Audit Logs
  getAuditLogs: async (filters) => {
    const response = await axios.get(`${API_BASE_URL}/super-admin/audit-logs`, {
      params: filters,
    });
    return response.data;
  },
};
