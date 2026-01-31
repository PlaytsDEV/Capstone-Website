const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Helper function to get auth token
const getAuthToken = () => {
  // This will be set after user logs in with Firebase
  return localStorage.getItem("authToken");
};

// Helper function to make authenticated requests
const authFetch = async (url, options = {}, customToken = null) => {
  const token = customToken || getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    const apiError = new Error(
      error.error || error.message || "API request failed",
    );
    apiError.response = { status: response.status, data: error };
    throw apiError;
  }

  return response.json();
};

export const authApi = {
  login: async (token) => {
    return authFetch(
      "/auth/login",
      {
        method: "POST",
      },
      token,
    );
  },

  register: async (userData, token) => {
    return authFetch(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(userData),
      },
      token,
    );
  },

  getProfile: async () => {
    return authFetch("/auth/profile");
  },

  updateProfile: async (userData) => {
    return authFetch("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  },
};

export const roomApi = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetch(`${API_URL}/rooms?${params}`).then((res) => res.json());
  },

  create: async (roomData) => {
    return authFetch("/rooms", {
      method: "POST",
      body: JSON.stringify(roomData),
    });
  },

  update: async (roomId, roomData) => {
    return authFetch(`/rooms/${roomId}`, {
      method: "PUT",
      body: JSON.stringify(roomData),
    });
  },

  delete: async (roomId) => {
    return authFetch(`/rooms/${roomId}`, {
      method: "DELETE",
    });
  },
};

export const reservationApi = {
  getAll: async () => {
    return authFetch("/reservations");
  },

  create: async (reservationData) => {
    return authFetch("/reservations", {
      method: "POST",
      body: JSON.stringify(reservationData),
    });
  },

  update: async (reservationId, data) => {
    return authFetch(`/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

export const inquiryApi = {
  getAll: async () => {
    return authFetch("/inquiries");
  },

  create: async (inquiryData) => {
    return fetch(`${API_URL}/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inquiryData),
    }).then((res) => res.json());
  },

  update: async (inquiryId, data) => {
    return authFetch(`/inquiries/${inquiryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

export const userApi = {
  getAll: async () => {
    return authFetch("/users");
  },

  getById: async (userId) => {
    return authFetch(`/users/${userId}`);
  },
};

const apiClient = {
  authApi,
  roomApi,
  reservationApi,
  inquiryApi,
  userApi,
};

export default apiClient;
