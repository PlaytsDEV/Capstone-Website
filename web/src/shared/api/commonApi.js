// Common API functions
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const commonApi = {
  getRooms: async (branchId) => {
    const response = await axios.get(`${API_BASE_URL}/rooms`, {
      params: { branchId },
    });
    return response.data;
  },

  getRoomDetails: async (roomId) => {
    const response = await axios.get(`${API_BASE_URL}/rooms/${roomId}`);
    return response.data;
  },

  submitInquiry: async (inquiryData) => {
    const response = await axios.post(`${API_BASE_URL}/inquiries`, inquiryData);
    return response.data;
  },

  getBranches: async () => {
    const response = await axios.get(`${API_BASE_URL}/branches`);
    return response.data;
  },
};
