// Admin API service
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const adminApi = {
  // Inquiries
  getInquiries: async () => {
    const response = await axios.get(`${API_BASE_URL}/admin/inquiries`);
    return response.data;
  },

  // Reservations
  getReservations: async () => {
    const response = await axios.get(`${API_BASE_URL}/admin/reservations`);
    return response.data;
  },

  // Tenants
  getTenants: async () => {
    const response = await axios.get(`${API_BASE_URL}/admin/tenants`);
    return response.data;
  },

  // Add more API methods as needed
};
