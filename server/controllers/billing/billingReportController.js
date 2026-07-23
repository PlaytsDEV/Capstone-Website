import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import { Bill, User, Room } from "../../models/index.js";
import logger from "../../middleware/logger.js";
import { logBillingAudit } from "../../utils/billingAudit.js";
import { computePenalty, fetchPenaltySettings } from "../../utils/penaltyCalculator.js";
import { syncBillAmounts, resolveBillStatus } from "../../utils/billingPolicy.js";
import { isAdminRole, isOwnerRole } from "../../config/roles.js";
import {
  getAdminInfo,
  loadRentBillForAdmin,
  loadBillForAdmin,
  deliverBillNotification,
  deliverBillReminder,
  canSendBillReminder,
  formatBillReference,
  formatBill,
  generateRentBillPdf,
  SERVER_ROOT,
  BILL_PDF_ROOT,
} from "./_helpers.js";

export const sendRentBill = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch = req.branchFilter || (admin.isOwner ? null : admin.branch);

    if (!branch && !admin.isOwner) {
      return res.status(400).json({ error: "Branch is required." });
    }

    const bill = await loadRentBillForAdmin({
      billId: req.params.billId,
      branch,
    });
    const [tenant, room] = await Promise.all([
      User.findById(bill.userId).select("firstName lastName email"),
      bill.roomId
        ? Room.findById(bill.roomId).select("name roomNumber branch type")
        : null,
    ]);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const delivery = await deliverBillNotification({
      bill,
      tenant,
      room,
      billType: "rent",
    });

    bill.sentAt = new Date();
    bill.issuedAt = bill.issuedAt || bill.sentAt;
    await bill.save();

    await logBillingAudit(req, {
      admin,
      action: "Rent bill sent",
      details: `Sent rent bill ${formatBillReference(bill)}`,
      entityId: bill._id,
      branch: bill.branch,
      metadata: {
        billId: String(bill._id),
        tenantId: String(bill.userId),
        emailStatus: delivery.email?.status,
        notificationStatus: delivery.notification?.status,
      },
    });

    await bill.populate("userId", "firstName lastName email username");
    await bill.populate("roomId", "name roomNumber branch type");
    await bill.populate("reservationId", "roomId roomName bedDetails");

    const warning =
      delivery.email?.status === "failed"
        ? "Bill created, but email failed."
        : null;

    res.json({
      success: true,
      message: warning || "Bill sent successfully.",
      bill: formatBill(bill),
      delivery,
      warning,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    next(error);
  }
};

export const sendBillReminder = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const branch = req.branchFilter || (admin.isOwner ? null : admin.branch);
    const requestedNoticeType = String(req.body?.noticeType || "reminder")
      .trim()
      .toLowerCase();

    if (!branch && !admin.isOwner) {
      return res.status(400).json({ error: "Branch is required." });
    }

    const bill = await loadBillForAdmin({
      billId: req.params.billId,
      branch,
    });

    if (!canSendBillReminder(bill)) {
      return res.status(400).json({
        error: "Reminders can only be sent for unpaid bills with a due date.",
        code: "REMINDER_NOT_ALLOWED",
      });
    }
    if (requestedNoticeType === "penalty" && Number(bill?.charges?.penalty || 0) <= 0) {
      return res.status(400).json({
        error: "Penalty notice is only available when the bill has a recorded penalty.",
        code: "PENALTY_NOTICE_NOT_AVAILABLE",
      });
    }

    const [tenant, room] = await Promise.all([
      User.findById(bill.userId).select("firstName lastName email"),
      bill.roomId
        ? Room.findById(bill.roomId).select("name roomNumber branch type")
        : null,
    ]);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const delivery = await deliverBillReminder({
      bill,
      tenant,
      room,
      noticeType: requestedNoticeType,
    });
    const visible = formatBill(bill);
    const noticeAction =
      delivery.noticeType === "penalty" ? "Penalty notice sent" : "Billing notice sent";
    const noticeLabel =
      delivery.noticeType === "penalty" ? "Penalty notice" : "Reminder";

    await logBillingAudit(req, {
      admin,
      action: noticeAction,
      details: `Sent ${delivery.noticeType} notice for ${formatBillReference(bill)}`,
      entityId: bill._id,
      branch: bill.branch,
      metadata: {
        billId: String(bill._id),
        tenantId: String(bill.userId),
        emailStatus: delivery.email?.status,
        notificationStatus: delivery.notification?.status,
        daysOverdue: delivery.daysOverdue || 0,
        noticeType: delivery.noticeType,
        penaltyAmount: delivery.penaltyAmount || 0,
      },
    });

    res.json({
      success: true,
      message:
        delivery.noticeType === "penalty"
          ? "Penalty notice sent successfully."
          : "Reminder sent successfully.",
      reminder: {
        billId: String(bill._id),
        noticeType: delivery.noticeType,
        label: noticeLabel,
        status: visible.status,
        dueDate: visible.dueDate,
        daysOverdue: delivery.daysOverdue || 0,
        penaltyAmount: delivery.penaltyAmount || 0,
      },
      delivery,
    });
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({ error: error.message, code: error.code });
    }
    next(error);
  }
};

export const downloadBillPdf = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const requester = await User.findOne({ firebaseUid: req.user.uid })
      .select("_id role branch email firstName lastName")
      .lean();
    if (!requester) {
      return res.status(404).json({ error: "User not found" });
    }

    const bill = await Bill.findOne({ _id: billId, isArchived: false })
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name roomNumber branch")
      .populate("reservationId", "roomId roomName bedDetails selectedBed");

    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const isAdmin = isAdminRole(requester.role);
    const isTenantOwner = String(bill.userId?._id || bill.userId) === String(requester._id);
    const canAccess =
      isTenantOwner ||
      (isAdmin && (isOwnerRole(requester.role) || requester.branch === bill.branch));

    if (!canAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    let absolutePdfPath = bill.pdfPath
      ? path.resolve(SERVER_ROOT, bill.pdfPath)
      : null;
    const safePdfRoot = path.resolve(BILL_PDF_ROOT);

    if (
      !absolutePdfPath ||
      !absolutePdfPath.startsWith(safePdfRoot) ||
      !fs.existsSync(absolutePdfPath)
    ) {
      const reservation = bill.reservationId
        ? await Reservation.findById(bill.reservationId._id || bill.reservationId)
            .populate("userId", "firstName lastName email")
            .populate("roomId", "name roomNumber branch type price monthlyPrice")
        : null;

      await generateRentBillPdf({
        bill,
        reservation: reservation || {
          userId: bill.userId,
          roomId: bill.roomId,
        },
      });
      absolutePdfPath = path.resolve(SERVER_ROOT, bill.pdfPath);
    }

    if (!absolutePdfPath.startsWith(safePdfRoot) || !fs.existsSync(absolutePdfPath)) {
      return res.status(404).json({ error: "PDF not found" });
    }

    if (isAdmin) {
      await logBillingAudit(req, {
        admin: requester,
        action: bill.pdfGeneratedAt ? "Bill PDF downloaded" : "Bill PDF generated",
        details: `Downloaded ${formatBillReference(bill)}`,
        entityId: bill._id,
        branch: bill.branch,
        metadata: {
          billId: String(bill._id),
          pdfPath: bill.pdfPath,
          tenantId: String(bill.userId?._id || bill.userId),
        },
      });
    }

    res.download(absolutePdfPath, `${formatBillReference(bill)}.pdf`);
  } catch (error) {
    next(error);
  }
};

export const applyPenalties = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const now = dayjs();
    const settings = await fetchPenaltySettings();
    const filter = {
      status: { $in: ["pending", "overdue", "partially-paid"] },
      dueDate: { $lt: now.toDate() },
      isArchived: false,
    };
    if (!admin.isOwner && admin.branch) filter.branch = admin.branch;

    const overdueBills = await Bill.find(filter);
    let updated = 0;

    for (const bill of overdueBills) {
      const { penalty, daysLate, ratePerDay } = await computePenalty(bill, settings, now);
      if (daysLate <= 0) continue;

      bill.charges.penalty = penalty;
      bill.penaltyDetails = { daysLate, ratePerDay, appliedAt: now.toDate() };
      syncBillAmounts(bill);
      bill.status = resolveBillStatus(bill, now.toDate());
      await bill.save();
      updated++;
    }

    res.json({ message: `Penalties applied to ${updated} bills`, updated });
  } catch (error) {
    next(error);
  }
};

export const getBillingReport = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const filter = { isArchived: false };
    if (!admin.isOwner && admin.branch) filter.branch = admin.branch;

    const [totalBills, paidBills, overdueBills, pendingVerifications] =
      await Promise.all([
        Bill.countDocuments(filter),
        Bill.aggregate([
          { $match: { ...filter, status: "paid" } },
          {
            $group: {
              _id: null,
              total: { $sum: "$paidAmount" },
              count: { $sum: 1 },
            },
          },
        ]),
        Bill.aggregate([
          { $match: { ...filter, status: "overdue" } },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAmount" },
              count: { $sum: 1 },
              penalties: { $sum: "$charges.penalty" },
            },
          },
        ]),
        Bill.countDocuments({
          ...filter,
          "paymentProof.verificationStatus": "pending-verification",
        }),
      ]);

    res.json({
      totalBills,
      collected: {
        amount: paidBills[0]?.total || 0,
        count: paidBills[0]?.count || 0,
      },
      overdue: {
        amount: overdueBills[0]?.total || 0,
        count: overdueBills[0]?.count || 0,
        penalties: overdueBills[0]?.penalties || 0,
      },
      pendingVerifications,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBill = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const admin = await getAdminInfo(req);

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    if (!admin.isOwner && bill.branch !== admin.branch)
      return res.status(403).json({ error: "Access denied" });

    if (bill.status !== "draft")
      return res.status(400).json({
        error:
          "Only draft bills can be deleted. Issued bills (pending, partially-paid, overdue, paid) must be retained.",
      });

    if ((bill.paidAmount || 0) > 0)
      return res.status(400).json({
        error:
          "Cannot delete this draft bill because it already has payment activity.",
      });

    await bill.deleteOne();

    logger.info(
      { billId, deletedBy: admin._id, branch: bill.branch },
      "Bill deleted by admin",
    );

    res.json({ success: true, message: "Bill deleted successfully" });
  } catch (error) {
    next(error);
  }
};
