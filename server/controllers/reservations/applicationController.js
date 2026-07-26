/**
 * ============================================================================
 * APPLICATION & PAYMENT CONTROLLER
 * ============================================================================
 *
 * Handles tenant application draft saving, parallel precheck application submission,
 * and proof of payment submission.
 */

import { Reservation, Room } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import auditLogger from "../../utils/auditLogger.js";
import {
  isValidObjectId,
  invalidIdResponse,
  handleReservationError,
  buildUserUpdatePayload,
  getForbiddenTenantUpdateFields,
} from "../../utils/reservationHelpers.js";
import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../utils/lifecycleNaming.js";
import { notify } from "../../utils/notificationService.js";
import { emitToAdmins } from "../../utils/socket.js";
import {
  runReservationDocumentPrecheck,
} from "../../services/reservationDocumentPrecheckService.js";
import {
  DOCUMENT_PRECHECK_TYPES,
  APPLICATION_DRAFT_LOCKING_STATUSES,
  POPULATE_USER,
  POPULATE_ROOM,
  findDbUser,
  buildReservationPricing,
  buildEmptyDocumentPrecheck,
  getDocumentPrecheckStatus,
  shouldBlockDocumentSubmission,
  shouldAllowPaymentAccess,
  isVisitApplicationUnlocked,
  getEffectiveVisitStatusKey,
  isAllowedReservationDocumentUrl,
  ensureRoomReservationCapacity,
  isActiveBedAssignmentDuplicateError,
  validateSelectedBedForReservation,
  serializeReservation,
  BED_UNAVAILABLE_MESSAGE,
} from "./_helpers.js";

/** Helper: Timeout wrapper for async document precheck (8s cap) */
const runPrecheckWithTimeout = async (target, timeoutMs = 8000) => {
  const precheckPromise = (async () => {
    const config = DOCUMENT_PRECHECK_TYPES[target.documentType];
    const nextUrl = String(target.documentUrl || "").trim();
    const urlAllowed = isAllowedReservationDocumentUrl(nextUrl);

    if (!urlAllowed) return null;

    return await runReservationDocumentPrecheck({
      documentType: target.documentType,
      documentUrl: nextUrl,
      idType: target.idType,
    });
  })();

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        precheckStatus: "manual_review_fallback",
        readabilityStatus: "unknown",
        documentTypeStatus: "unknown",
        canSubmit: true,
        requiresManualReview: true,
        applicantMessage: `${target.label} pre-check timed out. Admin will review manually.`,
        summaryMessage: "Pre-check timed out, falling back to manual review.",
        aiCheckStatus: "not_checked",
        aiCheckWarnings: ["Precheck service timeout — manual review required."],
      });
    }, timeoutMs);
  });

  return Promise.race([precheckPromise, timeoutPromise]);
};

/**
 * 1. Save Application Draft
 * Route: PATCH /reservations/:id/application/draft
 */
export const saveApplicationDraft = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
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
        error: "Access denied. You can only update your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const currentStatus = normalizeReservationStatus(reservation.status);
    const draftLocked =
      hasReservationStatus(currentStatus, APPLICATION_DRAFT_LOCKING_STATUSES) ||
      (Boolean(reservation.applicationSubmittedAt) &&
        !hasReservationStatus(currentStatus, "needs_revision")) ||
      Boolean(reservation.paymentDate || reservation.proofOfPaymentUrl);

    if (draftLocked) {
      return res.status(409).json({
        error:
          "Application draft is locked because this application is already submitted or under review.",
        code: "APPLICATION_DRAFT_LOCKED",
      });
    }

    const forbiddenFields = getForbiddenTenantUpdateFields(req.body);
    if (forbiddenFields.length > 0) {
      return res.status(400).json({
        error: `Tenant updates cannot set protected reservation fields: ${forbiddenFields.join(", ")}.`,
        code: "TENANT_FIELD_NOT_ALLOWED",
        fields: forbiddenFields,
      });
    }

    const updates = buildUserUpdatePayload(req.body);
    const hasBodyField = (field) => Object.prototype.hasOwnProperty.call(req.body, field);

    const resetDocumentPrecheck = (bodyField, precheckField) => {
      if (!hasBodyField(bodyField)) return;
      const nextUrl = updates[bodyField] ?? req.body[bodyField] ?? "";
      const currentUrl = reservation[bodyField] ?? "";
      if (String(nextUrl || "") === String(currentUrl || "")) return;
      updates[`documentPrechecks.${precheckField}`] = buildEmptyDocumentPrecheck();
    };

    resetDocumentPrecheck("validIDFrontUrl", "validIDFront");
    resetDocumentPrecheck("validIDBackUrl", "validIDBack");
    resetDocumentPrecheck("nbiClearanceUrl", "nbiClearance");
    resetDocumentPrecheck("companyIDUrl", "companyID");

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate(...POPULATE_USER)
      .populate(...POPULATE_ROOM);

    // Refresh active bed hold lock on draft saves (prevents silent expiration during form entry)
    if (reservation.roomId && reservation.selectedBed?.id) {
      try {
        const targetRoom = await Room.findById(reservation.roomId);
        if (targetRoom) {
          targetRoom.extendBedLock(reservation.selectedBed.id, dbUser._id, 15);
          await targetRoom.save();
        }
      } catch (lockErr) {
        // Non-fatal bed lock extension error
      }
    }

    return res.json({
      message: "Application draft saved successfully",
      reservation: serializeReservation(updatedReservation),
    });
  } catch (error) {
    if (isActiveBedAssignmentDuplicateError(error)) {
      return res.status(409).json({
        error: BED_UNAVAILABLE_MESSAGE,
        code: "BED_UNAVAILABLE",
      });
    }
    logger.error(
      { err: error, requestId: req.id },
      "Application draft save error",
    );
    return handleReservationError(res, error, "save application draft");
  }
};

/**
 * 2. Submit Application (Parallel OCR Pre-checks + Optimistic Lock)
 * Route: POST /reservations/:id/application/submit
 */
export const submitApplication = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
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
        error: "Access denied. You can only submit your own application.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const updates = buildUserUpdatePayload(req.body);
    const previouslySubmittedApplication = Boolean(reservation.applicationSubmittedAt);

    // Out of town bypass (Phase 4.6 integration)
    const effectiveVisitStatus = getEffectiveVisitStatusKey({
      visitStatus: updates.visitStatus ?? reservation.visitStatus,
      visitApproved: reservation.visitApproved,
      scheduleRejected: reservation.scheduleRejected,
      scheduleApproved: reservation.scheduleApproved,
      viewingPreference: reservation.viewingPreference,
      viewingType: reservation.viewingType,
      visitDate: reservation.visitDate,
      isOutOfTown: reservation.isOutOfTown,
      isOutOfTownApproved: reservation.isOutOfTownApproved,
    });

    if (
      (updates.viewingPreference ?? reservation.viewingPreference) === "physical_visit" &&
      !previouslySubmittedApplication &&
      !isVisitApplicationUnlocked(reservation) &&
      !isVisitApplicationUnlocked(effectiveVisitStatus)
    ) {
      return res.status(403).json({
        error:
          "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed.",
        code: "PHYSICAL_VISIT_APPLICATION_LOCKED",
        visitStatus: effectiveVisitStatus || "physical_visit_scheduled",
      });
    }

    const effectiveValidIDFrontUrl =
      updates.validIDFrontUrl ?? reservation.validIDFrontUrl ?? "";
    const effectiveValidIDBackUrl =
      updates.validIDBackUrl ?? reservation.validIDBackUrl ?? "";
    const effectiveNbiUrl = updates.nbiClearanceUrl ?? reservation.nbiClearanceUrl ?? "";
    const effectiveCompanyUrl = updates.companyIDUrl ?? reservation.companyIDUrl ?? "";
    const submittedIdType =
      updates.idType ?? updates.validIDType ?? reservation.idType ?? reservation.validIDType ?? "";

    const documentUrlFields = [
      { key: "selfiePhotoUrl", label: "profile photo", url: updates.selfiePhotoUrl ?? reservation.selfiePhotoUrl },
      { key: "validIDFrontUrl", label: "valid ID (front)", url: effectiveValidIDFrontUrl },
      { key: "validIDBackUrl", label: "valid ID (back)", url: effectiveValidIDBackUrl },
      { key: "nbiClearanceUrl", label: "NBI clearance", url: effectiveNbiUrl },
      { key: "companyIDUrl", label: "company ID", url: effectiveCompanyUrl },
    ];
    const invalidUrls = documentUrlFields
      .filter((item) => item.url && !isAllowedReservationDocumentUrl(item.url))
      .map((item) => ({ key: item.key, label: item.label, message: `${item.label} has an invalid document URL.` }));

    if (invalidUrls.length > 0) {
      return res.status(422).json({
        error: `Please upload valid documents before submitting: ${invalidUrls.map((i) => i.label).join(", ")}.`,
        code: "INVALID_DOCUMENT_URLS",
        documentIssues: invalidUrls,
      });
    }

    const missingRequired = [];
    const hasVal = (v) => v != null && String(v).trim().length > 0;
    const isValidPHPhone = (v) => v != null && /^09\d{9}$/.test(String(v));

    const effectiveViewingPref = updates.viewingPreference ?? reservation.viewingPreference;
    const effectiveFirstName = updates.firstName ?? reservation.firstName;
    const effectiveLastName = updates.lastName ?? reservation.lastName;
    const effectiveMobileNumber = updates.mobileNumber ?? reservation.mobileNumber;
    const effectiveBirthday = updates.birthday ?? reservation.birthday;
    const effectiveMaritalStatus = updates.maritalStatus ?? reservation.maritalStatus;
    const effectiveNationality = updates.nationality ?? reservation.nationality;
    const effectiveEducationLevel = updates.educationLevel ?? reservation.educationLevel;
    const effectiveAddressUnit = updates["address.unitHouseNo"] ?? reservation.address?.unitHouseNo;
    const effectiveAddressStreet = updates["address.street"] ?? reservation.address?.street;
    const effectiveAddressRegion = updates["address.region"] ?? reservation.address?.region;
    const effectiveAddressProvince = updates["address.province"] ?? reservation.address?.province;
    const effectiveAddressCity = updates["address.city"] ?? reservation.address?.city;
    const effectiveAddressBarangay = updates["address.barangay"] ?? reservation.address?.barangay;
    const effectiveEmergencyName = updates["emergencyContact.name"] ?? reservation.emergencyContact?.name;
    const effectiveEmergencyRelationship = updates["emergencyContact.relationship"] ?? reservation.emergencyContact?.relationship;
    const effectiveEmergencyPhone = updates["emergencyContact.contactNumber"] ?? reservation.emergencyContact?.contactNumber;
    const effectiveHealthConcerns = updates.healthConcerns ?? reservation.healthConcerns;
    const effectiveEmployerSchool = updates["employment.employerSchool"] ?? reservation.employment?.employerSchool;
    const effectiveEmployerAddress = updates["employment.employerAddress"] ?? reservation.employment?.employerAddress;
    const effectiveOccupation = updates["employment.occupation"] ?? reservation.employment?.occupation;
    const effectiveReferralSource = updates.referralSource ?? reservation.referralSource;
    const effectiveTargetMoveInDate = updates.intendedMoveInDate ?? updates.targetMoveInDate ?? reservation.intendedMoveInDate ?? reservation.targetMoveInDate;
    const effectiveEstimatedMoveInTime = updates.estimatedMoveInTime ?? reservation.estimatedMoveInTime;
    const effectiveLeaseDuration = updates.leaseDuration ?? reservation.leaseDuration;
    const effectiveWorkSchedule = updates.workSchedule ?? reservation.workSchedule;
    const effectiveWorkScheduleOther = updates.workScheduleOther ?? reservation.workScheduleOther;
    const submittedPrivacyAgreement = req.body.agreedToPrivacy === true || reservation.agreedToPrivacy === true;
    const submittedCertificationAgreement = req.body.agreedToCertification === true || reservation.agreedToCertification === true;

    if (!hasVal(effectiveViewingPref)) missingRequired.push("viewing / move-in preference");
    if (!hasVal(effectiveFirstName)) missingRequired.push("first name");
    if (!hasVal(effectiveLastName)) missingRequired.push("last name");
    if (!isValidPHPhone(effectiveMobileNumber)) missingRequired.push("mobile number");
    if (!hasVal(effectiveBirthday)) missingRequired.push("birthday");
    if (!hasVal(effectiveMaritalStatus)) missingRequired.push("marital status");
    if (!hasVal(effectiveNationality)) missingRequired.push("nationality");
    if (!hasVal(effectiveEducationLevel)) missingRequired.push("educational attainment");
    if (!hasVal(effectiveAddressUnit)) missingRequired.push("unit / house no.");
    if (!hasVal(effectiveAddressStreet)) missingRequired.push("street");
    if (!hasVal(effectiveAddressRegion)) missingRequired.push("region");
    if (!hasVal(effectiveAddressProvince)) missingRequired.push("province");
    if (!hasVal(effectiveAddressCity)) missingRequired.push("city / municipality");
    if (!hasVal(effectiveAddressBarangay)) missingRequired.push("barangay");
    if (!hasVal(updates.selfiePhotoUrl || reservation.selfiePhotoUrl)) missingRequired.push("profile photo");
    if (!hasVal(effectiveEmergencyName)) missingRequired.push("emergency contact name");
    if (!hasVal(effectiveEmergencyRelationship)) missingRequired.push("emergency contact relationship");
    if (!isValidPHPhone(effectiveEmergencyPhone)) missingRequired.push("emergency contact phone");
    if (!hasVal(effectiveHealthConcerns)) missingRequired.push("health concerns");
    if (!hasVal(effectiveEmployerSchool)) missingRequired.push("current employer / school");
    if (!hasVal(effectiveEmployerAddress)) missingRequired.push("employer address");
    if (!hasVal(effectiveOccupation)) missingRequired.push("occupation");
    if (!hasVal(effectiveReferralSource)) missingRequired.push("referral source");
    if (!hasVal(effectiveTargetMoveInDate)) missingRequired.push("intended move-in date");
    if (!hasVal(effectiveEstimatedMoveInTime)) missingRequired.push("estimated move-in time");
    if (!Number.isFinite(Number(effectiveLeaseDuration)) || Number(effectiveLeaseDuration) <= 0 || Number(effectiveLeaseDuration) > 24) missingRequired.push("duration of lease (1-24 months)");
    if (!hasVal(effectiveWorkSchedule)) missingRequired.push("work schedule");
    if (effectiveWorkSchedule === "others" && !hasVal(effectiveWorkScheduleOther)) missingRequired.push("work schedule details");
    if (!effectiveValidIDFrontUrl) missingRequired.push("valid ID (front)");
    if (!effectiveValidIDBackUrl) missingRequired.push("valid ID (back)");
    if (!submittedIdType) missingRequired.push("valid ID type");
    if (!submittedPrivacyAgreement) missingRequired.push("privacy policy agreement");
    if (!submittedCertificationAgreement) missingRequired.push("certification agreement");

    if (missingRequired.length > 0) {
      return res.status(422).json({
        error: `Application incomplete. Missing required fields: ${missingRequired.join(", ")}.`,
        code: "APPLICATION_INCOMPLETE",
        missingFields: missingRequired,
      });
    }

    const submissionRoomId = updates.roomId || reservation.roomId?._id || reservation.roomId;
    const room = await Room.findById(submissionRoomId);
    if (!room || room.isArchived) {
      return res.status(400).json({
        error: "Room is not available for reservation",
        code: "ROOM_NOT_AVAILABLE",
      });
    }

    const activeReservationCount = await ensureRoomReservationCapacity({
      roomId: room._id,
      excludeReservationId: reservationId,
    });
    if (activeReservationCount >= room.capacity) {
      return res.status(400).json({
        error: "Room is fully booked. Please choose a different room.",
        code: "ROOM_UNAVAILABLE",
      });
    }

    const submittedBed =
      updates.selectedBed !== undefined ? updates.selectedBed : reservation.selectedBed;
    try {
      updates.selectedBed = await validateSelectedBedForReservation({
        room,
        submittedBed,
        excludeReservationId: reservationId,
      });
      if (updates.selectedBed?.id) {
        room.extendBedLock(updates.selectedBed.id, dbUser._id, 15);
        await room.save().catch(() => {});
      }
    } catch (error) {
      if (error?.code === "BED_SELECTION_REQUIRED" || error?.code === "BED_NOT_FOUND" || error?.code === "BED_UNAVAILABLE") {
        return res.status(error.statusCode || 400).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    // Phase 4.7: Parallel document pre-checks with 8s timeout
    const requiredDocumentPrechecks = [
      {
        key: "validIDFront",
        label: "Valid ID (Front)",
        documentType: "valid_id_front",
        documentUrl: effectiveValidIDFrontUrl,
        idType: submittedIdType,
      },
      {
        key: "validIDBack",
        label: "Valid ID (Back)",
        documentType: "valid_id_back",
        documentUrl: effectiveValidIDBackUrl,
        idType: submittedIdType,
      },
      effectiveNbiUrl
        ? {
            key: "nbiClearance",
            label: "NBI Clearance",
            documentType: "nbi_clearance",
            documentUrl: effectiveNbiUrl,
          }
        : null,
      effectiveCompanyUrl
        ? {
            key: "companyID",
            label: "Company ID",
            documentType: "company_id",
            documentUrl: effectiveCompanyUrl,
          }
        : null,
    ].filter(Boolean);

    const precheckResults = await Promise.allSettled(
      requiredDocumentPrechecks.map((target) => runPrecheckWithTimeout(target, 8000)),
    );

    const documentIssues = [];
    requiredDocumentPrechecks.forEach((target, index) => {
      const settled = precheckResults[index];
      const precheck = settled.status === "fulfilled" ? settled.value : null;

      if (precheck) {
        const config = DOCUMENT_PRECHECK_TYPES[target.documentType];
        updates[`documentPrechecks.${config.precheckField}`] = precheck;

        if (shouldBlockDocumentSubmission(precheck)) {
          documentIssues.push({
            key: target.key,
            label: target.label,
            precheckStatus: precheck?.precheckStatus || "needs_reupload",
            readabilityStatus: precheck?.readabilityStatus || "unknown",
            documentTypeStatus: precheck?.documentTypeStatus || "unknown",
            message:
              precheck?.applicantMessage ||
              precheck?.summaryMessage ||
              `${target.label} needs a clearer upload before submission.`,
          });
        }
      }
    });

    if (documentIssues.length > 0) {
      return res.status(422).json({
        error: `Please fix the following document before submitting: ${documentIssues
          .map((issue) => `${issue.label} - ${issue.message}`)
          .join("; ")}`,
        code: "DOCUMENT_PRECHECK_BLOCKED",
        documentIssues,
      });
    }

    if (submittedIdType) {
      updates.idType = submittedIdType;
      updates.validIDType = submittedIdType;
    }

    updates.status = "pending_application_review";
    updates.applicationSubmittedAt = new Date();
    if (previouslySubmittedApplication) {
      updates.applicationResubmittedAt = new Date();
    }
    updates.applicationReviewReason = null;
    updates.applicationReviewedAt = null;
    updates.applicationReviewedBy = null;
    updates.approvedForPaymentAt = null;

    // Optimistic lock write
    const updateFilter = { _id: reservationId };
    if (!previouslySubmittedApplication) {
      updateFilter.applicationSubmittedAt = null;
      updateFilter.status = {
        $nin: [
          "pending_application_review",
          "approved_for_payment",
          "payment_pending",
          "reserved",
          "moveIn",
        ],
      };
    }

    const updatedReservation = await Reservation.findOneAndUpdate(
      updateFilter,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate(...POPULATE_USER)
      .populate(...POPULATE_ROOM);

    if (!updatedReservation) {
      return res.status(409).json({
        error: "Application has already been submitted and is currently under review.",
        code: "APPLICATION_ALREADY_SUBMITTED",
      });
    }

    res.json({
      message: "Application submitted successfully",
      reservation: serializeReservation(updatedReservation),
    });

    if (updatedReservation.userId?._id) {
      try {
        await notify.general(
          updatedReservation.userId._id,
          "Application Pending Review",
          "Your application is pending review. Payment will be available once your application and documents are approved.",
          {
            entityType: "reservation",
            entityId: String(updatedReservation._id),
            actionUrl: "/applicant/reservation",
          },
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, requestId: req.id },
          "Pending-review notification failed (non-fatal)",
        );
      }
    }
  } catch (error) {
    if (isActiveBedAssignmentDuplicateError(error)) {
      return res.status(409).json({
        error: BED_UNAVAILABLE_MESSAGE,
        code: "BED_UNAVAILABLE",
      });
    }
    logger.error(
      { err: error, requestId: req.id },
      "Application submission error",
    );
    return handleReservationError(res, error, "submit application");
  }
};

/**
 * 3. Upload Proof of Payment
 * Route: POST /reservations/:id/payment
 */
export const uploadPaymentProof = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidObjectId(reservationId)) return invalidIdResponse(res);

    const dbUser = await findDbUser(req.user.uid);
    if (!dbUser) {
      return res
        .status(404)
        .json({ error: "User not found in database", code: "USER_NOT_FOUND" });
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
        error: "Access denied. You can only update your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    const proofOfPaymentUrl = req.body.proofOfPaymentUrl;
    if (!proofOfPaymentUrl || !isAllowedReservationDocumentUrl(proofOfPaymentUrl)) {
      return res.status(400).json({
        error: "Valid proof of payment URL is required.",
        code: "INVALID_PROOF_OF_PAYMENT_URL",
      });
    }

    const currentStatus = normalizeReservationStatus(reservation.status);
    if (!shouldAllowPaymentAccess(currentStatus)) {
      return res.status(403).json({
        error:
          "Payment is locked. It will only be available after your application and documents are approved.",
        code: "PAYMENT_LOCKED_PENDING_APPLICATION_REVIEW",
      });
    }

    const updates = {
      proofOfPaymentUrl,
      paymentStatus: "partial",
      paymentDate: new Date(),
      status: "payment_pending",
    };

    if (!reservation.paymentReference) {
      const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let ref = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        let candidate = "PAY-";
        for (let i = 0; i < 6; i++)
          candidate += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        const taken = await Reservation.findOne({ paymentReference: candidate })
          .select("_id")
          .lean();
        if (!taken) {
          ref = candidate;
          break;
        }
      }
      updates.paymentReference =
        ref || "PAY-" + Date.now().toString(36).toUpperCase().slice(-6);
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate(...POPULATE_USER)
      .populate(...POPULATE_ROOM);

    res.json({
      message: "Proof of payment uploaded successfully",
      reservation: serializeReservation(updatedReservation),
    });

    try {
      emitToAdmins("payment:updated", {
        reservationId: String(updatedReservation._id),
        paymentStatus: updatedReservation.paymentStatus,
      });
    } catch (socketErr) {
      logger.warn({ err: socketErr }, "Socket emit failed after tenant proof upload (non-fatal)");
    }
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id },
      "Payment proof upload error",
    );
    return handleReservationError(res, error, "upload payment proof");
  }
};
