import express from "express";
import multer from "multer";
import { verifyAdmin, verifyToken } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import * as chatController from "../controllers/chatController.js";

const router = express.Router();
const CHAT_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (CHAT_ATTACHMENT_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) return cb(null, true);
    const error = new Error("This file type is not supported. Please upload a JPEG, PNG, WebP, HEIC, HEIF, or PDF file.");
    error.statusCode = 400;
    error.code = "UNSUPPORTED_FILE_TYPE";
    return cb(error);
  },
});

router.use(verifyToken);

// Admin/web routes. Keep these before tenant :conversationId routes.
// manageUsers is the existing Phase 0 permission for chat administration.
router.use(
  "/admin",
  verifyAdmin,
  requirePermission("manageUsers"),
  filterByBranch,
);
router.get(
  "/admin/conversations",
  chatController.getAdminConversations,
);
router.get(
  "/admin/conversations/:conversationId/messages",
  chatController.getAdminConversationMessages,
);
router.post(
  "/admin/conversations/:conversationId/attachments",
  upload.single("file"),
  chatController.uploadChatAttachment,
);
router.post(
  "/admin/conversations/:conversationId/messages",
  chatController.sendAdminMessage,
);
router.patch(
  "/admin/conversations/:conversationId/read",
  chatController.markAdminConversationRead,
);
router.patch(
  "/admin/conversations/:conversationId/assign",
  chatController.assignAdminConversation,
);
router.patch(
  "/admin/conversations/:conversationId/status",
  chatController.updateAdminConversationStatus,
);
router.patch(
  "/admin/conversations/:conversationId/priority",
  chatController.updateAdminConversationPriority,
);
router.patch(
  "/admin/conversations/:conversationId/close",
  chatController.closeAdminConversation,
);

// Typing indicator — lightweight, no DB write, emits socket event only.
// Called by both tenant and admin while composing a message.
router.post("/:conversationId/typing", chatController.broadcastTyping);

// Tenant/mobile compatible routes.
router.post("/start", chatController.startConversation);
router.get("/me", chatController.getMyConversations);
router.get("/:conversationId/messages", chatController.getConversationMessages);
router.post(
  "/:conversationId/attachments",
  upload.single("file"),
  chatController.uploadChatAttachment,
);
router.get(
  "/:conversationId/attachments/:attachmentId",
  chatController.downloadChatAttachment,
);
router.post("/:conversationId/messages", chatController.sendTenantMessage);
router.patch("/:conversationId/resolution", chatController.confirmTenantResolution);
router.patch("/:conversationId/reopen", chatController.reopenTenantConversation);

export default router;
