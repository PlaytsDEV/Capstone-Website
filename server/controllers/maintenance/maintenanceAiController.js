/**
 * ============================================================================
 * MAINTENANCE AI CONTROLLER
 * ============================================================================
 *
 * Handles Gemini AI-powered draft generation, maintenance reports, and provider recommendations.
 */

import { ROOM_BRANCH_LABELS } from "../../config/branches.js";
import { AppError, sendSuccess } from "../../middleware/errorHandler.js";
import { ServiceProvider, User } from "../../models/index.js";
import {
  USER_SELECT_FIELDS,
  findAccessibleRequest,
  getDbUser,
  ensureAdminAccess,
  serializeTenantSummary,
  getMaintenanceCategoryLabel,
  resolveMaintenanceRequestBranch,
  buildProviderDirectoryFilter,
  buildGenericProviderDirectoryFilter,
  buildMaintenanceReportPayload,
} from "./_helpers.js";
import {
  generateMaintenanceUpdateDraft,
  suggestMaintenanceProviderFromDirectory,
} from "../../services/maintenanceAiService.js";

/**
 * POST /api/m/maintenance/admin/:requestId/generate-update
 */
export const generateAdminMaintenanceUpdate = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);

    const timeline = [
      ...(Array.isArray(request.statusHistory) ? request.statusHistory : []),
      ...(Array.isArray(request.work_log) ? request.work_log : []),
      ...(Array.isArray(request.conversation) ? request.conversation : []),
    ].sort((left, right) => {
      const leftTime = new Date(left.timestamp || left.logged_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.timestamp || right.logged_at || right.created_at || 0).getTime();
      return leftTime - rightTime;
    });

    const result = await generateMaintenanceUpdateDraft({
      request: {
        ...request.toObject(),
        typeLabel: getMaintenanceCategoryLabel(request),
      },
      timeline,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/generate-report
 */
export const generateAdminMaintenanceReport = async (req, res, next) => {
  try {
    const reportType = String(req.body?.reportType || "").trim().toLowerCase();
    if (!["admin", "tenant"].includes(reportType)) {
      throw new AppError(
        "Report type must be admin or tenant.",
        400,
        "INVALID_REPORT_TYPE",
        [
          {
            field: "reportType",
            message: "Choose Admin Report or Tenant Summary.",
          },
        ],
      );
    }

    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);

    const adminUser = await getDbUser(req.user.uid);
    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();
    const requestSnapshot = {
      ...request.toObject(),
      tenant: serializeTenantSummary(tenantUser, request),
    };
    const report = await buildMaintenanceReportPayload({
      request: requestSnapshot,
      tenant: requestSnapshot.tenant,
      adminUser,
      reportType,
    });

    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/suggest-provider
 */
export const suggestAdminMaintenanceProvider = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);

    const requestBranch = resolveMaintenanceRequestBranch(request);
    if (!requestBranch) {
      sendSuccess(res, {
        message: "This request needs a branch before a saved provider can be suggested.",
        recommendation: null,
        unavailableReason: "missing_branch",
      });
      return;
    }

    let providers = await ServiceProvider.find(buildProviderDirectoryFilter(request))
      .select("+serviceCategoryKeys")
      .lean();
    const fallbackFilter = buildGenericProviderDirectoryFilter(request);
    if (providers.length === 0 && fallbackFilter) {
      providers = await ServiceProvider.find(fallbackFilter)
        .select("+serviceCategoryKeys")
        .lean();
    }

    const suggestion = await suggestMaintenanceProviderFromDirectory({
      request: {
        ...request.toObject(),
        typeLabel: getMaintenanceCategoryLabel(request),
        branchLabel: ROOM_BRANCH_LABELS[request.branch] || request.branch,
      },
      providers,
    });

    sendSuccess(res, suggestion);
  } catch (error) {
    next(error);
  }
};
