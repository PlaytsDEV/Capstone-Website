// Common API utilities
export const commonApi = {
  handleResponse: async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "An error occurred");
    }
    return response.json();
  },

  handleError: (error) => {
    console.error("API Error:", error);
    return {
      error: error.message || "An unexpected error occurred",
    };
  },
};
