import { authFetch } from "./apiClient.js";

const financialApi = {
  /** Owner: get financial overview for a branch or all branches */
  getOverview: (branch) =>
    authFetch(`/financial/overview${branch && branch !== "all" ? `?branch=${branch}` : ""}`),
};

export default financialApi;
