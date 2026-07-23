/**
 * ============================================================================
 * MAINTENANCE ANALYTICS SERVICE
 * ============================================================================
 *
 * Maintenance SLA calculation, branch performance metrics, and analytics builder.
 */

import {
  formatMaintenanceStatusLabel,
  formatMaintenanceTypeLabel,
  normalizeMaintenanceStatus,
  normalizeMaintenanceUrgency,
} from "../../config/maintenance.js";
import { ROOM_BRANCH_LABELS } from "../../config/branches.js";

const COMPLETED_STATUSES = new Set(["resolved", "completed", "closed"]);
const STOPPED_STATUSES = new Set(["cancelled", "rejected"]);
const TERMINAL_STATUSES = new Set([...COMPLETED_STATUSES, ...STOPPED_STATUSES]);
const SLA_TARGET_HOURS = Object.freeze({
  high: 24,
  normal: 72,
  low: 120,
});

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString();
};

const formatMonthKey = (value) => {
  const date = toDate(value);
  if (!date) return "Unknown";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const formatDuration = (hours) => {
  const value = toNumber(hours);
  if (value == null) return "Not enough data";
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 48) return `${value.toFixed(value < 10 ? 1 : 0)} hr`;
  return `${(value / 24).toFixed(1)} days`;
};

const average = (values) => {
  const valid = values.map(toNumber).filter((value) => value != null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const countBy = (items, getKey) => {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Unknown";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const mapToRows = (map, labelFormatter = (value) => value) =>
  [...map.entries()]
    .map(([key, value]) => ({
      key,
      label: labelFormatter(key),
      value,
    }))
    .sort((left, right) => right.value - left.value || String(left.label).localeCompare(String(right.label)));

export const getMaintenanceAnalyticsSlaState = (request = {}, now = new Date()) => {
  const status = normalizeMaintenanceStatus(request.status);
  if (COMPLETED_STATUSES.has(status)) {
    return { key: "completed", label: "Completed", overdue: false, dueSoon: false };
  }
  if (STOPPED_STATUSES.has(status)) {
    return { key: "closed", label: "Closed", overdue: false, dueSoon: false };
  }

  const startedAt = toDate(request.reopened_at || request.created_at);
  if (!startedAt) {
    return { key: "on_track", label: "On Track", overdue: false, dueSoon: false };
  }

  const urgency = normalizeMaintenanceUrgency(request.urgency) || "normal";
  const targetHours = SLA_TARGET_HOURS[urgency] || SLA_TARGET_HOURS.normal;
  const targetAt = new Date(startedAt.getTime() + targetHours * 60 * 60 * 1000);
  const elapsedHours = (now.getTime() - startedAt.getTime()) / 36e5;
  const remainingHours = (targetAt.getTime() - now.getTime()) / 36e5;

  if (remainingHours < 0) {
    return {
      key: "overdue",
      label: "Overdue",
      overdue: true,
      dueSoon: false,
      targetAt: targetAt.toISOString(),
      overdueHours: Math.abs(remainingHours),
    };
  }

  const dueSoon = remainingHours <= 12 || elapsedHours / targetHours >= 0.8;
  return {
    key: dueSoon ? "due_soon" : "on_track",
    label: dueSoon ? "Due Soon" : "On Track",
    overdue: false,
    dueSoon,
    targetAt: targetAt.toISOString(),
    remainingHours,
  };
};

const getAssignedProviderName = (request = {}) =>
  request.assignedProviderName ||
  request.assigned_to ||
  request.assignedProvider?.name ||
  "";

const getAssignedProviderContact = (request = {}) =>
  request.assignedProviderContact ||
  request.assignedProvider?.contactNumber ||
  "";

const getFirstResponseAt = (request = {}) => {
  const candidates = [
    request.work_started_at,
    ...(Array.isArray(request.statusHistory)
      ? request.statusHistory
          .filter((entry) => !["tenant", "applicant"].includes(String(entry.actor_role || "").toLowerCase()))
          .map((entry) => entry.timestamp)
      : []),
    ...(Array.isArray(request.conversation)
      ? request.conversation
          .filter((entry) => entry.sender_side === "admin")
          .map((entry) => entry.created_at)
      : []),
  ]
    .map(toDate)
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  return candidates[0] || null;
};

const getResolutionAt = (request = {}) => {
  const status = normalizeMaintenanceStatus(request.status);
  if (!COMPLETED_STATUSES.has(status)) return null;
  return toDate(request.resolved_at || request.closed_at || request.updated_at);
};

const getHoursBetween = (from, to) => {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end || end < start) return null;
  return (end.getTime() - start.getTime()) / 36e5;
};

const normalizeFilterValue = (value) => {
  const text = String(value || "").trim();
  return text && text !== "all" ? text : "";
};

const requestMatchesDerivedFilters = (request, filters = {}, now = new Date()) => {
  const provider = normalizeFilterValue(filters.provider);
  if (provider && getAssignedProviderName(request) !== provider) return false;

  const assignmentStatus = normalizeFilterValue(filters.assignmentStatus);
  if (assignmentStatus === "assigned" && !getAssignedProviderName(request)) return false;
  if (assignmentStatus === "unassigned" && getAssignedProviderName(request)) return false;

  const sla = getMaintenanceAnalyticsSlaState(request, now);
  const slaHealth = normalizeFilterValue(filters.slaHealth);
  if (slaHealth && slaHealth !== sla.key) return false;

  if (filters.overdueOnly && !sla.overdue) return false;

  return true;
};

const serializeRequest = (request = {}, tenantMap = new Map(), now = new Date()) => {
  const tenant = tenantMap.get(request.user_id) || {};
  const providerName = getAssignedProviderName(request);
  const firstResponseAt = getFirstResponseAt(request);
  const resolutionAt = getResolutionAt(request);
  const responseHours = getHoursBetween(request.created_at, firstResponseAt);
  const resolutionHours = getHoursBetween(request.created_at, resolutionAt);
  const sla = getMaintenanceAnalyticsSlaState(request, now);

  return {
    requestId: request.request_id,
    tenantName:
      `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() ||
      request.tenant?.full_name ||
      "Unknown Tenant",
    branch: request.branch || null,
    branchLabel: ROOM_BRANCH_LABELS[request.branch] || request.branch || "Branch missing",
    room: request.roomName || request.roomLabel || "",
    requestType: request.request_type,
    requestTypeLabel: formatMaintenanceTypeLabel(request.request_type),
    urgency: request.urgency,
    urgencyLabel: request.urgency ? request.urgency.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Normal",
    status: request.status,
    statusLabel: formatMaintenanceStatusLabel(request.status),
    assignedProvider: providerName || "Unassigned",
    assignedProviderContact: getAssignedProviderContact(request),
    createdAt: formatDateTime(request.created_at),
    updatedAt: formatDateTime(request.updated_at),
    firstResponseAt: formatDateTime(firstResponseAt),
    resolutionAt: formatDateTime(resolutionAt),
    responseHours,
    resolutionHours,
    sla,
    description: request.description || "",
  };
};

const buildMonthlyTrend = (requests, now) => {
  const monthMap = new Map();
  requests.forEach((request) => {
    const month = formatMonthKey(request.created_at);
    const current = monthMap.get(month) || {
      key: month,
      label: month,
      total: 0,
      completed: 0,
      overdue: 0,
    };
    current.total += 1;
    if (COMPLETED_STATUSES.has(normalizeMaintenanceStatus(request.status))) current.completed += 1;
    if (getMaintenanceAnalyticsSlaState(request, now).overdue) current.overdue += 1;
    monthMap.set(month, current);
  });
  return [...monthMap.values()].sort((left, right) => left.key.localeCompare(right.key));
};

const buildBranchRows = (requests, now) => {
  const branchMap = new Map();
  requests.forEach((request) => {
    const branch = request.branch || "missing";
    const current = branchMap.get(branch) || {
      key: branch,
      label: ROOM_BRANCH_LABELS[branch] || branch,
      value: 0,
      overdue: 0,
      resolutionHours: [],
    };
    current.value += 1;
    if (getMaintenanceAnalyticsSlaState(request, now).overdue) current.overdue += 1;
    const resolutionAt = getResolutionAt(request);
    const resolutionHours = getHoursBetween(request.created_at, resolutionAt);
    if (resolutionHours != null) current.resolutionHours.push(resolutionHours);
    branchMap.set(branch, current);
  });

  return [...branchMap.values()].map((row) => ({
    ...row,
    avgResolutionHours: average(row.resolutionHours),
    avgResolutionLabel: formatDuration(average(row.resolutionHours)),
  }));
};

export const buildMaintenanceAnalytics = ({
  requests = [],
  tenantMap = new Map(),
  filters = {},
  generatedBy = null,
  isOwner = false,
  now = new Date(),
} = {}) => {
  const filteredRequests = requests.filter((request) =>
    requestMatchesDerivedFilters(request, filters, now),
  );
  const rows = filteredRequests.map((request) => serializeRequest(request, tenantMap, now));
  const responseHours = rows.map((request) => request.responseHours).filter((value) => value != null);
  const resolutionHours = rows.map((request) => request.resolutionHours).filter((value) => value != null);
  const completedCount = rows.filter((request) =>
    COMPLETED_STATUSES.has(normalizeMaintenanceStatus(request.status)),
  ).length;
  const cancelledRejectedCount = rows.filter((request) =>
    STOPPED_STATUSES.has(normalizeMaintenanceStatus(request.status)),
  ).length;
  const overdueCount = rows.filter((request) => request.sla.overdue).length;
  const statusRows = mapToRows(countBy(filteredRequests, (request) => normalizeMaintenanceStatus(request.status)), formatMaintenanceStatusLabel);
  const issueTypeRows = mapToRows(countBy(filteredRequests, (request) => request.request_type), formatMaintenanceTypeLabel);
  const urgencyRows = mapToRows(countBy(filteredRequests, (request) => normalizeMaintenanceUrgency(request.urgency) || "normal"), (value) =>
    String(value).replace(/\b\w/g, (letter) => letter.toUpperCase()),
  );
  const branchRows = buildBranchRows(filteredRequests, now);
  const mostCommonIssue = issueTypeRows[0] || null;
  const branchWithMostRequests = branchRows
    .slice()
    .sort((left, right) => right.value - left.value)[0] || null;

  const providerPerformance = buildMaintenanceProviderPerformance({
    requests: filteredRequests,
    tenantMap,
    now,
  });

  return {
    scope: {
      generatedAt: now.toISOString(),
      generatedBy,
      branch: filters.branch || "all",
      branchLabel: filters.branch && filters.branch !== "all"
        ? ROOM_BRANCH_LABELS[filters.branch] || filters.branch
        : "All Branches",
      isOwner,
    },
    filters,
    summary: {
      totalRequests: rows.length,
      pendingRequests: rows.filter((request) => request.status === "pending" || request.status === "viewed").length,
      inProgressRequests: rows.filter((request) => request.status === "in_progress").length,
      completedRequests: completedCount,
      overdueRequests: overdueCount,
      cancelledRejectedRequests: cancelledRejectedCount,
      averageResponseTimeHours: average(responseHours),
      averageResponseTimeLabel: formatDuration(average(responseHours)),
      averageResolutionTimeHours: average(resolutionHours),
      averageResolutionTimeLabel: formatDuration(average(resolutionHours)),
      mostCommonIssueType: mostCommonIssue?.label || "Not enough data",
      assignedRequests: rows.filter((request) => request.assignedProvider !== "Unassigned").length,
      unassignedRequests: rows.filter((request) => request.assignedProvider === "Unassigned").length,
      branchWithMostRequests: isOwner ? branchWithMostRequests?.label || "Not enough data" : null,
    },
    charts: {
      requestsByStatus: statusRows,
      requestsByIssueType: issueTypeRows,
      requestsByUrgency: urgencyRows,
      monthlyTrend: buildMonthlyTrend(filteredRequests, now),
      overdueOverview: [
        { key: "overdue", label: "Overdue", value: overdueCount },
        { key: "not_overdue", label: "Not Overdue", value: Math.max(rows.length - overdueCount, 0) },
      ].filter((item) => item.value > 0),
      requestsPerBranch: branchRows.map(({ key, label, value }) => ({ key, label, value })),
      averageResolutionTimePerBranch: branchRows
        .filter((row) => row.avgResolutionHours != null)
        .map(({ key, label, avgResolutionHours }) => ({ key, label, value: Number(avgResolutionHours.toFixed(2)) })),
      overdueRequestsByBranch: branchRows
        .filter((row) => row.overdue > 0)
        .map(({ key, label, overdue }) => ({ key, label, value: overdue })),
    },
    breakdowns: {
      status: statusRows,
      issueType: issueTypeRows,
      urgency: urgencyRows,
      branch: branchRows,
      assignment: [
        { key: "assigned", label: "Assigned", value: rows.filter((request) => request.assignedProvider !== "Unassigned").length },
        { key: "unassigned", label: "Unassigned", value: rows.filter((request) => request.assignedProvider === "Unassigned").length },
      ],
      completedVsUnresolved: [
        { key: "completed", label: "Completed", value: completedCount },
        {
          key: "unresolved",
          label: "Unresolved",
          value: rows.filter((request) => {
            const status = normalizeMaintenanceStatus(request.status);
            return !COMPLETED_STATUSES.has(status) && !STOPPED_STATUSES.has(status);
          }).length,
        },
      ],
    },
    providerPerformance,
    providerOptions: [...new Set(requests.map(getAssignedProviderName).filter(Boolean))].sort(),
    requests: rows,
  };
};

export const buildMaintenanceProviderPerformance = ({
  requests = [],
  tenantMap = new Map(),
  now = new Date(),
} = {}) => {
  const providerMap = new Map();

  requests.forEach((request) => {
    const providerName = getAssignedProviderName(request);
    if (!providerName) return;

    const current = providerMap.get(providerName) || {
      providerName,
      contactNumber: getAssignedProviderContact(request),
      assignedRequests: 0,
      completedRequests: 0,
      activeRequests: 0,
      overdueRequests: 0,
      completionHours: [],
      lastAssignedRequestDate: null,
      requestTypes: new Set(),
      relatedRequests: [],
    };

    const status = normalizeMaintenanceStatus(request.status);
    const resolutionAt = getResolutionAt(request);
    const completionHours = getHoursBetween(request.created_at, resolutionAt);
    const assignedAt = toDate(request.assigned_at || request.updated_at || request.created_at);

    current.assignedRequests += 1;
    if (COMPLETED_STATUSES.has(status)) current.completedRequests += 1;
    if (!TERMINAL_STATUSES.has(status)) current.activeRequests += 1;
    if (getMaintenanceAnalyticsSlaState(request, now).overdue) current.overdueRequests += 1;
    if (completionHours != null) current.completionHours.push(completionHours);
    if (!current.lastAssignedRequestDate || (assignedAt && assignedAt > current.lastAssignedRequestDate)) {
      current.lastAssignedRequestDate = assignedAt;
    }
    if (request.request_type) current.requestTypes.add(formatMaintenanceTypeLabel(request.request_type));
    current.relatedRequests.push(serializeRequest(request, tenantMap, now));

    providerMap.set(providerName, current);
  });

  return [...providerMap.values()]
    .map((provider) => ({
      providerName: provider.providerName,
      contactNumber: provider.contactNumber || "",
      assignedRequests: provider.assignedRequests,
      completedRequests: provider.completedRequests,
      activeRequests: provider.activeRequests,
      overdueRequests: provider.overdueRequests,
      averageCompletionTimeHours: average(provider.completionHours),
      averageCompletionTimeLabel: formatDuration(average(provider.completionHours)),
      lastAssignedRequestDate: provider.lastAssignedRequestDate
        ? provider.lastAssignedRequestDate.toISOString()
        : "",
      relatedRequestTypes: [...provider.requestTypes].sort(),
      relatedRequests: provider.relatedRequests,
    }))
    .sort((left, right) => right.assignedRequests - left.assignedRequests || left.providerName.localeCompare(right.providerName));
};

export const buildMaintenanceBranchReport = (analytics) => ({
  title: `Maintenance Branch Report - ${analytics.scope.branchLabel}`,
  scope: analytics.scope,
  filters: analytics.filters,
  summary: analytics.summary,
  breakdowns: analytics.breakdowns,
  charts: analytics.charts,
  providerPerformance: analytics.providerPerformance,
  providerOptions: analytics.providerOptions,
  requests: analytics.requests,
});
