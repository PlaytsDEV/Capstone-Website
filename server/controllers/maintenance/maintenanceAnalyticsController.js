/**
 * ============================================================================
 * MAINTENANCE ANALYTICS CONTROLLER
 * ============================================================================
 *
 * Handles analytics calculation, branch reports, provider performance metrics,
 * completion stats, and issue frequency aggregation.
 */

import { MAINTENANCE_LIMIT_MAX } from "./_helpers.js";
import { sendSuccess } from "../../middleware/errorHandler.js";
import { MaintenanceRequest } from "../../models/index.js";
import {
  buildAdminGeneratedBy,
  buildMaintenanceReportQuery,
  getDbUser,
  parseLimit,
  resolveAdminBranchFilter,
  loadTenantMap,
} from "./_helpers.js";
import {
  buildMaintenanceAnalytics,
  buildMaintenanceBranchReport,
} from "../../services/maintenanceAnalyticsService.js";

const loadMaintenanceAnalyticsPayload = async (req) => {
  const { query, filters } = buildMaintenanceReportQuery(req);
  const limit = parseLimit(req.query.limit, MAINTENANCE_LIMIT_MAX);
  const requests = await MaintenanceRequest.find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  const tenantMap = await loadTenantMap(requests);
  const adminUser = await getDbUser(req.user.uid);

  return buildMaintenanceAnalytics({
    requests,
    tenantMap,
    filters,
    generatedBy: buildAdminGeneratedBy(adminUser),
    isOwner: Boolean(req.isOwner),
  });
};

/**
 * GET /api/m/maintenance/admin/analytics
 */
export const getAdminMaintenanceAnalytics = async (req, res, next) => {
  try {
    const analytics = await loadMaintenanceAnalyticsPayload(req);
    sendSuccess(res, analytics);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/m/maintenance/admin/reports/branch
 */
export const getAdminMaintenanceBranchReport = async (req, res, next) => {
  try {
    const analytics = await loadMaintenanceAnalyticsPayload(req);
    sendSuccess(res, buildMaintenanceBranchReport(analytics));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/m/maintenance/admin/reports/providers
 */
export const getAdminMaintenanceProviderReport = async (req, res, next) => {
  try {
    const analytics = await loadMaintenanceAnalyticsPayload(req);
    sendSuccess(res, {
      scope: analytics.scope,
      filters: analytics.filters,
      summary: {
        providerCount: analytics.providerPerformance.length,
        assignedRequests: analytics.summary.assignedRequests,
        overdueAssignedRequests: analytics.providerPerformance.reduce(
          (sum, provider) => sum + provider.overdueRequests,
          0,
        ),
      },
      providers: analytics.providerPerformance,
      providerOptions: analytics.providerOptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maintenance/stats/completion
 */
export const getCompletionStats = async (req, res, next) => {
  try {
    const branch = resolveAdminBranchFilter(req);
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const match = {
      isArchived: false,
      resolved_at: { $gte: startDate },
      status: { $in: ["resolved", "completed"] },
    };
    if (branch) match.branch = branch;

    const stats = await MaintenanceRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$request_type",
          completedCount: { $sum: 1 },
          avgResolutionTimeMs: {
            $avg: { $subtract: ["$resolved_at", "$created_at"] },
          },
        },
      },
      { $sort: { completedCount: -1, _id: 1 } },
    ]);

    sendSuccess(res, {
      branch: branch || "all",
      period: `${days} days`,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maintenance/stats/issue-frequency
 */
export const getIssueFrequency = async (req, res, next) => {
  try {
    const branch = resolveAdminBranchFilter(req);
    const match = { isArchived: false };
    if (branch) match.branch = branch;

    const frequency = await MaintenanceRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$request_type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    sendSuccess(res, {
      branch: branch || "all",
      frequency,
    });
  } catch (error) {
    next(error);
  }
};
