/**
 * ============================================================================
 * OVERDUE NOTICE & TERMINATION REVIEW CONTROLLER (Spec §21 & §22)
 * ============================================================================
 *
 * Manages the formal 3-step overdue notice escalation state machine and
 * the Administrative Termination Review Board adjudication lifecycle.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import dayjs from "dayjs";
import {
  Bill,
  OverdueNotice,
  TerminationReview,
  Reservation,
  User,
  Room,
} from "../../models/index.js";
import { getAdminInfo } from "./_helpers.js";
import logger from "../../middleware/logger.js";
import { logBillingAudit } from "../../utils/billingAudit.js";
import { sendOverdueNoticeEmail } from "../../config/email.js";
import notify from "../../services/notifications/notificationService.js";

/**
 * Normalizes notice type string/number to 1, 2, or 3
 */
const parseNoticeNumber = (val) => {
  if (typeof val === "number" && [1, 2, 3].includes(val)) return val;
  const str = String(val || "").toLowerCase().trim();
  if (str === "notice_1" || str === "1" || str === "n1") return 1;
  if (str === "notice_2" || str === "2" || str === "n2") return 2;
  if (str === "notice_3" || str === "3" || str === "n3" || str === "notice_3_final") return 3;
  return null;
};

/**
 * GET /api/billing/overdue-notices
 * List overdue accounts, ongoing 3-notice escalation chains, and summary metrics.
 */
export const getOverdueNoticesAction = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch =
      req.branchFilter ||
      (admin.isOwner && req.query.branch && req.query.branch !== "all"
        ? req.query.branch
        : null);

    if (!branch && !admin.isOwner) {
      return res.status(403).json({ success: false, error: "Access denied. Invalid branch filter." });
    }

    const { stage, search } = req.query;

    // 1. Find all active bills that are either marked overdue, or past due date with remaining balance > 0
    const now = new Date();
    const billFilter = {
      isArchived: { $ne: true },
      status: { $nin: ["paid", "voided", "waived"] },
      $or: [
        { status: "overdue" },
        { dueState: "overdue" },
        { dueDate: { $lt: now }, remainingAmount: { $gt: 0 } },
        { overdueNoticeCount: { $gt: 0 }, remainingAmount: { $gt: 0 } },
      ],
    };

    if (branch) billFilter.branch = branch;

    const overdueBills = await Bill.find(billFilter)
      .populate("userId", "firstName lastName email phone avatar profileImage photoURL")
      .populate({
        path: "reservationId",
        select: "roomId roomNumber branch moveInDate moveOutDate status",
        populate: { path: "roomId", select: "name roomNumber branch type" },
      })
      .populate("roomId", "name roomNumber branch type")
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    // 2. Fetch all non-archived OverdueNotice documents for these bills
    const billIds = overdueBills.map((b) => b._id);
    const existingNotices = await OverdueNotice.find({
      billId: { $in: billIds },
      isArchived: false,
    })
      .populate("issuedBy", "firstName lastName email")
      .sort({ noticeNumber: 1, issuedAt: -1 })
      .lean();

    // Map notices by billId
    const noticesByBill = new Map();
    for (const notice of existingNotices) {
      const bId = String(notice.billId);
      if (!noticesByBill.has(bId)) noticesByBill.set(bId, []);
      noticesByBill.get(bId).push(notice);
    }

    // 3. Assemble unified records
    let records = overdueBills.map((bill) => {
      const tenant = bill.userId || {};
      const resv = bill.reservationId || {};
      const room = bill.roomId || resv.roomId || {};
      const billNotices = noticesByBill.get(String(bill._id)) || [];
      
      const latestNotice = billNotices.length > 0 ? billNotices[billNotices.length - 1] : null;
      const noticeCount = latestNotice?.noticeNumber || bill.overdueNoticeCount || 0;

      const daysOverdue = bill.dueDate
        ? Math.max(0, dayjs().diff(dayjs(bill.dueDate), "day"))
        : 0;

      const frozenAmount = latestNotice?.totalAmountAtIssuance ?? (bill.remainingAmount || bill.totalAmount || 0);

      const tenantName = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "Tenant";
      const roomName = room.name || room.roomNumber || resv.roomNumber || "Room";

      return {
        _id: latestNotice?._id || `bill-${bill._id}`,
        billId: bill._id,
        billNumber: String(bill._id).slice(-6).toUpperCase(),
        tenantId: tenant._id,
        tenantName,
        tenantEmail: tenant.email || "",
        tenantPhone: tenant.phone || "",
        roomId: roomName,
        roomName,
        branch: bill.branch,
        dueDate: bill.dueDate,
        daysOverdue,
        remainingAmount: bill.remainingAmount || bill.totalAmount || 0,
        frozenAmount,
        penaltyAmount: bill.charges?.penalty || 0,
        rentAmount: bill.charges?.rent || 0,
        electricityAmount: bill.charges?.electricity || 0,
        waterAmount: bill.charges?.water || 0,
        noticeStage: noticeCount === 0 ? "eligible" : `notice_${noticeCount}`,
        noticeCount,
        disputeState: bill.disputeState || "none",
        deliveredAt: latestNotice?.issuedAt || null,
        deliveryStatus: latestNotice?.deliveryStatus || (noticeCount === 0 ? "unissued" : "sent"),
        escalatedToReviewId: latestNotice?.escalatedToReviewId || bill.overdueEscalatedToReviewId || null,
        noticesHistory: billNotices.map((n) => ({
          _id: n._id,
          noticeNumber: n.noticeNumber,
          issuedAt: n.issuedAt,
          issuedByName: n.issuedBy ? `${n.issuedBy.firstName || ""} ${n.issuedBy.lastName || ""}`.trim() : "Staff Admin",
          totalAmountAtIssuance: n.totalAmountAtIssuance,
          daysOverdueAtIssuance: n.daysOverdueAtIssuance,
          deliveryStatus: n.deliveryStatus,
        })),
      };
    });

    // 4. Compute Top KPI Summary Statistics
    const stats = {
      totalExposure: records.reduce((sum, r) => sum + Number(r.remainingAmount || 0), 0),
      overdueAccounts: records.length,
      pendingNotice1Count: records.filter((r) => r.noticeCount === 0).length,
      notice1ActiveCount: records.filter((r) => r.noticeCount === 1).length,
      notice2ActiveCount: records.filter((r) => r.noticeCount === 2).length,
      notice3FinalCount: records.filter((r) => r.noticeCount >= 3).length,
    };

    // 5. Apply Client-Facing Stage Filter
    if (stage && stage !== "all") {
      if (stage === "0" || stage === "eligible") {
        records = records.filter((r) => r.noticeCount === 0);
      } else if (stage === "1" || stage === "notice_1") {
        records = records.filter((r) => r.noticeCount === 1);
      } else if (stage === "2" || stage === "notice_2") {
        records = records.filter((r) => r.noticeCount === 2);
      } else if (stage === "3" || stage === "notice_3") {
        records = records.filter((r) => r.noticeCount >= 3);
      }
    }

    // 6. Apply Search Query Filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter((r) =>
        r.tenantName.toLowerCase().includes(q) ||
        r.roomName.toLowerCase().includes(q) ||
        r.billNumber.toLowerCase().includes(q) ||
        String(r.billId).toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      data: records,
      stats,
    });
  } catch (error) {
    logger.error("[OverdueNotice] getOverdueNoticesAction error:", error);
    next(error);
  }
};

/**
 * POST /api/billing/:billId/send-overdue-notice
 * Validate debt, snapshot frozen values, create OverdueNotice, dispatch email + notification,
 * and auto-escalate to TerminationReview on Notice 3.
 */
export const sendOverdueNoticeAction = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { billId } = req.params;
    const { noticeType, noticeNumber: rawNoticeNumber, noticeMessage, forceOverride } = req.body;

    const noticeNumber = parseNoticeNumber(rawNoticeNumber !== undefined ? rawNoticeNumber : noticeType);
    if (!noticeNumber) {
      return res.status(400).json({
        success: false,
        error: "Invalid notice stage. Must be Notice 1, Notice 2, or Notice 3 Final.",
      });
    }

    // Fetch target bill
    const bill = await Bill.findById(billId)
      .populate("userId", "firstName lastName email phone branch")
      .populate("reservationId")
      .populate("roomId", "name roomNumber branch");

    if (!bill) {
      return res.status(404).json({ success: false, error: "Billing statement not found." });
    }

    // Branch security guard
    if (req.branchFilter && bill.branch !== req.branchFilter) {
      return res.status(403).json({ success: false, error: "Unauthorized for this branch." });
    }

    // Validation Guard: Remaining balance
    const outstandingAmount = bill.remainingAmount !== undefined ? bill.remainingAmount : bill.totalAmount;
    if (bill.status === "paid" || outstandingAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot dispatch overdue notice. This bill is already fully settled.",
      });
    }

    // Validation Guard: Dispute Freeze (Spec §20 & §21)
    if (bill.disputeState === "disputed") {
      return res.status(400).json({
        success: false,
        error: "Notice dispatch frozen: This statement is currently under active administrative dispute.",
      });
    }

    // Validation Guard: Sequential Order
    const currentCount = bill.overdueNoticeCount || 0;
    if (!forceOverride && noticeNumber > currentCount + 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot issue Notice ${noticeNumber} before issuing Notice ${currentCount + 1}. Sequential progression is required.`,
      });
    }

    // Validation Guard: Notice Message length
    if (noticeMessage && String(noticeMessage).length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Notice message exceeds 2,000 characters limit.",
      });
    }

    // Compute frozen snapshot

    const daysOverdue = bill.dueDate
      ? Math.max(0, dayjs().diff(dayjs(bill.dueDate), "day"))
      : 0;

    const penaltyAmount = Number(bill.charges?.penalty || 0);
    const totalFrozenAmount = Number(outstandingAmount || 0);

    const tenantUser = bill.userId || {};
    const tenantName = `${tenantUser.firstName || ""} ${tenantUser.lastName || ""}`.trim() || "Tenant";

    // 1. Create OverdueNotice Document
    let noticeDoc = await OverdueNotice.findOne({
      billId: bill._id,
      noticeNumber,
      isArchived: false,
    });

    if (noticeDoc) {
      // Re-dispatch update
      noticeDoc.issuedBy = req.user._id;
      noticeDoc.issuedAt = new Date();
      noticeDoc.outstandingAmountAtIssuance = totalFrozenAmount;
      noticeDoc.penaltyAmountAtIssuance = penaltyAmount;
      noticeDoc.totalAmountAtIssuance = totalFrozenAmount;
      noticeDoc.daysOverdueAtIssuance = daysOverdue;
      noticeDoc.noticeMessage = (noticeMessage || "").trim();
      noticeDoc.deliveryStatus = "pending";
    } else {
      noticeDoc = new OverdueNotice({
        billId: bill._id,
        reservationId: bill.reservationId?._id || bill.reservationId,
        tenantId: tenantUser._id,
        branch: bill.branch,
        noticeNumber,
        outstandingAmountAtIssuance: totalFrozenAmount,
        penaltyAmountAtIssuance: penaltyAmount,
        totalAmountAtIssuance: totalFrozenAmount,
        daysOverdueAtIssuance: daysOverdue,
        issuedBy: req.user._id,
        issuedAt: new Date(),
        noticeMessage: (noticeMessage || "").trim(),
        deliveryStatus: "pending",
      });
    }

    await noticeDoc.save();

    // 2. Dispatch Email
    let emailDelivered = false;
    if (tenantUser.email) {
      try {
        const branchLabel = bill.branch === "gil-puyat" ? "Lilycrest Gil Puyat" : "Lilycrest Guadalupe";
        const dueDateFormatted = bill.dueDate
          ? dayjs(bill.dueDate).format("MMMM D, YYYY")
          : "due date";

        await sendOverdueNoticeEmail({
          to: tenantUser.email,
          tenantName,
          billingMonth: bill.billingMonth ? dayjs(bill.billingMonth).format("MMMM YYYY") : "Current Billing Cycle",
          totalAmount: totalFrozenAmount,
          daysLate: daysOverdue,
          penalty: penaltyAmount,
          dueDate: dueDateFormatted,
          reason: noticeMessage || `Payment balance is ${daysOverdue} day(s) overdue.`,
          noticeVariant: noticeNumber === 3 ? "penalty" : "overdue",
          branchName: branchLabel,
        });

        emailDelivered = true;
        noticeDoc.delivery.email.status = "sent";
        noticeDoc.delivery.email.sentAt = new Date();
      } catch (emailErr) {
        logger.error("[OverdueNotice] Email delivery failed:", emailErr);
        noticeDoc.delivery.email.status = "failed";
        noticeDoc.delivery.email.error = emailErr.message || "Failed to deliver email";
      }
    }

    // 3. Dispatch In-App Notification
    let notificationDelivered = false;
    try {
      const notifTitle =
        noticeNumber === 3
          ? "FINAL DEMAND: Intent to Terminate Lease"
          : noticeNumber === 2
          ? "URGENT DEMAND: Overdue Rent Notice"
          : "Payment Reminder: Overdue Rent Balance";

      const notifMsg =
        noticeNumber === 3
          ? `FINAL DEMAND: Your bill #${String(bill._id).slice(-6)} (₱${totalFrozenAmount.toLocaleString()}) is ${daysOverdue} days overdue. Immediate settlement required to prevent administrative lease termination.`
          : noticeNumber === 2
          ? `URGENT: Your bill #${String(bill._id).slice(-6)} (₱${totalFrozenAmount.toLocaleString()}) is ${daysOverdue} days overdue. Penalties continue to accrue.`
          : `Friendly Reminder: Your bill #${String(bill._id).slice(-6)} (₱${totalFrozenAmount.toLocaleString()}) was due on ${dayjs(bill.dueDate).format("MM/DD/YYYY")}. Please settle immediately.`;

      await notify.billingNotice(tenantUser._id, {
        notificationType: "overdue_notice",
        title: notifTitle,
        message: notifMsg,
        billId: bill._id,
        pushType: "overdue_notice",
      });

      notificationDelivered = true;
      noticeDoc.delivery.notification.status = "sent";
      noticeDoc.delivery.notification.sentAt = new Date();
    } catch (notifErr) {
      logger.error("[OverdueNotice] In-app notification failed:", notifErr);
      noticeDoc.delivery.notification.status = "failed";
      noticeDoc.delivery.notification.error = notifErr.message || "Failed to create in-app notification";
    }

    // Update overall delivery status
    if (emailDelivered && notificationDelivered) {
      noticeDoc.deliveryStatus = "sent";
    } else if (emailDelivered || notificationDelivered) {
      noticeDoc.deliveryStatus = "partial";
    } else {
      noticeDoc.deliveryStatus = "failed";
    }

    // 4. Update Bill State
    bill.overdueNoticeCount = Math.max(bill.overdueNoticeCount || 0, noticeNumber);
    bill.dueState = "overdue";
    if (bill.status !== "partially-paid") {
      bill.status = "overdue";
    }

    // 5. Automatic Escalation to Termination Review Board on Notice 3 (Spec §21.3 & §22.1)
    let reviewCaseId = null;
    if (noticeNumber === 3) {
      const resvId = bill.reservationId?._id || bill.reservationId;
      let existingReview = await TerminationReview.findOne({
        reservationId: resvId,
        status: { $in: ["open", "under_review", "pending_response"] },
        isArchived: false,
      });

      if (!existingReview) {
        existingReview = new TerminationReview({
          reservationId: resvId,
          tenantId: tenantUser._id,
          branch: bill.branch,
          triggerType: "notice_exhaustion",
          triggeredByNoticeId: noticeDoc._id,
          triggeredByBillId: bill._id,
          totalOutstandingAtOpen: totalFrozenAmount,
          penaltyAmountAtOpen: penaltyAmount,
          daysOverdueAtOpen: daysOverdue,
          openedBy: req.user._id,
          openedAt: new Date(),
          status: "open",
        });

        await existingReview.save();
        logger.info(
          `[OverdueNotice] Auto-opened TerminationReview ${existingReview._id} upon Notice 3 exhaustion for bill ${bill._id}`,
        );
      }

      reviewCaseId = existingReview._id;
      noticeDoc.escalatedToReviewId = existingReview._id;
      noticeDoc.escalatedAt = new Date();

      bill.overdueEscalatedAt = new Date();
      bill.overdueEscalatedToReviewId = existingReview._id;
    }

    await noticeDoc.save();
    await bill.save();

    // 6. Audit Log
    await logBillingAudit({
      action: "DISPATCH_OVERDUE_NOTICE",
      actorId: req.user._id,
      targetUserId: tenantUser._id,
      branch: bill.branch,
      details: {
        billId: bill._id,
        noticeId: noticeDoc._id,
        noticeNumber,
        totalFrozenAmount,
        daysOverdue,
        escalatedToReviewId: reviewCaseId,
      },
    });

    res.status(201).json({
      success: true,
      message: `Notice ${noticeNumber} dispatched successfully to ${tenantName}.`,
      data: {
        notice: noticeDoc,
        overdueNoticeCount: bill.overdueNoticeCount,
        escalatedToReviewId: reviewCaseId,
      },
    });
  } catch (error) {
    logger.error("[OverdueNotice] sendOverdueNoticeAction error:", error);
    next(error);
  }
};

/**
 * PATCH /api/billing/termination-reviews/:id/decision
 * Adjudicate a Termination Review Board case (Approve Payment Plan, Deadline Extension,
 * Pre-Termination Notice, Eviction/Termination, or Dismissal).
 */
export const updateTerminationDecisionAction = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const { id } = req.params;
    const {
      outcome,
      outcomeDetail,
      status: targetStatus,
      paymentPlan,
      preTerminationNotice,
      reviewNotes,
    } = req.body;

    const VALID_OUTCOMES = [
      "payment_plan_approved",
      "deadline_extension",
      "pre_termination_notice",
      "termination_approved",
      "case_dismissed",
    ];

    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}`,
      });
    }

    const trimmedOutcomeDetail = (outcomeDetail || "").trim();
    if (trimmedOutcomeDetail.length < 10) {
      return res.status(400).json({
        success: false,
        error: "A formal rationale (outcomeDetail) must be at least 10 characters.",
      });
    }

    if (trimmedOutcomeDetail.length > 3000) {
      return res.status(400).json({
        success: false,
        error: "Formal rationale exceeds 3,000 characters limit.",
      });
    }

    const trimmedReviewNotes = (reviewNotes || "").trim();
    if (trimmedReviewNotes.length > 5000) {
      return res.status(400).json({
        success: false,
        error: "Internal review notes exceed 5,000 characters limit.",
      });
    }

    const review = await TerminationReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, error: "Termination review case not found." });
    }

    // Branch guard
    if (req.branchFilter && review.branch !== req.branchFilter) {
      return res.status(403).json({ success: false, error: "Unauthorized for this branch." });
    }

    // Update Decision Block
    review.decision = {
      outcome,
      outcomeDetail: trimmedOutcomeDetail,
      decidedBy: req.user._id,
      decidedAt: new Date(),
    };

    review.status = targetStatus || (outcome === "case_dismissed" ? "closed" : "resolved");
    review.resolvedAt = new Date();

    if (trimmedReviewNotes) {
      review.reviewNotes = trimmedReviewNotes;
    }

    // Handle Payment Plan terms
    if (outcome === "payment_plan_approved" && paymentPlan) {
      const installmentsCount = Math.floor(Number(paymentPlan.numberOfInstallments)) || 1;
      if (installmentsCount < 1 || installmentsCount > 24) {
        return res.status(400).json({
          success: false,
          error: "Number of installments must be between 1 and 24.",
        });
      }

      const totalPlanAmount = Number(paymentPlan.totalAmount) || Number(review.totalOutstandingAtOpen) || 0;
      if (totalPlanAmount < 1 || totalPlanAmount > 1000000) {
        return res.status(400).json({
          success: false,
          error: "Payment plan amount must be between ₱1.00 and ₱1,000,000.00.",
        });
      }

      const installmentAmt = Number(paymentPlan.installmentAmount) || (totalPlanAmount / installmentsCount);
      const firstDueDate = paymentPlan.firstPaymentDue ? new Date(paymentPlan.firstPaymentDue) : new Date();

      if (Number.isNaN(firstDueDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid first payment due date format.",
        });
      }

      const computedInstallments = [];
      for (let i = 0; i < installmentsCount; i++) {
        const itemDue = dayjs(firstDueDate).add(i, "month").toDate();
        computedInstallments.push({
          dueDate: itemDue,
          amount: installmentAmt,
          status: "pending",
        });
      }

      review.paymentPlan = {
        totalAmount: totalPlanAmount,
        numberOfInstallments: installmentsCount,
        installmentAmount: installmentAmt,
        firstPaymentDue: firstDueDate,
        approvedBy: req.user._id,
        approvedAt: new Date(),
        installments: computedInstallments,
      };
    }

    // Handle Pre-Termination Notice
    if (outcome === "pre_termination_notice" && preTerminationNotice) {
      const noticeTextTrimmed = (preTerminationNotice.noticeText || trimmedOutcomeDetail).trim();
      if (noticeTextTrimmed.length > 2000) {
        return res.status(400).json({
          success: false,
          error: "Pre-termination notice text exceeds 2,000 characters limit.",
        });
      }

      const vacateDateObj = preTerminationNotice.vacateByDate ? new Date(preTerminationNotice.vacateByDate) : dayjs().add(7, "day").toDate();
      if (Number.isNaN(vacateDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid vacate-by date format.",
        });
      }

      review.preTerminationNotice = {
        issuedAt: new Date(),
        issuedBy: req.user._id,
        vacateByDate: vacateDateObj,
        noticeText: noticeTextTrimmed,
        deliveredVia: preTerminationNotice.deliveredVia || "both",
        deliveredAt: new Date(),
      };
    }


    await review.save();

    // Audit Log
    await logBillingAudit({
      action: "ADJUDICATE_TERMINATION_REVIEW",
      actorId: req.user._id,
      targetUserId: review.tenantId,
      branch: review.branch,
      details: {
        reviewId: review._id,
        outcome,
        status: review.status,
      },
    });

    res.json({
      success: true,
      message: "Termination review decision recorded successfully.",
      data: review,
    });
  } catch (error) {
    logger.error("[OverdueNotice] updateTerminationDecisionAction error:", error);
    next(error);
  }
};
