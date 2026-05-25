import { ROOM_BRANCHES } from "../config/branches.js";
import { formatMaintenanceTypeLabel, normalizeMaintenanceType } from "../config/maintenance.js";
import { AppError, sendSuccess } from "../middleware/errorHandler.js";
import { ServiceProvider, User } from "../models/index.js";
import { toCategoryKey } from "../models/ServiceProvider.js";
import { clean } from "../utils/sanitize.js";

const USER_SELECT_FIELDS = "user_id firstName lastName email branch role";

const toOptionalText = (value) => {
  if (value == null) return null;
  const sanitized = clean(String(value)).trim();
  return sanitized ? sanitized : null;
};

const sanitizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

const parseOptionalAmount = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("Enter a valid amount.", 400, "INVALID_PROVIDER_RATE", [
      { field, message: "Enter a valid amount." },
    ]);
  }
  return amount;
};

const normalizeBranch = (value) => {
  const branch = String(value || "").trim().toLowerCase();
  return ROOM_BRANCHES.includes(branch) ? branch : "";
};

const normalizeTextList = (value) =>
  [...new Set(
    (Array.isArray(value) ? value : [value])
      .flatMap((entry) => String(entry || "").split(","))
      .map((entry) => toOptionalText(entry))
      .filter(Boolean),
  )];

const GENERIC_MAINTENANCE_FALLBACK_CATEGORIES = Object.freeze([
  "Maintenance",
  "General Maintenance",
]);

const buildCategoryCandidatesFromValues = (values) => {
  const labels = (Array.isArray(values) ? values : [values]).flatMap((value) => {
    const raw = toOptionalText(value);
    if (!raw) return [];
    const normalizedType = normalizeMaintenanceType(raw);
    const label = normalizedType ? formatMaintenanceTypeLabel(normalizedType) : raw;
    return [raw, normalizedType, label].filter(Boolean);
  });

  return {
    labels: [...new Set(labels)],
    keys: [...new Set(labels.map(toCategoryKey).filter(Boolean))],
  };
};

export const buildServiceCategoryCandidates = (value) => {
  if (!toOptionalText(value)) return { labels: [], keys: [] };
  return buildCategoryCandidatesFromValues(value);
};

const isGenericMaintenanceCategory = (value) => {
  const raw = toOptionalText(value);
  if (!raw) return false;
  return normalizeMaintenanceType(raw) === "maintenance" || toCategoryKey(raw) === "general-maintenance";
};

const buildGenericMaintenanceFallbackCandidates = (value) =>
  isGenericMaintenanceCategory(value)
    ? buildCategoryCandidatesFromValues(GENERIC_MAINTENANCE_FALLBACK_CATEGORIES)
    : { labels: [], keys: [] };

const serializeServiceProvider = (provider) => {
  const doc = provider?.toObject ? provider.toObject() : provider;
  if (!doc) return null;

  return {
    id: String(doc._id || doc.id || ""),
    _id: doc._id,
    providerName: doc.providerName,
    contactNumber: doc.contactNumber,
    serviceCategories: Array.isArray(doc.serviceCategories) ? doc.serviceCategories : [],
    branchCoverage: Array.isArray(doc.branchCoverage) ? doc.branchCoverage : [],
    notes: doc.notes || null,
    location: doc.location || null,
    minRate: doc.minRate ?? null,
    maxRate: doc.maxRate ?? null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    status: doc.status || "active",
    averageResponseTime: doc.averageResponseTime || null,
    internalRating: doc.internalRating ?? null,
    internalFeedback: Array.isArray(doc.internalFeedback) ? doc.internalFeedback : [],
    createdBy: doc.createdBy || null,
    updatedBy: doc.updatedBy || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
};

const getDbUser = async (firebaseUid) => {
  const user = await User.findOne({ firebaseUid }).select(USER_SELECT_FIELDS).lean();
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return user;
};

const getAccessibleBranch = (req, requestedBranch = null) => {
  const branch = normalizeBranch(requestedBranch);

  if (req.isOwner) return branch;
  if (!req.branchFilter) {
    throw new AppError("No branch assigned. Please contact the owner.", 403, "NO_BRANCH_ASSIGNED");
  }
  if (branch && branch !== req.branchFilter) {
    throw new AppError("Access denied for this branch.", 403, "FORBIDDEN");
  }
  return req.branchFilter;
};

const applyCategoryFilter = (filter, category) => {
  if (category.keys.length === 0 && category.labels.length === 0) return filter;
  return {
    ...filter,
    $or: [
      ...(category.keys.length ? [{ serviceCategoryKeys: { $in: category.keys } }] : []),
      ...(category.labels.length ? [{ serviceCategories: { $in: category.labels } }] : []),
    ],
  };
};

const getRequestedProviderCategory = (req) =>
  req.query.category || req.query.requestType;

const buildProviderFilter = (
  req,
  category = buildServiceCategoryCandidates(getRequestedProviderCategory(req)),
) => {
  const branch = getAccessibleBranch(
    req,
    req.query.branchId || req.query.branch || req.query.branchCoverage,
  );
  const includeInactive =
    String(req.query.includeInactive || "").trim().toLowerCase() === "true";
  const filter = {};

  if (!includeInactive) filter.status = "active";
  if (branch) filter.branchCoverage = branch;

  return applyCategoryFilter(filter, category);
};

const normalizeProviderPayload = (payload = {}, req) => {
  const providerName = toOptionalText(payload.providerName || payload.name);
  const contactNumber = sanitizeDigitsOnly(payload.contactNumber || payload.phone);
  const serviceCategories = normalizeTextList(
    payload.serviceCategories || payload.categories || payload.serviceType,
  );
  const requestedBranches = normalizeTextList(
    payload.branchCoverage || payload.branches || payload.branchId || payload.branch,
  ).map(normalizeBranch).filter(Boolean);
  const branchCoverage = req.isOwner
    ? requestedBranches
    : requestedBranches.length
      ? requestedBranches
      : [req.branchFilter].filter(Boolean);

  if (!providerName) {
    throw new AppError("Provider name is required.", 400, "PROVIDER_NAME_REQUIRED", [
      { field: "providerName", message: "Provider name is required." },
    ]);
  }
  if (!contactNumber) {
    throw new AppError("Contact number is required.", 400, "PROVIDER_CONTACT_REQUIRED", [
      { field: "contactNumber", message: "Contact number is required." },
    ]);
  }
  if (!/^09\d{9}$/.test(contactNumber)) {
    throw new AppError("Enter a valid 11-digit Philippine mobile number starting with 09.", 400, "INVALID_PROVIDER_CONTACT", [
      { field: "contactNumber", message: "Enter a valid 11-digit Philippine mobile number starting with 09." },
    ]);
  }
  if (serviceCategories.length === 0) {
    throw new AppError("At least one service category is required.", 400, "PROVIDER_CATEGORY_REQUIRED", [
      { field: "serviceCategories", message: "At least one service category is required." },
    ]);
  }
  if (branchCoverage.length === 0) {
    throw new AppError("At least one branch coverage is required.", 400, "PROVIDER_BRANCH_REQUIRED", [
      { field: "branchCoverage", message: "At least one branch coverage is required." },
    ]);
  }
  if (!req.isOwner && branchCoverage.some((branch) => branch !== req.branchFilter)) {
    throw new AppError("Branch admins can only manage providers for their assigned branch.", 403, "FORBIDDEN");
  }

  const status = String(payload.status || "active").trim().toLowerCase();
  if (!["active", "inactive"].includes(status)) {
    throw new AppError("Provider status must be active or inactive.", 400, "INVALID_PROVIDER_STATUS", [
      { field: "status", message: "Provider status must be active or inactive." },
    ]);
  }

  const internalRating =
    payload.internalRating === undefined || payload.internalRating === null || payload.internalRating === ""
      ? null
      : Number(payload.internalRating);
  if (internalRating !== null && (!Number.isFinite(internalRating) || internalRating < 1 || internalRating > 5)) {
    throw new AppError("Internal rating must be between 1 and 5.", 400, "INVALID_PROVIDER_RATING", [
      { field: "internalRating", message: "Internal rating must be between 1 and 5." },
    ]);
  }
  const minRate = parseOptionalAmount(payload.minRate ?? payload.minimumRate, "minRate");
  const maxRate = parseOptionalAmount(payload.maxRate ?? payload.maximumRate, "maxRate");
  if (minRate !== null && maxRate !== null && maxRate < minRate) {
    throw new AppError("Maximum rate cannot be lower than minimum rate.", 400, "INVALID_PROVIDER_RATE_RANGE", [
      { field: "maxRate", message: "Enter a valid amount." },
    ]);
  }

  return {
    providerName,
    contactNumber,
    serviceCategories,
    branchCoverage,
    status,
    notes: toOptionalText(payload.notes),
    location: toOptionalText(payload.location),
    minRate,
    maxRate,
    tags: normalizeTextList(payload.tags),
    averageResponseTime: toOptionalText(payload.averageResponseTime),
    internalRating,
    internalFeedback: normalizeTextList(payload.internalFeedback),
  };
};

export const listServiceProviders = async (req, res, next) => {
  try {
    const requestedCategory = getRequestedProviderCategory(req);
    const exactCategory = buildServiceCategoryCandidates(requestedCategory);
    const exactFilter = buildProviderFilter(req, exactCategory);
    let providers = await ServiceProvider.find(exactFilter)
      .sort({ providerName: 1, createdAt: -1 })
      .lean();

    const fallbackCategory = buildGenericMaintenanceFallbackCandidates(requestedCategory);
    if (providers.length === 0 && fallbackCategory.keys.length + fallbackCategory.labels.length > 0) {
      providers = await ServiceProvider.find(buildProviderFilter(req, fallbackCategory))
        .sort({ providerName: 1, createdAt: -1 })
        .lean();
    }

    sendSuccess(res, {
      providers: providers.map(serializeServiceProvider),
    });
  } catch (error) {
    next(error);
  }
};

export const createServiceProvider = async (req, res, next) => {
  try {
    const adminUser = await getDbUser(req.user.uid);
    const payload = normalizeProviderPayload(req.body, req);
    const provider = await ServiceProvider.create({
      ...payload,
      createdBy: adminUser.user_id || String(adminUser._id || ""),
      updatedBy: adminUser.user_id || String(adminUser._id || ""),
    });

    sendSuccess(res, { provider: serializeServiceProvider(provider) }, 201);
  } catch (error) {
    next(error);
  }
};

export const updateServiceProvider = async (req, res, next) => {
  try {
    const provider = await ServiceProvider.findById(req.params.id);
    if (!provider) {
      throw new AppError("Service provider not found.", 404, "SERVICE_PROVIDER_NOT_FOUND");
    }
    if (!req.isOwner && !provider.branchCoverage.includes(req.branchFilter)) {
      throw new AppError("Access denied for this provider.", 403, "FORBIDDEN");
    }

    const adminUser = await getDbUser(req.user.uid);
    const payload = normalizeProviderPayload(
      {
        providerName: req.body.providerName ?? provider.providerName,
        contactNumber: req.body.contactNumber ?? provider.contactNumber,
        serviceCategories: req.body.serviceCategories ?? provider.serviceCategories,
        branchCoverage: req.body.branchCoverage ?? provider.branchCoverage,
        status: req.body.status ?? provider.status,
        notes: req.body.notes ?? provider.notes,
        location: req.body.location ?? provider.location,
        minRate: req.body.minRate ?? provider.minRate,
        maxRate: req.body.maxRate ?? provider.maxRate,
        tags: req.body.tags ?? provider.tags,
        averageResponseTime: req.body.averageResponseTime ?? provider.averageResponseTime,
        internalRating: req.body.internalRating ?? provider.internalRating,
        internalFeedback: req.body.internalFeedback ?? provider.internalFeedback,
      },
      req,
    );

    Object.assign(provider, {
      ...payload,
      updatedBy: adminUser.user_id || String(adminUser._id || ""),
    });
    await provider.save();

    sendSuccess(res, { provider: serializeServiceProvider(provider) });
  } catch (error) {
    next(error);
  }
};
