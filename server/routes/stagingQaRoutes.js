import express from "express";
import mongoose from "mongoose";
import { verifyAdmin, verifyToken } from "../middleware/auth.js";
import notify from "../services/notifications/notificationService.js";
import { sendMobilePushAnnouncement } from "../services/notifications/mobilePushService.js";
import { deploymentEnvironment } from "../config/environmentSafety.js";

const router = express.Router();
const TYPES = new Set(["announcement", "billing", "contract", "maintenance", "support"]);
const text = (value) => String(value || "").trim();

const qaAdminAllowlist = () => new Set(
  text(process.env.STAGING_QA_ADMIN_EMAILS)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function requireStagingQaAdmin(req, res, next) {
  if (deploymentEnvironment(process.env) !== "staging") return res.status(404).json({ error: "Not found" });
  const email = text(req.authUser?.email).toLowerCase();
  if (!email || !qaAdminAllowlist().has(email)) {
    return res.status(403).json({ error: "Dedicated QA administrator access is required." });
  }
  return next();
}

router.use(verifyToken, verifyAdmin, requireStagingQaAdmin);

router.post("/notifications/:type", async (req, res, next) => {
  try {
    const type = text(req.params.type).toLowerCase();
    if (!TYPES.has(type)) return res.status(400).json({ error: "Unsupported QA notification type." });

    const qaRunId = text(req.body?.qaRunId || process.env.QA_RUN_ID).toLowerCase();
    const tenantEmail = text(req.body?.tenantEmail).toLowerCase();
    if (!qaRunId || !tenantEmail) return res.status(400).json({ error: "qaRunId and tenantEmail are required." });

    // Raw collection lookup retains the explicit QA metadata that is not part
    // of the production User schema. This is an additional gate beyond admin
    // authentication and the email allowlist.
    const tenantRaw = await mongoose.connection.db.collection("users").findOne({
      email: tenantEmail,
      role: "tenant",
      qa_fixture: true,
      qa_run_id: qaRunId,
    });
    if (!tenantRaw) return res.status(404).json({ error: "QA tenant was not found in the selected run." });
    const tenant = tenantRaw;

    const requestedId = text(req.body?.entityId);
    const entityFilter = requestedId && mongoose.isValidObjectId(requestedId)
      ? { _id: new mongoose.Types.ObjectId(requestedId) }
      : {};
    const eventId = text(req.body?.eventId) || new mongoose.Types.ObjectId().toString();
    let entity;
    let result;

    if (type === "announcement") {
      if (!requestedId || !mongoose.isValidObjectId(requestedId)) {
        return res.status(400).json({ error: "entityId is required for announcement routing verification." });
      }
      entity = await mongoose.connection.db.collection("announcements").findOne(
        { ...entityFilter, qa_run_id: qaRunId, qa_fixture: true },
        { sort: { publishedAt: -1, createdAt: -1 } },
      );
      if (!entity) return res.status(404).json({ error: "QA announcement was not found." });
      const now = new Date();
      const isLive = entity.publicationStatus === "published"
        && (!entity.startsAt || new Date(entity.startsAt) <= now)
        && (!entity.endsAt || new Date(entity.endsAt) > now);
      const isPrivateMatch = !entity.is_private || text(entity.user_id) === text(tenant.user_id);
      const targetBranch = text(entity.targetBranch).toLowerCase();
      const isBranchMatch = !targetBranch || ["both", "all"].includes(targetBranch) || targetBranch === text(tenant.branch).toLowerCase();
      if (!isLive || !isPrivateMatch || !isBranchMatch) {
        return res.status(409).json({ error: "The selected announcement is not currently visible to this QA tenant." });
      }
      result = await sendMobilePushAnnouncement(entity, [tenant._id]);
    } else if (type === "billing") {
      entity = await mongoose.connection.db.collection("bills").findOne(
        { ...entityFilter, userId: tenant._id, qa_run_id: qaRunId },
        { sort: { billingMonth: -1, createdAt: -1 } },
      );
      if (!entity) return res.status(404).json({ error: "QA bill was not found." });
      result = await notify.billingNotice(tenant._id, {
        notificationType: "bill_due_reminder",
        title: "QA Billing Notification",
        message: "Your synthetic QA billing statement is ready for routing verification.",
        billId: entity._id,
        actionUrl: `/billing?billId=${String(entity._id)}`,
        pushType: "billing_notice",
        eventId,
      });
    } else if (type === "contract") {
      entity = await mongoose.connection.db.collection("contracts").findOne(
        { ...entityFilter, tenantId: tenant._id, qa_run_id: qaRunId, isCurrent: true },
        { sort: { createdAt: -1 } },
      );
      if (!entity) return res.status(404).json({ error: "QA Contract was not found." });
      const version = Number(entity.finalDocument?.sourceVersion || entity.generatedVersion || 0);
      const variant = entity.finalDocument ? "final" : "prepared";
      if (!Number.isInteger(version) || version < 1) {
        return res.status(409).json({ error: "Run the real Admin draft/final workflow before sending the Contract notification." });
      }
      result = await notify.contractDocumentReady(tenant._id, variant, entity._id, version);
    } else if (type === "maintenance") {
      entity = await mongoose.connection.db.collection("maintenance_requests").findOne(
        { ...entityFilter, user_id: tenantRaw.user_id, qa_run_id: qaRunId },
        { sort: { created_at: -1, createdAt: -1 } },
      );
      if (!entity) return res.status(404).json({ error: "QA maintenance request was not found." });
      result = await notify.maintenanceUpdated(
        tenant._id,
        entity.request_type,
        entity.status,
        entity._id,
        { eventId, statusChanged: true },
      );
    } else {
      entity = await mongoose.connection.db.collection("chat_conversations").findOne(
        { ...entityFilter, tenantId: tenant._id, qa_run_id: qaRunId },
        { sort: { createdAt: -1 } },
      );
      if (!entity) return res.status(404).json({ error: "QA support conversation was not found." });
      const adminMessage = await mongoose.connection.db.collection("chat_messages").findOne(
        { conversationId: entity._id, senderRole: { $in: ["admin", "owner"] } },
        { sort: { createdAt: -1 } },
      );
      if (!adminMessage) {
        return res.status(409).json({ error: "Send a real Admin reply in this QA conversation before routing its notification." });
      }
      result = await notify.adminReply(tenant._id, entity._id, adminMessage._id);
    }

    await mongoose.connection.db.collection("qa_notification_dispatch_audits").insertOne({
      qa_fixture: true,
      qa_run_id: qaRunId,
      type,
      event_id: eventId,
      entity_id: entity?._id || null,
      tenant_id: tenant._id,
      tenant_user_id: tenantRaw.user_id,
      requested_by: req.authUser?._id || null,
      requested_by_email: text(req.authUser?.email).toLowerCase(),
      dispatched_at: new Date(),
      delivery_result: typeof result === "number" ? { pushCount: result } : { notificationId: result?._id || null },
    });

    return res.status(202).json({
      accepted: true,
      type,
      entityId: String(entity._id),
      eventId,
      tenantEmail,
    });
  } catch (error) {
    return next(error);
  }
});

export { requireStagingQaAdmin };
export default router;
