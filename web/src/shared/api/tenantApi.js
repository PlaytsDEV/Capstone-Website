// Tenant API
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const tenantApi = {
  getProfile: async () => {
    const response = await axios.get(`${API_BASE_URL}/tenant/profile`);
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await axios.put(
      `${API_BASE_URL}/tenant/profile`,
      profileData,
    );
    return response.data;
  },

  getBilling: async () => {
    const response = await axios.get(`${API_BASE_URL}/tenant/billing`);
    return response.data;
  },

  getContracts: async () => {
    const response = await axios.get(`${API_BASE_URL}/tenant/contracts`);
    return response.data;
  },
};
