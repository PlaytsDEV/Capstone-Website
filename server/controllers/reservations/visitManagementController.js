/**
 * ============================================================================
 * VISIT MANAGEMENT CONTROLLER
 * ============================================================================
 *
 * Handles physical visit scheduling, availability rules, visit outcomes, and document prechecks.
 */

import { Reservation } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import { sendSuccess } from "../../middleware/errorHandler.js";
import {
  isValidObjectId,
  invalidIdResponse,
} from "../../utils/reservationHelpers.js";
import {
  buildVisitAvailability,
  getVisitAvailabilitySettings,
  serializeVisitAvailabilitySettings,
  updateVisitAvailabilitySettings,
} from "../../utils/visitAvailability.js";
import {
  isAllowedReservationDocumentUrl,
  runReservationDocumentPrecheck,
} from "../../services/reservationDocumentPrecheckService.js";
import {
  DOCUMENT_PRECHECK_TYPES,
  findDbUser,
  resolveVisitAvailabilityBranch,
  buildVisitAvailabilityActor,
  normalizeDocumentPrecheckType,
  mapAiStatusToLegacyValidationStatus,
} from "./_helpers.js";

export const getVisitAvailability = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const availability = await buildVisitAvailability({
      branch: branchResult.branch,
      from: req.query.from,
      days: req.query.days,
      roomId: req.query.roomId || null,
      excludeReservationId: req.query.reservationId || null,
    });

    return sendSuccess(res, availability);
  } catch (error) {
    next(error);
  }
};

export const getVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const settings = await getVisitAvailabilitySettings(branchResult.branch);
    return sendSuccess(res, serializeVisitAvailabilitySettings(settings));
  } catch (error) {
    next(error);
  }
};

export const updateVisitAvailabilityRules = async (req, res, next) => {
  try {
    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
    }

    const branchResult = resolveVisitAvailabilityBranch(req, dbUser);
    if (branchResult.error) {
      return res
        .status(branchResult.code === "BRANCH_ACCESS_DENIED" ? 403 : 400)
        .json(branchResult);
    }

    const beforeSettings = await getVisitAvailabilitySettings(branchResult.branch);
    const beforePayload = serializeVisitAvailabilitySettings(beforeSettings);
    const settings = await updateVisitAvailabilitySettings(
      branchResult.branch,
      req.body || {},
      buildVisitAvailabilityActor(req, dbUser),
    );
    const afterPayload = serializeVisitAvailabilitySettings(settings);

    await auditLogger.logModification(
      req,
      "visit_availability",
      branchResult.branch,
      beforePayload,
      afterPayload,
      "Updated visit availability rules",
    );

    return sendSuccess(res, afterPayload);
  } catch (error) {
    next(error);
  }
};

export const precheckReservationDocument = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (String(reservation.userId) !== String(dbUser._id)) {
      return res.status(403).json({
        error:
          "Access denied. You can only pre-check your own reservation documents.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const documentType = normalizeDocumentPrecheckType(
      req.body.documentType || req.body.type || "valid_id_front",
    );
    if (!documentType) {
      return res.status(400).json({
        error: "Unsupported document type for document pre-check.",
        code: "INVALID_DOCUMENT_PRECHECK_TYPE",
      });
    }

    const config = DOCUMENT_PRECHECK_TYPES[documentType];
    const documentUrl =
      req.body.documentUrl || reservation[config.reservationField] || "";
    const idType =
      req.body.idType || reservation.idType || reservation.validIDType || "";

    if (!documentUrl) {
      return res.status(422).json({
        error: "Document URL is required before running the pre-check.",
        code: "DOCUMENT_URL_REQUIRED",
      });
    }
    if (!isAllowedReservationDocumentUrl(documentUrl)) {
      return res.status(400).json({
        error: "Please upload the document through the portal before running the pre-check.",
        code: "INVALID_DOCUMENT_URL",
      });
    }

    if (config.requiresIdType && !String(idType || "").trim()) {
      return res.status(422).json({
        error: "Please select the ID type before running the document pre-check.",
        code: "DOCUMENT_ID_TYPE_REQUIRED",
      });
    }

    const result = await runReservationDocumentPrecheck({
      documentType,
      documentUrl,
      idType,
    });

    reservation.set(config.reservationField, documentUrl);
    if (config.requiresIdType && String(idType || "").trim()) {
      reservation.idType = idType;
      reservation.validIDType = idType;
    }
    reservation.set(`documentPrechecks.${config.precheckField}`, result);
    await reservation.save();

    return res.json({
      documentType,
      ...result,
      message:
        result.applicantMessage ||
        result.summaryMessage ||
        "Document pre-check completed. Admin will still review the upload.",
      validationStatus: mapAiStatusToLegacyValidationStatus(result),
      warnings: result.aiCheckWarnings,
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Reservation document pre-check error",
    );
    return next(error);
  }
};
