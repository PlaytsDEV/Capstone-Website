import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../../api/analyticsApi.js";
import { financialApi } from "../../api/financialApi.js";

export const FINANCIAL_QUERY_KEYS = {
  all: ["financial"],
  overview: (params) => [
    ...FINANCIAL_QUERY_KEYS.all,
    "overview",
    typeof params === "string" ? { branch: params } : params || {},
  ],
  analytics: (params) => [
    ...FINANCIAL_QUERY_KEYS.all,
    "analytics",
    params || {},
  ],
};

const DEFAULT_OPTIONS = {
  placeholderData: keepPreviousData,
  staleTime: 60 * 1000,
  retry: 2,
  retryDelay: 1000,
};

export function useOwnerFinancialOverview(params = {}, options = {}) {
  const normalizedParams = typeof params === "string" ? { branch: params } : params;
  return useQuery({
    queryKey: FINANCIAL_QUERY_KEYS.overview(normalizedParams),
    queryFn: () => analyticsApi.getFinancials(normalizedParams),
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

export function useFinancialOverview(branch = "all", options = {}) {
  return useQuery({
    queryKey: FINANCIAL_QUERY_KEYS.overview(branch),
    queryFn: () => financialApi.getOverview(branch),
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

export function useFinancialsAnalytics(params, options = {}) {
  return useOwnerFinancialOverview(params, options);
}
