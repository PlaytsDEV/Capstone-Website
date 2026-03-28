import { useQuery } from "@tanstack/react-query";
import financialApi from "../../api/financialApi.js";

/**
 * Owner-only: financial overview KPIs + per-room breakdown.
 * @param {string} branch - branch filter, or "all" / undefined for all branches
 */
export function useFinancialOverview(branch) {
  return useQuery({
    queryKey: ["financial", "overview", branch || "all"],
    queryFn: () => financialApi.getOverview(branch),
    staleTime: 60_000, // 1-minute cache — financial data doesn't need real-time
  });
}
