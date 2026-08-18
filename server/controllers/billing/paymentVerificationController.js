import { Bill, User } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from "../../config/email.js";
import { applyBillPayment } from "../../utils/paymentLedger.js";
import { getVisibleBillSnapshot } from "../../utils/billingPolicy.js";
import {
  getAdminInfo,
  resolveManualPaymentMethod,
  resolveProofPaymentMethod,
  isPaymentValidationError,
  buildBillPaymentFlow,
} from "./_helpers.js";
import { logBillingAudit } from "../../utils/billingAudit.js";
import dayjs from "dayjs";
import { notify } from "../../utils/notificationService.js";

export const markBillAsPaid = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const { amount, note } = req.body;
    const admin = await getAdminInfo(req);
    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (!admin.isOwner && bill.branch !== admin.branch)
      return res.status(403).json({ error: "Bill not found" });
    if (bill.structuredWorkflowVersion) {
      return res.status(409).json({
        error: "Structured workflow Bills must be settled through PayMongo.",
        code: "PAYMONGO_SETTLEMENT_REQUIRED",
      });
    }
    const appliedAmount = Number(
      amount ?? bill.remainingAmount ?? bill.totalAmount,
    );
    const paymentResult = await applyBillPayment({
      bill,
      amount: appliedAmount,
      method: resolveManualPaymentMethod(note),
      source: "admin-manual",
      actorId: admin._id || null,
      notes: note || "",
      metadata: {
        action: "markBillAsPaid",
      },
      now: new Date(),
    });
    if (note) {
      bill.notes = note;
      await bill.save();
    }

    await logBillingAudit(req, {
      admin,
      action: "Recorded Manual Bill Payment",
      severity: "info",
      entityType: "payment",
      entityId: bill._id,
      branch: bill.branch,
      details: `Recorded manual payment of ₱${appliedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} for Bill #${bill.billNumber || bill._id}${note ? ` (Note: ${note})` : ""}`,
      metadata: {
        billId: bill._id,
        appliedAmount,
        note,
        userId: bill.userId,
      },
    });

    const monthStr = dayjs(bill.billingMonth).format("MMMM YYYY");
    await notify.paymentApproved(
      bill.userId,
      monthStr,
      paymentResult.appliedAmount,
      {
        billId: bill._id,
        eventId: paymentResult.payment?._id || paymentResult.payment?.paymentId,
      },
    );

    res.json({ success: true, bill: bill.toObject() });
  } catch (error) {
    if (isPaymentValidationError(error)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const submitPaymentProof = async (req, res, next) => {
  try {
    const { billId } = req.params;

    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (String(bill.userId) !== String(dbUser._id))
      return res
        .status(403)
        .json({ error: "You can only submit proof for your own bills" });
    if (bill.structuredWorkflowVersion) {
      return res.status(409).json({
        error: "Structured workflow Bills must be paid through PayMongo.",
        code: "PAYMONGO_SETTLEMENT_REQUIRED",
      });
    }
    const visible = getVisibleBillSnapshot(bill);
    if (visible.status === "paid")
      return res.status(400).json({ error: "Bill is already paid" });
    if (bill.paymentProof?.verificationStatus === "pending-verification")
      return res.status(400).json({
        error: "Payment proof already submitted and pending verification",
      });
    return res.status(409).json({
      error:
        "Monthly bill proof uploads are no longer supported. Use online checkout from Billing or contact the branch for an assisted offline payment.",
      bill: {
        id: bill._id,
        paymentProof: bill.paymentProof || { verificationStatus: "none" },
        paymentFlow: buildBillPaymentFlow(bill, visible),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!["approve", "reject"].includes(action))
      return res
        .status(400)
        .json({ error: "Action must be 'approve' or 'reject'" });

    const admin = await getAdminInfo(req);
    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (!admin.isOwner && bill.branch !== admin.branch)
      return res.status(403).json({ error: "Access denied" });
    if (
      action === "approve" &&
      bill.paymentProof?.verificationStatus === "approved"
    ) {
      return res.json({
        success: true,
        message: "Payment proof already approved",
        bill,
      });
    }
    if (
      action === "reject" &&
      bill.paymentProof?.verificationStatus === "rejected"
    ) {
      return res.json({
        success: true,
        message: "Payment proof already rejected",
        bill,
      });
    }
    if (bill.paymentProof?.verificationStatus !== "pending-verification")
      return res
        .status(400)
        .json({ error: "No pending payment proof to verify" });

    let paymentResult = null;
    if (action === "approve") {
      const approvedAmount = Number(
        bill.paymentProof.submittedAmount || bill.totalAmount || 0,
      );
      paymentResult = await applyBillPayment({
        bill,
        amount: approvedAmount,
        method: resolveProofPaymentMethod(bill),
        source: "tenant-proof",
        actorId: admin._id || null,
        notes: "Approved tenant payment proof",
        metadata: {
          action: "verifyPayment",
          verificationAction: "approve",
        },
        proofImageUrl: bill.paymentProof?.imageUrl || null,
        now: new Date(),
      });
      bill.paymentProof.verificationStatus = "approved";
      bill.paymentProof.verifiedBy = admin._id;
      bill.paymentProof.verifiedAt = new Date();
    } else {
      bill.paymentProof.verificationStatus = "rejected";
      bill.paymentProof.rejectionReason =
        rejectionReason || "Payment proof not acceptable";
      bill.paymentProof.verifiedBy = admin._id;
      bill.paymentProof.verifiedAt = new Date();
    }
    await bill.save();

    if (action === "approve") {
      const approvedAmount = Number(
        bill.paymentProof?.submittedAmount || bill.totalAmount || 0,
      );
      await logBillingAudit(req, {
        admin,
        action: "Approved Payment Proof",
        severity: "info",
        entityType: "payment",
        entityId: bill._id,
        branch: bill.branch,
        details: `Approved payment proof of ₱${approvedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} for Bill #${bill.billNumber || bill._id}`,
        metadata: {
          billId: bill._id,
          approvedAmount,
          userId: bill.userId,
        },
      });
    } else {
      await logBillingAudit(req, {
        admin,
        action: "Rejected Payment Proof",
        severity: "warning",
        entityType: "payment",
        entityId: bill._id,
        branch: bill.branch,
        details: `Rejected payment proof for Bill #${bill.billNumber || bill._id}. Reason: ${rejectionReason || "Payment proof not acceptable"}`,
        metadata: {
          billId: bill._id,
          rejectionReason,
          userId: bill.userId,
        },
      });
    }

    const monthStr = dayjs(bill.billingMonth).format("MMMM YYYY");
    const proofEventId = bill.paymentProof?.submittedAt
      ? new Date(bill.paymentProof.submittedAt).toISOString()
      : new Date(bill.paymentProof.verifiedAt).toISOString();
    if (action === "approve") {
      await notify.paymentApproved(
        bill.userId,
        monthStr,
        paymentResult.appliedAmount,
        {
          billId: bill._id,
          eventId: paymentResult.payment?._id || paymentResult.payment?.paymentId || `proof:${proofEventId}`,
        },
      );
    } else {
      await notify.paymentRejected(
        bill.userId,
        monthStr,
        bill.paymentProof.rejectionReason,
        {
          billId: bill._id,
          eventId: `proof:${proofEventId}`,
        },
      );
    }

    try {
      const tenant = await User.findById(bill.userId).lean();
      if (tenant?.email) {
        const monthStr = dayjs(bill.billingMonth).format("MMMM YYYY");
        if (action === "approve") {
          const approvedAmount =
            bill.paymentProof?.submittedAmount || bill.totalAmount || 0;
          sendPaymentApprovedEmail({
            to: tenant.email,
            tenantName:
              `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim(),
            billingMonth: monthStr,
            paidAmount: approvedAmount,
            branchName: bill.branch,
          }).catch((e) => logger.warn({ err: e }, "Payment approved email failed"));
        } else {
          sendPaymentRejectedEmail({
            to: tenant.email,
            tenantName:
              `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim(),
            billingMonth: monthStr,
            rejectionReason: bill.paymentProof.rejectionReason,
            branchName: bill.branch,
          }).catch((e) => logger.warn({ err: e }, "Payment rejected email failed"));
        }
      }
    } catch (emailErr) {
      logger.warn({ err: emailErr }, "Email notification failed");
    }

    res.json({
      message: `Payment ${action}d successfully`,
      bill: {
        id: bill._id,
        status: bill.status,
        paymentProof: bill.paymentProof,
      },
    });
  } catch (error) {
    if (isPaymentValidationError(error)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const getPendingVerifications = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const filter = {
      "paymentProof.verificationStatus": "pending-verification",
      isArchived: false,
    };
    if (!admin.isOwner && admin.branch) filter.branch = admin.branch;

    const bills = await Bill.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch")
      .sort({ "paymentProof.submittedAt": -1 })
      .lean();

    res.json({
      count: bills.length,
      bills: bills.map((b) => {
        const visible = getVisibleBillSnapshot(b);
        return {
          id: b._id,
          tenant: b.userId
            ? {
                name: `${b.userId.firstName || ""} ${b.userId.lastName || ""}`.trim(),
                email: b.userId.email,
              }
            : null,
          room: b.roomId?.name || "N/A",
          branch: b.branch,
          billingMonth: b.billingMonth,
          totalAmount: visible.totalAmount,
          paymentProof: b.paymentProof,
          paymentFlow: buildBillPaymentFlow(b, visible),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

import { createMilestoneSubInvoices } from "../../services/milestoneInvoiceService.js";

export const approvePaymentArrangement = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const { milestones } = req.body;
    const admin = await getAdminInfo(req);

    const subInvoices = await createMilestoneSubInvoices(
      billId,
      milestones,
      admin._id || admin.uid
    );

    res.json({
      success: true,
      message: `Payment arrangement approved. Generated ${subInvoices.length} milestone sub-invoices.`,
      subInvoices,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
